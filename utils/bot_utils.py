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
    # Check for channel-specific overrides
    channel_prompt = await database.get_channel_prompt(str(channel_id))
    forced_provider = await database.get_channel_provider(str(channel_id))
    
    # Store user message in DB
    await database.add_message(str(channel_id), "user", f"{user_name}: {message}", category=category)

    history = await get_history(channel_id)
    
    # Priority: 1. Cog prompt, 2. Channel prompt, 3. Global prompt
    prompt = system_prompt or channel_prompt or config.SYSTEM_PROMPT

    try:
        if forced_provider:
            # If a provider is forced for this channel, try ONLY that one
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
                # Fallback if forced provider client is missing
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
