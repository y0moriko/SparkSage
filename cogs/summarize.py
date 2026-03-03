from discord.ext import commands
from discord import app_commands
import discord
from utils.bot_utils import ask_ai, get_history
from utils.permissions import has_command_permission
import db

class Summarize(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="summarize", description="Summarize the recent conversation in this channel")
    @has_command_permission()
    async def summarize(self, interaction: discord.Interaction):
        await interaction.response.defer()
        
        # Log command usage
        await db.add_analytics_event(
            event_type="command",
            guild_id=str(interaction.guild_id) if interaction.guild else None,
            channel_id=str(interaction.channel_id),
            user_id=str(interaction.user.id),
            provider="command:summarize"
        )

        history = await get_history(interaction.channel_id)
        if not history:
            await interaction.followup.send("No conversation history to summarize.")
            return

        summary_prompt = "Please summarize the key points from this conversation so far in a concise bullet-point format."
        response, provider_name = await ask_ai(
            interaction.channel_id, 
            interaction.user.display_name, 
            summary_prompt,
            guild_id=str(interaction.guild_id) if interaction.guild else None,
            user_id=str(interaction.user.id)
        )
        await interaction.followup.send(f"**Conversation Summary:**\n{response}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Summarize(bot))
