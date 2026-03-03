from discord.ext import commands
from discord import app_commands
import discord
import db
from plugins.loader import get_all_plugins, load_plugin, unload_plugin
from utils.permissions import has_command_permission

class Plugins(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    plugin_group = app_commands.Group(
        name="plugin", 
        description="Manage community plugins",
        default_permissions=discord.Permissions(administrator=True)
    )

    @plugin_group.command(name="list", description="List all discovered community plugins")
    @has_command_permission()
    async def list_plugins(self, interaction: discord.Interaction):
        plugins = await get_all_plugins()
        if not plugins:
            await interaction.response.send_message("No plugins found in the `plugins/` directory.", ephemeral=True)
            return

        embed = discord.Embed(title="🧩 Community Plugins", color=discord.Color.blue())
        for p in plugins:
            status = "✅ Enabled" if p["enabled"] else "❌ Disabled"
            desc = p.get("description", "No description provided.")
            embed.add_field(
                name=f"{p['name']} v{p['version']}",
                value=f"{desc}
**Status:** {status}
**Author:** {p.get('author', 'Unknown')}",
                inline=False
            )
        
        await interaction.response.send_message(embed=embed)

    @plugin_group.command(name="enable", description="Enable a plugin")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    @has_command_permission()
    async def enable_plugin(self, interaction: discord.Interaction, plugin_id: str):
        await interaction.response.defer(ephemeral=True)
        
        # Update DB
        await db.set_plugin_status(plugin_id, True)
        
        # Load in bot
        success, message = await load_plugin(self.bot, plugin_id)
        if success:
            await interaction.followup.send(f"✅ Plugin `{plugin_id}` enabled and loaded!")
            # Re-sync commands if the plugin added any
            await self.bot.tree.sync()
        else:
            await db.set_plugin_status(plugin_id, False)
            await interaction.followup.send(f"❌ Failed to load plugin: {message}")

    @plugin_group.command(name="disable", description="Disable a plugin")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    @has_command_permission()
    async def disable_plugin(self, interaction: discord.Interaction, plugin_id: str):
        await interaction.response.defer(ephemeral=True)
        
        # Update DB
        await db.set_plugin_status(plugin_id, False)
        
        # Unload from bot
        success, message = await unload_plugin(self.bot, plugin_id)
        if success:
            await interaction.followup.send(f"✅ Plugin `{plugin_id}` disabled and unloaded.")
            await self.bot.tree.sync()
        else:
            await db.set_plugin_status(plugin_id, True)
            await interaction.followup.send(f"❌ Failed to unload plugin: {message}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Plugins(bot))
