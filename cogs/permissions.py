import discord
from discord.ext import commands
from discord import app_commands
import db as database
from utils.permissions import has_command_permission

class Permissions(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    permissions_group = app_commands.Group(
        name="permissions", 
        description="Manage role-based command permissions",
        default_permissions=discord.Permissions(administrator=True)
    )

    @permissions_group.command(name="set", description="Require a role for a command")
    @app_commands.describe(
        command="The name of the command to restrict",
        role="The role that will be allowed to use this command"
    )
    @has_command_permission()
    async def set_permission(self, interaction: discord.Interaction, command: str, role: discord.Role):
        # Validate command name exists in bot
        all_commands = [cmd.name for cmd in self.bot.tree.get_commands()]
        if command not in all_commands:
            await interaction.response.send_message(f"Command `/{command}` not found.", ephemeral=True)
            return

        await database.add_command_permission(command, str(interaction.guild_id), str(role.id))
        await interaction.response.send_message(f"Command `/{command}` now requires the {role.mention} role.", ephemeral=True)

    @permissions_group.command(name="remove", description="Remove a role restriction from a command")
    @app_commands.describe(
        command="The name of the command",
        role="The role to remove"
    )
    @has_command_permission()
    async def remove_permission(self, interaction: discord.Interaction, command: str, role: discord.Role):
        await database.remove_command_permission(command, str(interaction.guild_id), str(role.id))
        await interaction.response.send_message(f"Removed restriction for {role.mention} on `/{command}`.", ephemeral=True)

    @permissions_group.command(name="list", description="List all command restrictions for this server")
    @has_command_permission()
    async def list_permissions(self, interaction: discord.Interaction):
        perms = await database.get_guild_permissions(str(interaction.guild_id))
        if not perms:
            await interaction.response.send_message("No command restrictions configured.", ephemeral=True)
            return

        embed = discord.Embed(title="Command Permissions", color=discord.Color.gold())
        
        # Group by command
        grouped = {}
        for p in perms:
            cmd = p['command_name']
            role_id = p['role_id']
            if cmd not in grouped: grouped[cmd] = []
            grouped[cmd].append(f"<@&{role_id}>")
            
        for cmd, roles in grouped.items():
            embed.add_field(name=f"/{cmd}", value=", ".join(roles), inline=False)
            
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(Permissions(bot))
