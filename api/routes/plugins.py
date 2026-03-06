from __future__ import annotations
import os
import shutil
import zipfile
import tempfile
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from api.deps import get_current_user
import db
import providers
import config
from plugins.loader import get_all_plugins, load_plugin, unload_plugin

router = APIRouter()

PLUGINS_DIR = Path(__file__).parent.parent.parent / "plugins"

class PluginStatusUpdate(BaseModel):
    id: str
    enabled: bool

@router.get("")
async def list_plugins(user: dict = Depends(get_current_user)):
    """Return all discovered plugins and their status."""
    plugins = await get_all_plugins()
    # Ensure they have all needed fields for the UI
    for p in plugins:
        p["id"] = p.get("id", p.get("name", "").lower().replace(" ", "_"))
        p["author"] = p.get("author", "Community")
        p["description"] = p.get("description", "No description provided.")
    return {"plugins": plugins}

@router.put("/status")
async def update_plugin_status(body: PluginStatusUpdate, user: dict = Depends(get_current_user)):
    """Enable or disable a plugin at runtime."""
    from bot import bot
    
    # Update DB first
    await db.set_plugin_status(body.id, body.enabled)
    
    # Try to load/unload in real-time
    if body.enabled:
        success, message = await load_plugin(bot, body.id)
    else:
        success, message = await unload_plugin(bot, body.id)
    
    if success:
        # Sync the command tree so the new commands appear in Discord
        if bot.is_ready():
            bot.loop.create_task(bot.tree.sync())
    else:
        # Revert DB if bot operation failed
        await db.set_plugin_status(body.id, not body.enabled)
        raise HTTPException(status_code=400, detail=message)
        
    return {"status": "ok", "message": message}

@router.post("/upload")
async def upload_plugin(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload and install a plugin from a ZIP or convert a JS file."""
    if file.filename.endswith(".js"):
        return await _convert_js_plugin(file)
    
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP or JS files are allowed")

    # Create a temporary directory to extract and validate
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        zip_path = temp_path / "plugin.zip"
        
        # Save uploaded file
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                manifest_file = next((f for f in file_list if f.endswith("manifest.json")), None)
                
                if not manifest_file:
                    raise HTTPException(status_code=400, detail="No manifest.json found in ZIP")
                
                zip_ref.extractall(temp_path)
                
                actual_manifest_path = temp_path / manifest_file
                with open(actual_manifest_path, "r") as f:
                    manifest = json.load(f)
                
                if not all(k in manifest for k in ["name", "version", "cog"]):
                    raise HTTPException(status_code=400, detail="Invalid manifest.json: missing required fields")
                
                plugin_id = manifest.get("name").lower().replace(" ", "_")
                target_dir = PLUGINS_DIR / plugin_id
                
                if target_dir.exists():
                    shutil.rmtree(target_dir)
                
                source_dir = actual_manifest_path.parent
                shutil.copytree(source_dir, target_dir)
                
                return {"status": "ok", "message": f"Plugin '{manifest['name']}' installed successfully", "plugin_id": plugin_id}
                
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP file")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to install plugin: {str(e)}")

@router.delete("/{plugin_id}")
async def delete_plugin(plugin_id: str, user: dict = Depends(get_current_user)):
    """Uninstall a plugin and remove its files."""
    from bot import bot
    
    target_dir = PLUGINS_DIR / plugin_id
    if not target_dir.exists():
        raise HTTPException(status_code=404, detail="Plugin not found")

    # Try to unload first if active
    await unload_plugin(bot, plugin_id)
    
    # Remove from DB
    await db.set_plugin_status(plugin_id, False)
    
    # Delete files
    shutil.rmtree(target_dir)
    
    # Sync tree to remove commands
    if bot.is_ready():
        bot.loop.create_task(bot.tree.sync())

    return {"status": "ok", "message": f"Plugin '{plugin_id}' deleted successfully"}

async def _convert_js_plugin(file: UploadFile):
    """Use AI to convert a JS Discord plugin to a SparkSage Python Cog."""
    import re
    js_content = (await file.read()).decode("utf-8")
    
    prompt = f"""
    Convert the following JavaScript Discord plugin (discord.js) into a SparkSage-compatible Python Cog (discord.py).
    
    REQUIREMENTS:
    1. Use a Python class that inherits from commands.Cog.
    2. Use standard discord.py command decorators (@commands.command or @app_commands.command).
    3. Include a 'setup' function at the bottom: async def setup(bot): await bot.add_cog(ClassName(bot)).
    4. Provide the result as a JSON object with two fields:
       - "code": The full Python code.
       - "manifest": A valid JSON manifest containing "name", "version", "description", "author", and "cog" (the filename without .py).

    IMPORTANT: Ensure the JSON is valid and all newlines in the Python code are properly escaped as \\n.

    JAVASCRIPT CODE:
    {js_content}
    
    Return ONLY the JSON object.
    """

    try:
        response_text, _ = await providers.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are an expert developer specializing in porting Discord bots from JS to Python."
        )
        
        # Robust JSON extraction: look for { ... }
        # This handles cases where the LLM includes markdown or preamble text
        json_match = re.search(r"(\{.*\})", response_text, re.DOTALL)
        if not json_match:
            # Fallback to original logic if regex fails
            clean_json = response_text.strip().replace("```json", "").replace("```", "").strip()
        else:
            clean_json = json_match.group(1)
            
        # strict=False allows control characters like literal newlines or tabs in strings
        result = json.loads(clean_json, strict=False)
        
        code = result["code"]
        manifest = result["manifest"]
        
        plugin_name = manifest["name"].lower().replace(" ", "_")
        target_dir = PLUGINS_DIR / plugin_name
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Save code and manifest
        cog_filename = f"{manifest['cog']}.py"
        with open(target_dir / cog_filename, "w", encoding="utf-8") as f:
            f.write(code)
            
        with open(target_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=4)
            
        return {
            "status": "ok", 
            "message": f"AI converted and installed '{manifest['name']}' successfully!",
            "plugin_id": plugin_name
        }

    except Exception as e:
        # Log the raw response for debugging in the backend console
        print(f"AI Conversion Parsing Error: {e}")
        print(f"Raw AI Response: {response_text}")
        raise HTTPException(status_code=500, detail=f"AI conversion failed: {str(e)}")
