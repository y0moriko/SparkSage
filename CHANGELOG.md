# Changelog

## [0.5.0] - 2026-02-23

### Added
- **Analytics & Usage Tracking** — Comprehensive dashboard for visualizing bot activity and AI provider usage.
- **Analytics Dashboard Page** — New page with interactive charts for messages per day, provider distribution, top channels, and latency.
- **Analytics API Endpoints** — Backend endpoints `/api/analytics/summary` and `/api/analytics/history` for data retrieval.
- **`analytics` Database Table** — New table to track events including command usage, mentions, moderation actions, and AI performance metrics.
- **AI Call Instrumentation** — Automated logging of tokens used and response latency for every AI interaction.
- **Command Tracking** — Automatic recording of command execution across all bot cogs for usage analysis.

### Changed
- **`providers.py`** — Refactored `chat()` and `test_provider()` to be asynchronous and support detailed usage logging.
- **`utils/bot_utils.py`** — Updated `ask_ai()` to propagate guild and user context for accurate analytics reporting.

## [0.4.5] - 2026-02-21

### Added
- **Per-Channel AI Overrides** — Ability to configure unique system prompts (personas) and force specific AI providers for individual Discord channels.
- **Advanced Channel Settings UI** — New tabbed interface in the dashboard for managing channel personas and provider overrides.
- **Channel Override Commands** — New `/prompt set/reset` and `/channel-provider set/reset` Discord commands for real-time configuration.
- **Expanded Database Schema** — Added `channel_prompts` and `channel_providers` tables for granular bot behavior management.
- **Channel Browsing API** — Added server and channel dropdowns to the dashboard for easy selection of override targets.

## [0.4.4] - 2026-02-21

### Added
- **Per-Channel AI Overrides** — Ability to configure unique system prompts (personas) and force specific AI providers for individual Discord channels.
- **Advanced Channel Settings UI** — New tabbed interface in the dashboard for managing channel personas and provider overrides.
- **Channel Override Commands** — New `/prompt set/reset` and `/channel-provider set/reset` Discord commands for real-time configuration.
- **Expanded Database Schema** — Added `channel_prompts` and `channel_providers` tables for granular bot behavior management.
- **Channel Browsing API** — Added server and channel dropdowns to the dashboard for easy selection of override targets.

## [0.4.3] - 2026-02-21

### Added
- **Multi-Language Translation & Auto-Detect** — New `/translate` slash command and intelligent automatic language detection.
- **Channel-Specific Auto-Translation** — Configure specific channels for automatic translation via the dashboard.
- **`cogs/translate.py`** — New cog with specialized translation personas and channel-restricted auto-translation logic.
- **Translation Dashboard Settings** — New controls to enable/disable auto-translation, set the target global language, and manage designated channel IDs.
- **Translation Dashboard Badge** — Added a "Translation" badge to the conversation viewer for better interaction categorization.

## [0.4.2] - 2026-02-21

### Added
- **AI-Powered Content Moderation** — Real-time message scanning for toxicity, spam, and rule violations.
- **`cogs/moderation.py`** — New cog that analyzes messages and flags problematic content to a designated mod-log channel.
- **Moderation Dashboard Settings** — Added controls to enable/disable moderation, select the mod-log channel, and adjust detection sensitivity.
- **Moderation Logging** — Persistent storage of flagged messages and AI reasoning in the `moderation_events` table.

## [0.4.1] - 2026-02-21

### Added
- **Daily Digest Scheduler** — Automatically summarizes server activity from the past 24 hours and posts it to a designated channel.
- **`cogs/digest.py`** — New cog with a task loop for scheduling and AI-powered activity summarization.
- **Digest Dashboard Settings** — Added controls to the settings page for enabling/disabling the digest, selecting the target channel, and setting the daily post time.
- **Digest Configuration** — Integrated `DIGEST_ENABLED`, `DIGEST_CHANNEL_ID`, and `DIGEST_TIME` into the database and sync logic.

## [0.4.0] - 2026-02-21

### Added
- **Modular Cog System** — Refactored all Discord commands into organized cog files (`general`, `summarize`, `code_review`, `faq`, `onboarding`, `permissions`).
- **Role-Based Access Control (RBAC)** — Comprehensive system to restrict commands to specific server roles, manageable via Discord and Dashboard.
- **Code Review System** — Specialized `/review` command providing senior-level feedback on code snippets with syntax highlighting.
- **FAQ Auto-Detection** — Intelligent listener that responds to frequently asked questions based on configurable keywords.
- **New Member Onboarding** — Customizable welcome flow with rich embeds and server information.
- **Advanced Dashboard** — New management pages for FAQs and Command Permissions.
- **Stability Fixes** — Thread-safe loop-local database connections, improved error handling, and Discord intent optimizations.

