"""
Summary service — orchestrates the PR summary flow.

Builds a prompt from git context and returns GitHub-ready Markdown.
"""

from ..budget import enforce_budget
from ..provider_errors import describe_provider_error
from ..provider_manager import get_provider
from ..validators import SummaryRequest
from .prompts import build_summary_prompt


async def run_summary(
    body: SummaryRequest,
    api_key: str,
    base_url: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Generate a PR summary using the specified provider.

    Returns:
        Dict with markdown, provider_used
    """
    prompt = build_summary_prompt(body)

    try:
        provider = get_provider(
            name=body.provider,
            api_key=api_key,
            base_url=base_url,
            model=model,
        )
    except Exception as e:
        return {
            "markdown": f"Error: {describe_provider_error(e)}",
            "provider_used": body.provider,
        }

    system = (
        "You are a senior engineer who writes clear, accurate pull request "
        "descriptions in GitHub-flavored Markdown. "
        "Return ONLY the Markdown document."
    )

    # Enforce the token budget so we never send an oversized prompt.
    prompt, _truncated = enforce_budget(prompt, system, body.provider)

    try:
        response_text = await provider.complete(
            prompt=prompt,
            system=system,
            max_tokens=4096,
            temperature=0.3,
        )
    except Exception as e:
        return {
            "markdown": f"Error: {describe_provider_error(e)}",
            "provider_used": body.provider,
        }

    # Strip surrounding markdown fences if the model wrapped the whole doc
    markdown = response_text.strip()
    if markdown.startswith("```"):
        lines = markdown.split("\n")[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        markdown = "\n".join(lines).strip()

    return {
        "markdown": markdown,
        "provider_used": body.provider,
    }
