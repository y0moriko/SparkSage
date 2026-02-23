import discord
from discord.ext import commands, tasks
from discord import app_commands
import config
import providers
import datetime
import asyncio
from utils.permissions import has_command_permission
import db

class Digest(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.last_run_date = None
        self.daily_digest.start()

    def cog_unload(self):
        self.daily_digest.cancel()

    digest_group = app_commands.Group(
        name="digest", 
        description="Manage daily server summaries",
        default_permissions=discord.Permissions(manage_guild=True)
    )

    @tasks.loop(minutes=1)
    async def daily_digest(self):
        try:
            now = datetime.datetime.now()
            current_time = now.strftime("%H:%M")
            today = now.date()

            # Iterate through all guilds the bot is in
            for guild in self.bot.guilds:
                # Get server-specific config
                guild_cfg = await db.get_guild_config(str(guild.id))
                
                # Use server settings OR fallback to global (if enabled globally)
                enabled = guild_cfg["digest_enabled"] if guild_cfg else config.DIGEST_ENABLED
                target_channel_id = guild_cfg["digest_channel_id"] if guild_cfg else config.DIGEST_CHANNEL_ID
                digest_time = guild_cfg["digest_time"] if guild_cfg else config.DIGEST_TIME

                if not enabled or not target_channel_id or not digest_time:
                    continue

                # Use a specific key for last run per guild
                last_run_key = f"last_run_{guild.id}"
                last_run = getattr(self, last_run_key, None)

                if current_time == digest_time and last_run != today:
                    setattr(self, last_run_key, today)
                    await self.run_server_digest(guild, target_channel_id)
        except Exception as e:
            print(f"Digest Task Error: {e}")

    async def run_server_digest(self, guild: discord.Guild, channel_id: str):
        print(f"Running daily digest for {guild.name} at {datetime.datetime.now()}")
        
        try:
            target_channel = self.bot.get_channel(int(channel_id))
            if not target_channel:
                target_channel = await guild.fetch_channel(int(channel_id))
        except Exception:
            print(f"Digest Error: Could not find target channel {channel_id} in {guild.name}")
            return

        # Collect activity from last 24h for THIS server
        yesterday = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
        summary_data = []

        for channel in guild.text_channels:
            # Basic permission check
            perms = channel.permissions_for(guild.me)
            if not perms.read_messages or not perms.read_message_history:
                continue
            
            try:
                messages = []
                async for msg in channel.history(after=yesterday, limit=50):
                    if not msg.author.bot and msg.clean_content:
                        messages.append(f"{msg.author.display_name}: {msg.clean_content}")
                
                if messages:
                    summary_data.append(f"--- Channel: #{channel.name} ---")
                    summary_data.extend(messages[-15:]) 
            except Exception as e:
                print(f"Error fetching history for #{channel.name}: {e}")

        if not summary_data:
            return

        # Summarize with AI
        activity_text = "\n".join(summary_data)
        if len(activity_text) > 15000:
            activity_text = activity_text[:15000] + "\n... (truncated)"

        prompt = "You are an activity summarizer. Below is a log of messages from various Discord channels over the past 24 hours. Create a concise, engaging 'Daily Digest' summary highlighting the key discussions, decisions, and highlights. Use bullet points and group by channel where appropriate."
        
        try:
            messages = [{"role": "user", "content": f"Here is the activity log:\n\n{activity_text}"}]
            response, provider_name = await providers.chat(
                messages, 
                prompt,
                guild_id=str(guild.id),
                channel_id=str(channel_id),
                user_id="system:digest"
            )
            
            embed = discord.Embed(
                title=f"📅 Daily Digest - {datetime.datetime.now().strftime('%B %d, %Y')}",
                description=response[:4000],
                color=discord.Color.purple()
            )
            embed.set_footer(text=f"Powered by {provider_name}")
            await target_channel.send(embed=embed)
            
        except Exception as e:
            print(f"Digest Error during AI summary for {guild.name}: {e}")

    @digest_group.command(name="run", description="Manually trigger the daily digest summary")
    @has_command_permission()
    async def run_manual_digest(self, interaction: discord.Interaction):
        # Get server-specific config
        guild_cfg = await db.get_guild_config(str(interaction.guild_id))
        target_channel_id = guild_cfg["digest_channel_id"] if guild_cfg else config.DIGEST_CHANNEL_ID

        if not target_channel_id:
            await interaction.response.send_message("Error: Digest channel is not configured for this server.", ephemeral=True)
            return

        await interaction.response.send_message("Starting manual digest generation...", ephemeral=True)
        await self.run_server_digest(interaction.guild, target_channel_id)

    @daily_digest.before_loop
    async def before_daily_digest(self):
        await self.bot.wait_until_ready()

async def setup(bot: commands.Bot):
    await bot.add_cog(Digest(bot))
