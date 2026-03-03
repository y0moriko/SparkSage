from __future__ import annotations
import discord
from discord.ext import commands
from discord import app_commands
import db as database
from utils.bot_utils import ask_ai

class CustomCommands(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def cog_load(self):
        """Dynamically register custom commands from the database."""
        await self.sync_custom_commands()

    async def sync_custom_commands(self):
        """Fetch commands from DB and add them to the command tree."""
        custom_cmds = await database.get_custom_commands()
        
        for cmd_data in custom_cmds:
            name = cmd_data["name"]
            description = cmd_data["description"]
            prompt = cmd_data["prompt"]
            requires_input = bool(cmd_data.get("requires_input", 1))

            # Create a closure to capture command data
            def make_command(cmd_prompt, needs_input):
                if needs_input:
                    async def dynamic_cmd(interaction: discord.Interaction, input: str):
                        await interaction.response.defer()
                        response, provider = await ask_ai(
                            interaction.channel_id,
                            interaction.user.display_name,
                            input,
                            system_prompt=cmd_prompt,
                            category="custom_command",
                            guild_id=str(interaction.guild_id),
                            user_id=str(interaction.user.id)
                        )
                        await self.send_response(interaction, response)
                    return dynamic_cmd
                else:
                    async def dynamic_cmd(interaction: discord.Interaction):
                        await interaction.response.defer()
                        response, provider = await ask_ai(
                            interaction.channel_id,
                            interaction.user.display_name,
                            "Execute command", # Placeholder message
                            system_prompt=cmd_prompt,
                            category="custom_command",
                            guild_id=str(interaction.guild_id),
                            user_id=str(interaction.user.id)
                        )
                        await self.send_response(interaction, response)
                    return dynamic_cmd

            # Create the app command
            new_cmd = app_commands.Command(
                name=name,
                description=description,
                callback=make_command(prompt, requires_input)
            )
            
            # Add to the bot's tree
            self.bot.tree.add_command(new_cmd)
        
        print(f"Loaded {len(custom_cmds)} custom AI commands.")

    async def send_response(self, interaction: discord.Interaction, response: str):
        """Helper to send potentially long responses."""
        if len(response) <= 2000:
            await interaction.followup.send(response)
        else:
            for i in range(0, len(response), 2000):
                if i == 0:
                    await interaction.followup.send(response[i : i + 2000])
                else:
                    await interaction.channel.send(response[i : i + 2000])

async def setup(bot: commands.Bot):
    await bot.add_cog(CustomCommands(bot))
