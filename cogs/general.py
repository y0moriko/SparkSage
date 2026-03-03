from discord.ext import commands
from discord import app_commands
import discord
import config
import providers
import db as database
from utils.bot_utils import ask_ai
from utils.permissions import has_command_permission

class General(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="ask", description="Ask SparkSage a question")
    @app_commands.describe(question="Your question for SparkSage")
    @has_command_permission()
    async def ask(self, interaction: discord.Interaction, question: str):
        await interaction.response.defer()
        
        # Log command usage
        await database.add_analytics_event(
            event_type="command",
            guild_id=str(interaction.guild_id) if interaction.guild else None,
            channel_id=str(interaction.channel_id),
            user_id=str(interaction.user.id),
            provider="command:ask"
        )

        response, provider_name = await ask_ai(
            interaction.channel_id, 
            interaction.user.display_name, 
            question,
            guild_id=str(interaction.guild_id) if interaction.guild else None,
            user_id=str(interaction.user.id)
        )
        provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
        footer = f"\n-# Powered by {provider_label}"

        for i in range(0, len(response), 1900):
            chunk = response[i : i + 1900]
            if i + 1900 >= len(response):
                chunk += footer
            await interaction.followup.send(chunk)

    @app_commands.command(name="clear", description="Clear SparkSage's conversation memory for this channel")
    @has_command_permission()
    async def clear(self, interaction: discord.Interaction):
        await database.clear_messages(str(interaction.channel_id))
        await interaction.response.send_message("Conversation history cleared!")

    @app_commands.command(name="provider", description="Show which AI provider SparkSage is currently using")
    @has_command_permission()
    async def provider(self, interaction: discord.Interaction):
        primary = config.AI_PROVIDER
        provider_info = config.PROVIDERS.get(primary, {})
        available = providers.get_available_providers()

        msg = f"**Current Provider:** {provider_info.get('name', primary)}\n"
        msg += f"**Model:** `{provider_info.get('model', '?')}`\n"
        msg += f"**Free:** {'Yes' if provider_info.get('free') else 'No (paid)'}\n"
        msg += f"**Fallback Chain:** {' -> '.join(available)}"
        await interaction.response.send_message(msg)

async def setup(bot: commands.Bot):
    await bot.add_cog(General(bot))
