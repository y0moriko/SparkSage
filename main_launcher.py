"""Unified launcher: starts FastAPI in a background thread and the Discord bot in the main thread."""

import asyncio
import threading
import os
import uvicorn


def start_api_server():
    """Run the FastAPI server in a background thread."""
    from api.main import create_app

    app = create_app()
    # Read port from PORT (Railway) or DASHBOARD_PORT (local)
    port = int(os.getenv("PORT", os.getenv("DASHBOARD_PORT", "8000")))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


async def _load_initial_config():
    """Load config from DB before starting the bot."""
    import db
    import config
    await db.init_db()
    all_config = await db.get_all_config()
    if all_config:
        config.reload_from_db(all_config)
        print("  Initial configuration loaded from database.")


def main():
    # Load initial config synchronously using a temp event loop
    try:
        asyncio.run(_load_initial_config())
    except Exception as e:
        print(f"  WARNING: Failed to load initial config from DB: {e}")

    import config
    import providers

    available = providers.get_available_providers()

    print("=" * 50)
    print("  SparkSage — Bot + Dashboard Launcher")
    print("=" * 50)

    # Start FastAPI in background thread
    api_thread = threading.Thread(target=start_api_server, daemon=True)
    api_thread.start()
    port = int(os.getenv("PORT", os.getenv("DASHBOARD_PORT", "8000")))
    print(f"  API server starting on http://localhost:{port}")

    # Start Discord bot in main thread
    # Note: Check for both empty and "NOT_SET" sentinel
    if not config.DISCORD_TOKEN or config.DISCORD_TOKEN == "NOT_SET":
        print("  WARNING: DISCORD_TOKEN not set — bot will not start.")
        print("  API server is running. Use the dashboard to configure the bot.")
        # Keep main thread alive for the API server
        try:
            api_thread.join()
        except KeyboardInterrupt:
            print("\nShutting down...")
            return
    else:
        print(f"  Primary provider: {config.AI_PROVIDER}")
        print(f"  Fallback chain: {' -> '.join(available) if available else 'none'}")
        print("=" * 50)

        from bot import bot
        try:
            bot.run(config.DISCORD_TOKEN)
        except Exception as e:
            print(f"  ERROR: Bot failed to start: {e}")
            print("  API server is still running. Use the dashboard to fix settings.")
            try:
                api_thread.join()
            except KeyboardInterrupt:
                print("\nShutting down...")
                return


if __name__ == "__main__":
    main()
