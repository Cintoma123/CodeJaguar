"""
Token budget enforcement.

Prevents oversized prompts from being sent to providers. An over-long prompt
either errors out with a context-length-exceeded response or silently runs up
cost, so we cap the input here before it ever reaches the network.

A real tokenizer (tiktoken et al.) would be more precise, but it adds a heavy
dependency and differs per model. A character-based heuristic (~4 chars/token
for mixed English + code) is good enough to keep prompts safely inside every
provider's context window, which is all this guard needs to do.
"""

# Approximate characters per token. Real ratios run ~3.5–4.5; 4 is a safe
# middle ground that slightly *over*-estimates token count for code-heavy text.
CHARS_PER_TOKEN = 4

# Output tokens we ask each provider for (mirrors max_tokens in the services).
# Reserved out of the context window so the response always has room.
RESERVED_OUTPUT_TOKENS = 4096

# Per-provider total input-token budgets, sitting comfortably below each
# model's advertised context window (minus reserved output + a safety margin).
#   openai gpt-4o      → 128k context
#   anthropic sonnet   → 200k context
#   gemini 1.5         → 1M context
#   deepseek-chat      → 64k context
PROVIDER_INPUT_BUDGET: dict[str, int] = {
    "openai": 110_000,
    "anthropic": 180_000,
    "gemini": 500_000,
    "deepseek": 55_000,
}

# Conservative default for unknown / generic OpenAI-compatible providers, whose
# context window we can't know ahead of time (could be a small local model).
DEFAULT_INPUT_BUDGET = 24_000

TRUNCATION_NOTICE = (
    "\n\n[... input truncated by CodeJaguar to fit the model's token budget; "
    "some later files or diff hunks were omitted ...]"
)


def estimate_tokens(text: str) -> int:
    """Estimate the token count of a string (ceiling division)."""
    if not text:
        return 0
    return (len(text) + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN


def input_budget_for(provider: str) -> int:
    """Total input-token budget allowed for a given provider name."""
    return PROVIDER_INPUT_BUDGET.get(provider.lower(), DEFAULT_INPUT_BUDGET)


def enforce_budget(
    prompt: str,
    system: str = "",
    provider: str = "",
) -> tuple[str, bool]:
    """
    Cap ``prompt`` so that ``system`` + ``prompt`` fits the provider's input
    budget (which already reserves room for the response).

    Returns the (possibly truncated) prompt and a flag indicating whether any
    truncation occurred. The system prompt is never truncated — it carries the
    output-format contract — so its tokens are subtracted from the budget first.
    """
    budget = input_budget_for(provider)
    system_tokens = estimate_tokens(system)

    # Always leave the prompt at least a small floor, even if a huge system
    # prompt would otherwise consume the whole budget.
    allowed_prompt_tokens = max(budget - system_tokens, 1_000)

    if estimate_tokens(prompt) <= allowed_prompt_tokens:
        return prompt, False

    allowed_chars = allowed_prompt_tokens * CHARS_PER_TOKEN - len(TRUNCATION_NOTICE)
    allowed_chars = max(allowed_chars, 0)
    return prompt[:allowed_chars] + TRUNCATION_NOTICE, True
