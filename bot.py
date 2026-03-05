from __future__ import annotations

import discord
from discord.ext import commands, tasks
import config
import providers
import db as database
from utils.bot_utils import ask_ai
from plugins.loader import load_enabled_plugins

class SparkSageBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        super().__init__(command_prefix=config.BOT_PREFIX, intents=intents)
        self.config_version = "0"

    async def setup_hook(self):
        # Initialize database first
        await database.init_db()
        await database.sync_env_to_db()
        
        # Initial config version
        self.config_version = await database.get_config_version()

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
            "cogs.translate",
            "cogs.prompts",
            "cogs.custom_commands",
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

        # Load community plugins
        await load_enabled_plugins(self)
        
        # Start background tasks
        self.config_check_task.start()

    async def reload_config(self):
        """Reload configuration from database."""
        all_config = await database.get_all_config()
        config.reload_from_db(all_config)
        providers.reload_clients()
        
        # Update command prefix if it changed
        self.command_prefix = config.BOT_PREFIX
        print(f"Bot configuration reloaded (Version: {self.config_version})")

    @tasks.loop(seconds=30)
    async def config_check_task(self):
        """Periodically check if configuration has been updated via the dashboard."""
        new_version = await database.get_config_version()
        if new_version != self.config_version:
            self.config_version = new_version
            await self.reload_config()

    @config_check_task.before_loop
    async def before_config_check(self):
        await self.wait_until_ready()

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


def get_guild_channels(guild_id: str) -> list[dict]:
    """Return all text channels for a given guild."""
    guild = bot.get_guild(int(guild_id))
    if not guild:
        return []
    
    # Return basic info for text channels the bot can see
    return [
        {"id": str(c.id), "name": c.name, "type": str(c.type)}
        for c in guild.text_channels
        if c.permissions_for(guild.me).view_channel
    ]


def get_guild_roles(guild_id: str) -> list[dict]:
    """Return all roles for a given guild."""
    guild = bot.get_guild(int(guild_id))
    if not guild:
        return []
    
    return [
        {"id": str(r.id), "name": r.name}
        for r in guild.roles
        if not r.managed and r.name != "@everyone"
    ]


# --- Events ---


@bot.event
async def on_ready():
    available = providers.get_available_providers()
    primary = config.AI_PROVIDER
    provider_info = config.PROVIDERS.get(primary, {})

    print(f"SparkSage is online as {bot.user}")
    print(f"Primary provider: {provider_info.get('name', primary)} ({provider_info.get('model', '?')})")
    print(f"Fallback chain: {' -> '.join(available)}")


def _format_provider_name(provider_name: str) -> str:
    """Formats provider names for display in the footer."""
    if provider_name == "gemini":
        return "Google Gemini"
    elif provider_name == "groq":
        return "Groq"
    elif provider_name == "openrouter":
        return "OpenRouter"
    elif provider_name == "anthropic":
        return "Anthropic Claude"
    elif provider_name == "openai":
        return "OpenAI"
    return provider_name.capitalize() # Default capitalization


@bot.event
async def on_message(message: discord.Message):
    if message.author == bot.user:
        return

    # Respond when mentioned
    if bot.user in message.mentions:
        clean_content = message.content.replace(f"<@{bot.user.id}>", "").strip()
        if not clean_content:
            clean_content = "Hello!"

        # Handle image attachments for vision
        image_url = None
        if message.attachments:
            for attachment in message.attachments:
                if any(attachment.filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]):
                    image_url = attachment.url
                    break

        async with message.channel.typing():
            response, provider_name = await ask_ai(
                message.channel.id, 
                message.author.display_name, 
                clean_content,
                guild_id=str(message.guild.id) if message.guild else None,
                user_id=str(message.author.id),
                image_url=image_url
            )

        # Add provider footer if a valid provider was used
        if provider_name and provider_name != "none":
            formatted_provider_name = _format_provider_name(provider_name)
            footer = f"\n\n_Powered by {formatted_provider_name}_"
            
            response_chunks = []
            current_chunk = ""

            # Build chunks, ensuring footer fits the last one or is sent separately
            # This handles responses potentially exceeding 2000 chars.
            full_response_with_footer = response + footer

            for i in range(0, len(full_response_with_footer), 2000):
                response_chunks.append(full_response_with_footer[i : i + 2000])

            # Send all response chunks
            for chunk in response_chunks:
                await message.reply(chunk)
            
        else:
            # If no valid provider, just send the response (without footer)
            response_chunks = [response[i:i+2000] for i in range(0, len(response), 2000)]
            for chunk in response_chunks:
                await message.reply(chunk)


    await bot.process_commands(message)


# --- Run ---


def main():
    if not config.DISCORD_TOKEN or config.DISCORD_TOKEN == "NOT_SET":
        print("Error: DISCORD_TOKEN not set. Use the Dashboard or edit .env to provide one.")
        return

    available = providers.get_available_providers()
    if not available:
        print("Error: No AI providers configured. Add at least one API key via the Dashboard.")
        print("Free options: GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY")
        return

    bot.run(config.DISCORD_TOKEN)


if __name__ == "__main__":
    main()
