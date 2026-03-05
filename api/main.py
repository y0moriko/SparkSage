from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, config, providers, bot, conversations, wizard, faq, permissions, prompts, channels, analytics, server_settings, plugins, knowledge
import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    # We no longer sync_env_to_db here. This was overwriting DB values on every boot.
    # The bot startup handles seeding if the DB is empty.
    yield
    await db.close_db()


def create_app() -> FastAPI:
    app = FastAPI(title="SparkSage API", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(config.router, prefix="/api/config", tags=["config"])
    app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
    app.include_router(bot.router, prefix="/api/bot", tags=["bot"])
    app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
    app.include_router(wizard.router, prefix="/api/wizard", tags=["wizard"])
    app.include_router(faq.router, prefix="/api/faqs", tags=["faq"])
    app.include_router(permissions.router, prefix="/api/permissions", tags=["permissions"])
    app.include_router(prompts.router, prefix="/api/prompts", tags=["prompts"])
    app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(server_settings.router, prefix="/api/server-settings", tags=["server-settings"])
    app.include_router(plugins.router, prefix="/api/plugins", tags=["plugins"])
    app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app
