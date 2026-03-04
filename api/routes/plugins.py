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
    """Upload and install a plugin from a ZIP file."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are allowed")

    # Create a temporary directory to extract and validate
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        zip_path = temp_path / "plugin.zip"
        
        # Save uploaded file
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Check for manifest.json in the zip
                # Some zips might have a top-level folder, others might not
                file_list = zip_ref.namelist()
                manifest_file = next((f for f in file_list if f.endswith("manifest.json")), None)
                
                if not manifest_file:
                    raise HTTPException(status_code=400, detail="No manifest.json found in ZIP")
                
                # Extract to temp dir to read manifest
                zip_ref.extractall(temp_path)
                
                actual_manifest_path = temp_path / manifest_file
                with open(actual_manifest_path, "r") as f:
                    manifest = json.load(f)
                
                # Basic validation
                if not all(k in manifest for k in ["name", "version", "cog"]):
                    raise HTTPException(status_code=400, detail="Invalid manifest.json: missing required fields")
                
                # Determine target folder name (using name from manifest, sanitized)
                plugin_id = manifest.get("name").lower().replace(" ", "_")
                target_dir = PLUGINS_DIR / plugin_id
                
                # If plugin exists, remove it first (update)
                if target_dir.exists():
                    shutil.rmtree(target_dir)
                
                # Move extracted content to plugins directory
                # If manifest was inside a folder, we need to move that folder's contents
                source_dir = actual_manifest_path.parent
                shutil.copytree(source_dir, target_dir)
                
                return {"status": "ok", "message": f"Plugin '{manifest['name']}' installed successfully", "plugin_id": plugin_id}
                
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP file")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to install plugin: {str(e)}")
