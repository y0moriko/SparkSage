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
        if not getattr(config, "MODERATION_ENABLED", False) or not getattr(config, "MOD_LOG_CHANNEL_ID", ""):
            return
        
        if message.author.bot or not message.guild or not message.content:
            return

        # Skip if message is from an administrator
        if message.author.guild_permissions.administrator:
            return

        # Run AI moderation check in background
        asyncio.create_task(self.check_message(message))

    async def check_message(self, message: discord.Message):
        sensitivity = getattr(config, "MODERATION_SENSITIVITY", "medium")
        prompt = MODERATION_PROMPT.format(sensitivity=sensitivity)
        messages = [{"role": "user", "content": message.content}]
        
        try:
            response_text, _ = providers.chat(messages, prompt)
            
            # Clean response text in case AI added markdown or extra text
            cleaned_json = response_text.strip()
            if "```json" in cleaned_json:
                cleaned_json = cleaned_json.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned_json:
                cleaned_json = cleaned_json.split("```")[1].split("```")[0].strip()
            
            # Remove any stray characters before/after the JSON object
            start_idx = cleaned_json.find('{')
            end_idx = cleaned_json.rfind('}')
            if start_idx != -1 and end_idx != -1:
                cleaned_json = cleaned_json[start_idx:end_idx+1]
            
            result = json.loads(cleaned_json)
            
            if result.get("flagged"):
                await self.log_flagged_message(message, result)
                
        except Exception as e:
            # We don't want moderation errors to spam logs or crash the bot
            print(f"Moderation Error: {e}")

    async def log_flagged_message(self, message: discord.Message, result: dict):
        try:
            channel_id_str = getattr(config, "MOD_LOG_CHANNEL_ID", "")
            if not channel_id_str:
                return
                
            channel_id = int(channel_id_str)
            log_channel = self.bot.get_channel(channel_id)
            
            if not log_channel:
                try:
                    log_channel = await self.bot.fetch_channel(channel_id)
                except:
                    print(f"Moderation Error: Could not find log channel {channel_id}")
                    return

            reason = result.get("reason", "Unknown reason")
            severity = result.get("severity", "medium").lower()
            
            # Color based on severity
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
            
            # Add buttons for actions
            view = discord.ui.View()
            view.add_item(discord.ui.Button(label="Keep", style=discord.ButtonStyle.secondary, custom_id="mod_keep"))
            view.add_item(discord.ui.Button(label="Delete", style=discord.ButtonStyle.danger, custom_id="mod_delete"))
            
            await log_channel.send(embed=embed, view=view)
            
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
