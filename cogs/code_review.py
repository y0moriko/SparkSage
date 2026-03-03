from discord.ext import commands
from discord import app_commands
import discord
import config
from utils.bot_utils import ask_ai
from utils.permissions import has_command_permission
import db

CODE_REVIEW_PROMPT = """You are a senior code reviewer. Analyze the code for:
1. Bugs and potential errors
2. Style and best practices
3. Performance improvements
4. Security concerns

Provide your feedback in a structured way. Use markdown code blocks with appropriate syntax highlighting for any code suggestions.
"""

class CodeReview(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="review", description="Review a code snippet for bugs and improvements")
    @app_commands.describe(
        code="The code snippet to review",
        language="Programming language (optional, for better highlighting)"
    )
    @has_command_permission()
    async def review(self, interaction: discord.Interaction, code: str, language: str | None = None):
        await interaction.response.defer()
        
        # Log command usage
        await db.add_analytics_event(
            event_type="command",
            guild_id=str(interaction.guild_id) if interaction.guild else None,
            channel_id=str(interaction.channel_id),
            user_id=str(interaction.user.id),
            provider="command:review"
        )

        # Prepare the message for AI
        lang_hint = f" (Language: {language})" if language else ""
        message = f"Please review this code{lang_hint}:\n\n```{language or ''}\n{code}\n```"
        
        response, provider_name = await ask_ai(
            interaction.channel_id, 
            interaction.user.display_name, 
            message,
            system_prompt=CODE_REVIEW_PROMPT,
            category="code-review",
            guild_id=str(interaction.guild_id) if interaction.guild else None,
            user_id=str(interaction.user.id)
        )
        
        provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
        footer = f"\n-# Code Review Powered by {provider_label}"

        # Combine response and footer for length check
        full_response = response + footer

        if len(full_response) <= 2000:
            await interaction.followup.send(full_response)
        else:
            # Split if too long
            for i in range(0, len(response), 1900):
                chunk = response[i : i + 1900]
                if i + 1900 >= len(response):
                    chunk += footer
                await interaction.followup.send(chunk)

async def setup(bot: commands.Bot):
    await bot.add_cog(CodeReview(bot))
