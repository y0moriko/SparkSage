from __future__ import annotations
import os
import json
import importlib
import sys
from pathlib import Path
import db

PLUGINS_DIR = Path(__file__).parent

async def get_all_plugins() -> list[dict]:
    """Scan the plugins directory for valid plugins."""
    plugins = []
    if not PLUGINS_DIR.exists():
        return []

    # Get enabled states from DB
    states = await db.list_plugin_states()

    for item in PLUGINS_DIR.iterdir():
        if item.is_dir():
            manifest_path = item / "manifest.json"
            if manifest_path.exists():
                try:
                    with open(manifest_path, "r", encoding="utf-8-sig") as f:
                        manifest = json.load(f)
                    
                    # Ensure essential fields
                    if all(k in manifest for k in ["name", "version", "cog"]):
                        manifest["id"] = item.name
                        manifest["enabled"] = states.get(manifest["id"], False)
                        manifest["path"] = str(item)
                        manifest["commands"] = manifest.get("commands", [])
                        plugins.append(manifest)
                except Exception as e:
                    print(f"Error loading manifest for plugin {item.name}: {e}")
    
    return plugins

async def load_enabled_plugins(bot):
    """Load all plugins marked as enabled in the database."""
    plugins = await get_all_plugins()
    for plugin in plugins:
        if plugin["enabled"]:
            await load_plugin(bot, plugin["id"])

async def load_plugin(bot, plugin_id: str):
    """Dynamically load a plugin's cog."""
    manifest_path = PLUGINS_DIR / plugin_id / "manifest.json"
    if not manifest_path.exists():
        return False, "Manifest not found"

    try:
        with open(manifest_path, "r", encoding="utf-8-sig") as f:
            manifest = json.load(f)
        
        cog_file = manifest["cog"]
        # Use full module path for importing
        module_path = f"plugins.{plugin_id}.{cog_file.replace('.py', '')}"
        
        # Reload if already in sys.modules to pick up changes
        if module_path in sys.modules:
            importlib.reload(sys.modules[module_path])
        
        await bot.load_extension(module_path)
        print(f"Successfully loaded plugin: {manifest['name']}")
        return True, "Loaded successfully"
    except Exception as e:
        print(f"Failed to load plugin {plugin_id}: {e}")
        return False, str(e)

async def unload_plugin(bot, plugin_id: str):
    """Unload a plugin's cog."""
    manifest_path = PLUGINS_DIR / plugin_id / "manifest.json"
    if not manifest_path.exists():
        return False, "Manifest not found"

    try:
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        
        cog_file = manifest["cog"]
        module_path = f"plugins.{plugin_id}.{cog_file.replace('.py', '')}"
        
        await bot.unload_extension(module_path)
        print(f"Successfully unloaded plugin: {manifest['name']}")
        return True, "Unloaded successfully"
    except Exception as e:
        print(f"Failed to unload plugin {plugin_id}: {e}")
        return False, str(e)
