import discord
from discord.ext import commands
from discord import app_commands
import config
import providers
import db as database
from utils.permissions import has_command_permission
import asyncio

TRANSLATE_PROMPT = """You are a professional translator. 
Translate the provided text into the target language. 
Maintain the original tone and context.
Respond ONLY with the translated text, no extra explanations or quotes.
"""

AUTO_TRANSLATE_PROMPT = """You are an automatic language detector and translator. 
If the following message is NOT in {target_lang}, translate it into {target_lang}.
If it is already in {target_lang}, respond with "ALREADY_IN_TARGET".
Maintain the original tone. Respond ONLY with the translation or "ALREADY_IN_TARGET".
"""

class Translate(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        enabled = getattr(config, "TRANSLATION_ENABLED", False)
        channel_ids = getattr(config, "TRANSLATION_CHANNEL_IDS", "")
        
        if not enabled or not channel_ids or message.author.bot or not message.guild or not message.content:
            return

        # Skip commands
        if message.content.startswith(getattr(config, "BOT_PREFIX", "!")):
            return

        # Check if current channel is designated for translation
        # '*' means all channels
        if channel_ids.strip() != "*":
            allowed_channels = [c.strip() for c in channel_ids.split(",") if c.strip()]
            if str(message.channel.id) not in allowed_channels:
                return

        # Simple heuristic: skip short messages (less than 10 chars)
        if len(message.content) < 10:
            return

        print(f"DEBUG: Auto-translating message in #{message.channel.name} ({message.channel.id})")
        asyncio.create_task(self.auto_translate(message))

    async def auto_translate(self, message: discord.Message):
        target_lang = getattr(config, "TRANSLATION_TARGET_LANG", "English")
        prompt = AUTO_TRANSLATE_PROMPT.format(target_lang=target_lang)
        
        try:
            messages = [{"role": "user", "content": message.content}]
            response, provider_name = providers.chat(messages, prompt)
            
            clean_res = response.strip().upper()
            if "ALREADY_IN_TARGET" in clean_res:
                return

            # Post translation
            embed = discord.Embed(
                description=response,
                color=discord.Color.blue()
            )
            provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
            embed.set_footer(text=f"Auto-translated to {target_lang} via {provider_label}")
            
            await message.reply(embed=embed, mention_author=False)
            
        except Exception as e:
            print(f"Auto-translate Error: {e}")

    @app_commands.command(name="translate", description="Translate text to another language")
    @app_commands.describe(
        text="The text you want to translate",
        target_language="The language to translate into (e.g. English, Japanese, Tagalog)"
    )
    @has_command_permission()
    async def translate(self, interaction: discord.Interaction, text: str, target_language: str):
        await interaction.response.defer()
        
        user_message = f"Translate the following text to {target_language}:\n\n{text}"
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
            
            # Log to DB
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
