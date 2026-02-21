import discord
from discord.ext import commands
from discord import app_commands
import db as database

class FAQ(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        # Check for keywords in the message
        content = message.content.lower()
        faqs = await database.get_faqs(str(message.guild.id))
        
        for faq in faqs:
            keywords = [k.strip().lower() for k in faq['match_keywords'].split(',') if k.strip()]
            if any(k in content for k in keywords):
                await database.increment_faq_usage(faq['id'])
                await message.reply(f"**FAQ: {faq['question']}**
{faq['answer']}")
                return

    @app_commands.command(name="faq", description="Manage FAQ entries")
    @app_commands.describe(
        action="What to do: add, list, or remove",
        question="The question to answer (only for add)",
        answer="The answer (only for add)",
        keywords="Comma-separated keywords to match (only for add)",
        faq_id="The ID of the FAQ to remove (only for remove)"
    )
    @app_commands.choices(action=[
        app_commands.Choice(name="add", value="add"),
        app_commands.Choice(name="list", value="list"),
        app_commands.Choice(name="remove", value="remove"),
    ])
    async def faq_cmd(
        self, 
        interaction: discord.Interaction, 
        action: str,
        question: str | None = None,
        answer: str | None = None,
        keywords: str | None = None,
        faq_id: int | None = None
    ):
        if action == "add":
            if not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message("You don't have permission to add FAQs.", ephemeral=True)
                return
            if not all([question, answer, keywords]):
                await interaction.response.send_message("Please provide a question, answer, and keywords.", ephemeral=True)
                return
            
            await database.add_faq(str(interaction.guild_id), question, answer, keywords, str(interaction.user))
            await interaction.response.send_message(f"FAQ added: **{question}**", ephemeral=True)
            
        elif action == "list":
            faqs = await database.get_faqs(str(interaction.guild_id))
            if not faqs:
                await interaction.response.send_message("No FAQs configured for this server.")
                return
            
            embed = discord.Embed(title="Server FAQs", color=discord.Color.blue())
            for faq in faqs[:25]: # Embed limit
                embed.add_field(
                    name=f"ID: {faq['id']} | {faq['question']}",
                    value=f"Keywords: `{faq['match_keywords']}`
Used: {faq['times_used']} times",
                    inline=False
                )
            await interaction.response.send_message(embed=embed)
            
        elif action == "remove":
            if not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message("You don't have permission to remove FAQs.", ephemeral=True)
                return
            if not faq_id:
                await interaction.response.send_message("Please provide a FAQ ID to remove.", ephemeral=True)
                return
            
            await database.remove_faq(faq_id)
            await interaction.response.send_message(f"FAQ ID {faq_id} removed.", ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(FAQ(bot))
