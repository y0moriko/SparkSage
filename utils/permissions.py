import discord
from discord import app_commands
import db as database

def has_command_permission():
    """Decorator to check if a user has permission to run a command based on RBAC."""
    async def predicate(interaction: discord.Interaction) -> bool:
        if not interaction.guild:
            return True
            
        # Admins bypass checks
        if interaction.user.guild_permissions.administrator:
            return True
            
        command_name = interaction.command.name if interaction.command else None
        if not command_name:
            return True
            
        allowed_roles = await database.get_command_permissions(command_name, str(interaction.guild_id))
        
        # If no roles are set, command is public
        if not allowed_roles:
            return True
            
        # Check if user has any of the allowed roles
        user_role_ids = [str(role.id) for role in interaction.user.roles]
        if any(role_id in allowed_roles for role_id in user_role_ids):
            return True
            
        await interaction.response.send_message(
            "You don't have the required role to use this command.", 
            ephemeral=True
        )
        return False

    return app_commands.check(predicate)
