from discord.ext import commands
from discord import app_commands
import discord
from utils.bot_utils import ask_ai

class Trivia(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="trivia", description="Play a quick trivia game (Plugin Example)")
    async def play_trivia(self, interaction: discord.Interaction):
        await interaction.response.defer()
        
        prompt = "You are a trivia game host. Generate ONE random, interesting trivia question and provide the answer. Format it as: 'Question: ... \n\nAnswer: (Hidden with ||spoiler tags||)'"
        
        response, _ = await ask_ai(
            interaction.channel_id,
            "System",
            "Give me a random trivia question.",
            system_prompt=prompt,
            category="trivia-plugin"
        )
        
        await interaction.followup.send(f"🧩 **Trivia Plugin:**\n{response}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Trivia(bot))
