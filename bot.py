from __future__ import annotations

import discord
from discord.ext import commands
import config
import providers
import db as database
from utils.bot_utils import ask_ai

class SparkSageBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        super().__init__(command_prefix=config.BOT_PREFIX, intents=intents)

    async def setup_hook(self):
        # Initialize database first
        await database.init_db()
        await database.sync_env_to_db()

        # Load cogs
        initial_extensions = [
            "cogs.general",
            "cogs.summarize",
            "cogs.code_review",
            "cogs.faq",
            "cogs.onboarding",
            "cogs.permissions",
            "cogs.digest",
            "cogs.moderation",
        ]
        for extension in initial_extensions:
            try:
                await self.load_extension(extension)
                print(f"Loaded extension: {extension}")
            except Exception as e:
                print(f"Failed to load extension {extension}: {e}")
        
        # Sync slash commands
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} slash command(s)")
        except Exception as e:
            print(f"Failed to sync commands: {e}")

bot = SparkSageBot()


def get_bot_status() -> dict:
    """Return bot status info for the dashboard API."""
    if bot.is_ready():
        return {
            "online": True,
            "username": str(bot.user),
            "latency_ms": round(bot.latency * 1000, 1),
            "guild_count": len(bot.guilds),
            "guilds": [{"id": str(g.id), "name": g.name, "member_count": g.member_count} for g in bot.guilds],
            "commands": [cmd.name for cmd in bot.tree.get_commands()],
        }
    return {"online": False, "username": None, "latency_ms": None, "guild_count": 0, "guilds": []}


# --- Events ---


@bot.event
async def on_ready():
    available = providers.get_available_providers()
    primary = config.AI_PROVIDER
    provider_info = config.PROVIDERS.get(primary, {})

    print(f"SparkSage is online as {bot.user}")
    print(f"Primary provider: {provider_info.get('name', primary)} ({provider_info.get('model', '?')})")
    print(f"Fallback chain: {' -> '.join(available)}")


@bot.event
async def on_message(message: discord.Message):
    if message.author == bot.user:
        return

    # Respond when mentioned
    if bot.user in message.mentions:
        clean_content = message.content.replace(f"<@{bot.user.id}>", "").strip()
        if not clean_content:
            clean_content = "Hello!"

        async with message.channel.typing():
            response, provider_name = await ask_ai(
                message.channel.id, message.author.display_name, clean_content
            )

        # Split long responses (Discord 2000 char limit)
        for i in range(0, len(response), 2000):
            await message.reply(response[i : i + 2000])

    await bot.process_commands(message)


# --- Run ---


def main():
    if not config.DISCORD_TOKEN:
        print("Error: DISCORD_TOKEN not set. Copy .env.example to .env and fill in your tokens.")
        return

    available = providers.get_available_providers()
    if not available:
        print("Error: No AI providers configured. Add at least one API key to .env")
        print("Free options: GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY")
        return

    bot.run(config.DISCORD_TOKEN)


if __name__ == "__main__":
    main()
