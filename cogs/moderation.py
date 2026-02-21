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
        # Use getattr for safety in case config isn't fully reloaded yet
        enabled = getattr(config, "MODERATION_ENABLED", False)
        log_channel_id = getattr(config, "MOD_LOG_CHANNEL_ID", "")
        
        if not enabled or not log_channel_id:
            return
        
        if message.author.bot or not message.guild or not message.content:
            return

        # Skip if message is from an administrator (DISABLED FOR TESTING)
        # if message.author.guild_permissions.administrator:
        #     return

        # Run AI moderation check in background
        asyncio.create_task(self.check_message(message))

    async def check_message(self, message: discord.Message):
        sensitivity = getattr(config, "MODERATION_SENSITIVITY", "medium")
        prompt = MODERATION_PROMPT.format(sensitivity=sensitivity)
        messages = [{"role": "user", "content": message.content}]
        
        print(f"DEBUG: Checking message: '{message.content}' with sensitivity: {sensitivity}")
        
        try:
            response_text, _ = providers.chat(messages, prompt)
            print(f"DEBUG: AI Response: {response_text}")
            
            # Clean response text
            cleaned_json = response_text.strip()
            # Find the first { and last }
            start_idx = cleaned_json.find('{')
            end_idx = cleaned_json.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                cleaned_json = cleaned_json[start_idx:end_idx+1]
                result = json.loads(cleaned_json)
                
                print(f"DEBUG: Parsed Result: flagged={result.get('flagged')}, severity={result.get('severity')}")
                
                if result.get("flagged"):
                    await self.log_flagged_message(message, result)
                
        except Exception as e:
            print(f"Moderation Error: {e}")

    async def log_flagged_message(self, message: discord.Message, result: dict):
        try:
            log_channel_id = getattr(config, "MOD_LOG_CHANNEL_ID", "")
            if not log_channel_id:
                return
                
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
        except Exception as e:
            print(f"Moderation Log Error: {e}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