## [0.3.0] - 2026-02-19

### Added
- **Admin Dashboard** — Next.js 16 + shadcn/ui web interface for managing SparkSage
- **Setup Wizard** — 4-step guided setup on first login (Discord token → Providers → Bot settings → Review). Skippable and accessible from sidebar nav.
- **FastAPI Backend** — 19 REST API endpoints for dashboard communication
- **SQLite Database** (`db.py`) — persistent storage for config, conversations, sessions, and wizard state
- **Dashboard Pages:**
  - **Overview** — bot status, latency, guild count, active provider, fallback chain visualization, recent activity
  - **Providers** — provider cards with test/set-primary buttons, fallback chain display
  - **Settings** — live config editor with save/reset (changes apply without restart)
  - **Conversations** — per-channel viewer with chat-style messages, provider badges, timestamps
- **Authentication** — Discord OAuth2 (primary) + password fallback (dev/local) via next-auth v5
- **Unified Launcher** (`run.py`) — starts Discord bot + FastAPI server in one process
- **Live Config Reload** — `config.reload_from_db()` and `providers.reload_clients()` for runtime updates
- **Provider Testing** — `providers.test_provider()` for validating API keys from the dashboard
- **Bot Status API** — `bot.get_bot_status()` exposes online state, latency, guilds to dashboard

### Changed
- **`bot.py`** — conversations now stored in SQLite (previously in-memory), added `get_bot_status()`
- **`config.py`** — added dashboard env vars, `reload_from_db()`, `_build_providers()` for dynamic rebuilds
- **`providers.py`** — added `reload_clients()`, `test_provider()`, extracted `_build_clients()`
- **`requirements.txt`** — added fastapi, uvicorn, aiosqlite, pyjwt, python-multipart, httpx
- **`.env.example`** — added DASHBOARD section (port, password, Discord OAuth, JWT secret, DB path)
- **`.gitignore`** — added *.db, dashboard/node_modules/, dashboard/.next/, dashboard/.env.local
- **`docs/PRODUCT_DESIGN.md`** — full rewrite with dashboard architecture, API endpoints, database schema, updated roadmap

### Architecture

```
Before (v0.2):
  Discord → bot.py → providers.py → AI APIs
  Config: .env only, in-memory conversations

After (v0.3):
  Discord → bot.py ──┐
                      ├── providers.py → AI APIs
  Dashboard → FastAPI ┘
                │
            SQLite DB (config, conversations, sessions, wizard)
```

---

## [0.2.0] - 2026-02-18

### Added
- **Multi-provider fallback system** (`providers.py`) — automatic failover across free AI providers
- **Free fallback chain:** Google Gemini 2.5 Flash → Groq (Llama 3.3 70B) → OpenRouter (DeepSeek R1)
- **Paid provider support** (optional): Anthropic Claude and OpenAI as configurable primary providers
- **`/provider` slash command** — shows active provider, model, and fallback chain status
- **Response footer** — each reply shows which AI provider generated the answer
- **Provider health check on startup** — logs active provider and full fallback chain

### Changed
- **`requirements.txt`** — replaced `anthropic` SDK with `openai` SDK (OpenAI-compatible, works with all providers)
- **`config.py`** — expanded from single-provider to multi-provider config with `PROVIDERS` dict and `FREE_FALLBACK_CHAIN`
- **`.env.example`** — now includes all 5 providers (3 free + 2 paid) with setup links and rate limit notes
- **`bot.py`** — refactored `ask_claude()` → `ask_ai()`, removed Anthropic-specific code, integrated `providers.py`
- **`docs/PRODUCT_DESIGN.md`** — updated architecture diagram, added provider comparison tables, updated roadmap

---

## [0.1.0] - 2026-02-18

### Added
- Initial project setup
- Discord bot with `discord.py`
- Anthropic Claude API integration
- `/ask` slash command
- `/clear` command to reset conversation memory
- `/summarize` command for thread summarization
- Per-channel conversation history (in-memory)
- Configurable model, tokens, and system prompt via `.env`
- Responds to @mentions
- Auto-splits long responses for Discord's 2000 char limit
- Project structure with `cogs/`, `utils/`, `docs/`, `tests/` directories
- Product design document with 7 use case categories and phased roadmap
