import asyncio
import aiosqlite

async def check_wizard():
    async with aiosqlite.connect("sparksage.db") as db:
        async with db.execute("SELECT completed FROM wizard_state WHERE id = 1") as cursor:
            row = await cursor.fetchone()
            print(f"Wizard completed: {bool(row[0]) if row else 'No row'}")

if __name__ == "__main__":
    asyncio.run(check_wizard())
