import discord
from discord.ext import commands
from discord import app_commands
import config
import providers
import db as database
from utils.permissions import has_command_permission

TRANSLATE_PROMPT = """You are a professional translator. 
Translate the provided text into the target language. 
Maintain the original tone and context.
Respond ONLY with the translated text, no extra explanations or quotes.
"""

class Translate(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="translate", description="Translate text to another language")
    @app_commands.describe(
        text="The text you want to translate",
        target_language="The language to translate into (e.g. English, Japanese, Tagalog)"
    )
    @has_command_permission()
    async def translate(self, interaction: discord.Interaction, text: str, target_language: str):
        await interaction.response.defer()
        
        user_message = f"Translate the following text to {target_language}:

{text}"
        messages = [{"role": "user", "content": user_message}]
        
        try:
            response, provider_name = providers.chat(messages, TRANSLATE_PROMPT)
            
            embed = discord.Embed(
                title="🌍 Translation",
                color=discord.Color.blue()
            )
            embed.add_field(name="Original", value=text[:1024], inline=False)
            embed.add_field(name=f"Translated ({target_language})", value=response[:1024], inline=False)
            
            provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
            embed.set_footer(text=f"Translated by {provider_label}")
            
            await interaction.followup.send(embed=embed)
            
            # Log to DB for dashboard visibility (optional but good for tracking)
            await database.add_message(
                str(interaction.channel_id), 
                "user", 
                f"[Translate to {target_language}]: {text}", 
                category="translation"
            )
            await database.add_message(
                str(interaction.channel_id), 
                "assistant", 
                response, 
                provider=provider_name, 
                category="translation"
            )
            
        except Exception as e:
            await interaction.followup.send(f"❌ Translation failed: {e}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Translate(bot))
