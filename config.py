from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()

# Discord
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN", "NOT_SET")

# Provider selection
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()

# Free providers
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "NOT_SET")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "NOT_SET")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "NOT_SET")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")


# Paid providers (optional)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "NOT_SET")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "NOT_SET")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Bot settings
BOT_PREFIX = os.getenv("BOT_PREFIX", "!")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "1024"))
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are SparkSage, a helpful and friendly AI assistant in a Discord server. "
    "Be concise, helpful, and engaging.",
)

# Rate limiting
RATE_LIMIT_USER = int(os.getenv("RATE_LIMIT_USER", "5")) # Requests per minute
RATE_LIMIT_GUILD = int(os.getenv("RATE_LIMIT_GUILD", "20")) # Requests per minute

# Onboarding settings
WELCOME_ENABLED = os.getenv("WELCOME_ENABLED", "false").lower() == "true"
WELCOME_CHANNEL_ID = os.getenv("WELCOME_CHANNEL_ID", "")
WELCOME_MESSAGE = os.getenv(
    "WELCOME_MESSAGE", 
    "Welcome {user} to {server}! I am SparkSage, your AI assistant. Feel free to ask me anything about the server or our community."
)

# Digest settings
DIGEST_ENABLED = os.getenv("DIGEST_ENABLED", "false").lower() == "true"
DIGEST_CHANNEL_ID = os.getenv("DIGEST_CHANNEL_ID", "")
DIGEST_TIME = os.getenv("DIGEST_TIME", "09:00") # HH:MM format

# Moderation settings
MODERATION_ENABLED = os.getenv("MODERATION_ENABLED", "false").lower() == "true"
MOD_LOG_CHANNEL_ID = os.getenv("MOD_LOG_CHANNEL_ID", "")
MODERATION_SENSITIVITY = os.getenv("MODERATION_SENSITIVITY", "medium") # low, medium, high

# Translation settings
TRANSLATION_ENABLED = os.getenv("TRANSLATION_ENABLED", "false").lower() == "true"
TRANSLATION_TARGET_LANG = os.getenv("TRANSLATION_TARGET_LANG", "English")
TRANSLATION_CHANNEL_IDS = os.getenv("TRANSLATION_CHANNEL_IDS", "") # Comma-separated IDs

# Dashboard settings
DATABASE_PATH = os.getenv("DATABASE_PATH", "sparksage.db")
DASHBOARD_PORT = int(os.getenv("DASHBOARD_PORT", "8000"))
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "sparksage-dev-secret-change-me-at-least-32-chars")


def _build_providers() -> dict:
    """Build the PROVIDERS dict from current module-level variables."""
    return {
        "gemini": {
            "name": "Google Gemini",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
            "api_key": GEMINI_API_KEY,
            "model": GEMINI_MODEL,
            "free": True,
        },
        "groq": {
            "name": "Groq",
            "base_url": "https://api.groq.com/openai/v1",
            "api_key": GROQ_API_KEY,
            "model": GROQ_MODEL,
            "free": True,
        },
        "openrouter": {
            "name": "OpenRouter",
            "base_url": "https://openrouter.ai/api/v1",
            "api_key": OPENROUTER_API_KEY,
            "model": OPENROUTER_MODEL,
            "free": True,
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "base_url": "https://api.anthropic.com/v1/",
            "api_key": ANTHROPIC_API_KEY,
            "model": ANTHROPIC_MODEL,
            "free": False,
        },
        "openai": {
            "name": "OpenAI",
            "base_url": "https://api.openai.com/v1",
            "api_key": OPENAI_API_KEY,
            "model": OPENAI_MODEL,
            "free": False,
        },
    }


# Provider configs — all use the OpenAI-compatible SDK
PROVIDERS = _build_providers()

# Provider pricing per 1M tokens (estimated in USD)
# Format: { provider_name: { input: price, output: price } }
PROVIDER_PRICING = {
    "gemini": {"input": 0.0, "output": 0.0},      # Free tier assumed
    "groq": {"input": 0.0, "output": 0.0},        # Free tier assumed
    "openrouter": {"input": 0.0, "output": 0.0},  # Varies, assumed free for r1:free
    "anthropic": {"input": 3.0, "output": 15.0},  # Claude 3.5 Sonnet approx
    "openai": {"input": 0.15, "output": 0.60},    # GPT-4o-mini approx
}

# Build the free fallback chain (order matters)
FREE_FALLBACK_CHAIN = ["gemini", "groq", "openrouter"]


def reload_from_db(db_config: dict[str, str]):
    """Reload module-level config variables from DB values."""
    import config

    mapping = {
        "DISCORD_TOKEN": str,
        "AI_PROVIDER": lambda v: v.lower(),
        "GEMINI_API_KEY": str,
        "GEMINI_MODEL": str,
        "GROQ_API_KEY": str,
        "GROQ_MODEL": str,
        "OPENROUTER_API_KEY": str,
        "OPENROUTER_MODEL": str,
        "ANTHROPIC_API_KEY": str,
        "ANTHROPIC_MODEL": str,
        "OPENAI_API_KEY": str,
        "OPENAI_MODEL": str,
        "BOT_PREFIX": str,
        "MAX_TOKENS": int,
        "SYSTEM_PROMPT": str,
        "RATE_LIMIT_USER": int,
        "RATE_LIMIT_GUILD": int,
        "WELCOME_ENABLED": lambda v: str(v).lower() == "true",
        "WELCOME_CHANNEL_ID": str,
        "WELCOME_MESSAGE": str,
        "DIGEST_ENABLED": lambda v: str(v).lower() == "true",
        "DIGEST_CHANNEL_ID": str,
        "DIGEST_TIME": str,
        "MODERATION_ENABLED": lambda v: str(v).lower() == "true",
        "MOD_LOG_CHANNEL_ID": str,
        "MODERATION_SENSITIVITY": str,
        "TRANSLATION_ENABLED": lambda v: str(v).lower() == "true",
        "TRANSLATION_TARGET_LANG": str,
        "TRANSLATION_CHANNEL_IDS": str,
        "ADMIN_PASSWORD": str,
        "DISCORD_CLIENT_ID": str,
        "DISCORD_CLIENT_SECRET": str,
        "JWT_SECRET": str,
    }

    for key, converter in mapping.items():
        if key in db_config and db_config[key]:
            setattr(config, key, converter(db_config[key]))

    config.PROVIDERS = config._build_providers()
