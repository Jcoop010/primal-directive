# Advisor production contract

The active Advisor uses Anthropic Claude only. `ANTHROPIC_API_KEY` is server-only. `ANTHROPIC_MODEL` can select an owner-approved compatible model; the current default preserves the existing Claude Sonnet 4.6 integration. No Groq, xAI or Gemini provider substitution occurs. Legacy keys do not activate providers.

`ANTHROPIC_WEB_SEARCH_ENABLED=true` permits a single web search for explicit research intent or Deep Research mode. Otherwise research returns a truthful unavailable result without a provider request. Search has a provider charge; no subscription or new integration is provisioned by this change. General advice does not search automatically.

Quick is the default: normal 100–150 word target and 768 output-token ceiling. Detailed is capped at 1536 tokens and Research at 2000. One generation per submitted turn, no automatic retry or model switch, 45-second total transport/body deadline, bounded conversation history, per-account in-flight deduplication, and a best-effort warm-instance 429 cooldown. This is not a distributed spending limit. Set account/provider budget alerts and caps directly with the owner; variable use cannot be guaranteed to remain under $5–$10/month.

Research requires actual citation metadata. A structured lead must reference an exact returned URL. Sources are attached for review; their presence is not proof that every claim is supported. Saved leads have no fabricated date, fee, confidence or booked status. Capacity/contact qualification is explicitly user-reviewed information. No automated outreach is sent.

Missing keys, malformed output, provider failures, timeout and unverified research are visibly labeled. Local summaries use saved workspace data and never masquerade as AI research. Provider logs include status only, not keys, prompt content or customer records.

The standard build does not run database migrations. Execute migration commands only under a separately reviewed migration and recovery plan.
