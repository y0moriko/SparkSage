import asyncio
import aiosqlite

async def check_usage():
    async with aiosqlite.connect("sparksage.db") as db:
        async with db.execute("SELECT provider, COUNT(*) FROM analytics GROUP BY provider") as cursor:
            rows = await cursor.fetchall()
            print("Provider Usage in DB:")
            for row in rows:
                print(f"  {row[0]}: {row[1]}")

if __name__ == "__main__":
    asyncio.run(check_usage())
