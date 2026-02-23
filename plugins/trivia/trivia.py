from discord.ext import commands
from discord import app_commands
import discord

class Trivia(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="trivia", description="Play a quick trivia game (Plugin Example)")
    async def play_trivia(self, interaction: discord.Interaction):
        await interaction.response.send_message("🧩 **Trivia Plugin:** What is the capital of France? (Answer: Paris)")

async def setup(bot: commands.Bot):
    await bot.add_cog(Trivia(bot))
