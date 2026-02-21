from __future__ import annotations
import config
import providers
import db as database

MAX_HISTORY = 20


async def get_history(channel_id: int) -> list[dict]:
    """Get conversation history for a channel from the database."""
    messages = await database.get_messages(str(channel_id), limit=MAX_HISTORY)
    return [{"role": m["role"], "content": m["content"]} for m in messages]


async def ask_ai(
    channel_id: int, 
    user_name: str, 
    message: str, 
    system_prompt: str | None = None,
    category: str | None = None
) -> tuple[str, str]:
    """Send a message to AI and return (response, provider_name)."""
    # Check for channel overrides
    override = await database.get_channel_override(str(channel_id))
    
    # Store user message in DB
    await database.add_message(str(channel_id), "user", f"{user_name}: {message}", category=category)

    history = await get_history(channel_id)
    
    # Override logic: 
    # 1. Parameter system_prompt (highest priority - from specialized cogs)
    # 2. Database channel override
    # 3. Global config system prompt (lowest priority)
    prompt = system_prompt or (override["system_prompt"] if override and override["system_prompt"] else config.SYSTEM_PROMPT)
    
    # Provider override logic
    forced_provider = override["provider_name"] if override and override["provider_name"] else None

    try:
        if forced_provider:
            # If a provider is forced for this channel, try ONLY that one (no fallback)
            from providers import _clients
            client = _clients.get(forced_provider)
            if client:
                prov_cfg = config.PROVIDERS[forced_provider]
                response_obj = client.chat.completions.create(
                    model=prov_cfg["model"],
                    max_tokens=config.MAX_TOKENS,
                    messages=[
                        {"role": "system", "content": prompt},
                        *history,
                    ],
                )
                response = response_obj.choices[0].message.content
                provider_name = forced_provider
            else:
                # Fallback to normal chat if forced client not found
                response, provider_name = providers.chat(history, prompt)
        else:
            response, provider_name = providers.chat(history, prompt)
            
        # Store assistant response in DB
        await database.add_message(str(channel_id), "assistant", response, provider=provider_name, category=category)
        return response, provider_name
    except RuntimeError as e:
        return f"Sorry, all AI providers failed:\n{e}", "none"
    except Exception as e:
        return f"An error occurred: {e}", "none"
