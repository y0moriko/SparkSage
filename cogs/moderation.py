import discord
from discord.ext import commands
from discord import app_commands
import config
import providers
import db as database
import json
import asyncio

MODERATION_PROMPT = """You are a professional content moderator for a Discord server. 
Analyze the following message for toxicity, spam, harassment, and rule violations.
Consider the current sensitivity setting: {sensitivity}.

Respond ONLY with a JSON object in this format:
{{
  "flagged": bool,
  "reason": "short explanation",
  "severity": "low" | "medium" | "high"
}}
"""

class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        # Skip bots and DMs
        if message.author.bot or not message.guild or not message.content:
            return

        # Get server-specific config
        guild_cfg = await database.get_guild_config(str(message.guild.id))
        enabled = guild_cfg["moderation_enabled"] if guild_cfg else getattr(config, "MODERATION_ENABLED", False)
        log_channel_id = guild_cfg["mod_log_channel_id"] if guild_cfg else getattr(config, "MOD_LOG_CHANNEL_ID", "")
        
        if not enabled or not log_channel_id:
            return
        
        # Run AI moderation check in background
        asyncio.create_task(self.check_message(message, log_channel_id, guild_cfg))

    async def check_message(self, message: discord.Message, log_channel_id: str, guild_cfg: dict | None):
        sensitivity = guild_cfg["moderation_sensitivity"] if guild_cfg else getattr(config, "MODERATION_SENSITIVITY", "medium")
        prompt = MODERATION_PROMPT.format(sensitivity=sensitivity)
        messages = [{"role": "user", "content": message.content}]
        
        try:
            response_text, _ = await providers.chat(
                messages, 
                prompt,
                guild_id=str(message.guild.id) if message.guild else None,
                channel_id=str(message.channel.id),
                user_id=str(message.author.id)
            )
            
            # Clean response text
            cleaned_json = response_text.strip()
            start_idx = cleaned_json.find('{')
            end_idx = cleaned_json.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                cleaned_json = cleaned_json[start_idx:end_idx+1]
                result = json.loads(cleaned_json)
                
                if result.get("flagged"):
                    await self.log_flagged_message(message, result, log_channel_id)
                
        except Exception as e:
            print(f"Moderation Error: {e}")

    async def log_flagged_message(self, message: discord.Message, result: dict, log_channel_id: str):
        try:
            channel_id = int(log_channel_id)
            log_channel = self.bot.get_channel(channel_id)
            
            if not log_channel:
                try:
                    log_channel = await self.bot.fetch_channel(channel_id)
                except:
                    print(f"Moderation Error: Could not find log channel {channel_id}")
                    return

            reason = result.get("reason", "Unknown reason")
            severity = result.get("severity", "medium").lower()
            
            print(f"DEBUG: Logging to channel {channel_id}")
            
            colors = {
                "low": discord.Color.blue(),
                "medium": discord.Color.orange(),
                "high": discord.Color.red()
            }
            color = colors.get(severity, discord.Color.greyple())

            embed = discord.Embed(
                title="🚩 Flagged Message",
                description=message.content[:2000],
                color=color,
                timestamp=message.created_at
            )
            embed.add_field(name="Author", value=f"{message.author.mention} (`{message.author.id}`)", inline=True)
            embed.add_field(name="Channel", value=message.channel.mention, inline=True)
            embed.add_field(name="Severity", value=severity.upper(), inline=True)
            embed.add_field(name="Reason", value=reason, inline=False)
            
            await log_channel.send(embed=embed)
            print("DEBUG: Mod log message sent!")
            
            # Save to DB
            await database.add_moderation_event(
                str(message.guild.id),
                str(message.channel.id),
                str(message.author.id),
                str(message.author),
                message.content,
                reason,
                severity
            )

            # Log to Analytics
            await database.add_analytics_event(
                event_type="moderation",
                guild_id=str(message.guild.id),
                channel_id=str(message.channel.id),
                user_id=str(message.author.id),
                provider="moderation:flagged"
            )
        except Exception as e:
            print(f"Moderation Log Error: {e}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
