import discord
from discord.ext import commands
import config
import db

class Onboarding(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        # Get server-specific config
        guild_cfg = await db.get_guild_config(str(member.guild.id))
        
        # Fallback to global config if no server config exists
        enabled = guild_cfg["welcome_enabled"] if guild_cfg else config.WELCOME_ENABLED
        channel_id = guild_cfg["welcome_channel_id"] if guild_cfg else config.WELCOME_CHANNEL_ID
        message_template = guild_cfg["welcome_message"] if guild_cfg else config.WELCOME_MESSAGE

        if not enabled or not channel_id:
            return

        try:
            channel = self.bot.get_channel(int(channel_id))
            if not channel:
                channel = await self.bot.fetch_channel(int(channel_id))
        except Exception:
            print(f"Onboarding Error: Could not find welcome channel with ID {channel_id}")
            return

        # Format the message
        welcome_text = message_template.replace("{user}", member.mention).replace("{server}", member.guild.name)
        
        try:
            await channel.send(welcome_text)
        except Exception as e:
            print(f"Onboarding Error: Failed to send welcome message: {e}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Onboarding(bot))
