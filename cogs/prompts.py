import discord
from discord.ext import commands
from discord import app_commands
import db as database
import config
import providers
from utils.permissions import has_command_permission

class Prompts(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    prompt_group = app_commands.Group(
        name="prompt", 
        description="Manage channel-specific AI personalities",
        default_permissions=discord.Permissions(manage_channels=True)
    )

    @prompt_group.command(name="set", description="Set a custom system prompt for this channel")
    @app_commands.describe(text="The system prompt defining the AI personality for this channel")
    @has_command_permission()
    async def set_prompt(self, interaction: discord.Interaction, text: str):
        await database.set_channel_prompt(str(interaction.channel_id), str(interaction.guild_id), text)
        await interaction.response.send_message(
            f"✅ Custom system prompt set for this channel.\n**Preview:** {text[:100]}...", 
            ephemeral=True
        )

    @prompt_group.command(name="reset", description="Reset to the global default system prompt")
    @has_command_permission()
    async def reset_prompt(self, interaction: discord.Interaction):
        await database.delete_channel_prompt(str(interaction.channel_id))
        await interaction.response.send_message("✅ Reset to global default system prompt.", ephemeral=True)

    provider_group = app_commands.Group(
        name="channel-provider", 
        description="Override the AI provider for this channel",
        default_permissions=discord.Permissions(manage_channels=True)
    )

    async def provider_autocomplete(self, interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
        all_providers = list(config.PROVIDERS.keys())
        return [
            app_commands.Choice(name=config.PROVIDERS[p]["name"], value=p)
            for p in all_providers if current.lower() in p.lower() or current.lower() in config.PROVIDERS[p]["name"].lower()
        ]

    @provider_group.command(name="set", description="Force a specific AI provider for this channel")
    @app_commands.describe(provider="The ID of the provider to use")
    @app_commands.autocomplete(provider=provider_autocomplete)
    @has_command_permission()
    async def set_provider(self, interaction: discord.Interaction, provider: str):
        if provider not in config.PROVIDERS:
            await interaction.response.send_message(f"Invalid provider: `{provider}`", ephemeral=True)
            return

        await database.set_channel_provider(str(interaction.channel_id), str(interaction.guild_id), provider)
        await interaction.response.send_message(
            f"✅ This channel is now forced to use **{config.PROVIDERS[provider]['name']}**.", 
            ephemeral=True
        )

    @provider_group.command(name="reset", description="Reset to the global default AI provider")
    @has_command_permission()
    async def reset_provider(self, interaction: discord.Interaction):
        await database.delete_channel_provider(str(interaction.channel_id))
        await interaction.response.send_message("✅ Reset to global default AI provider.", ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(Prompts(bot))
