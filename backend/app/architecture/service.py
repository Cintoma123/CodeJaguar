"""
Architecture service — orchestrates the architecture review flow.

Gathers repository structure context, calls the provider, and parses the
structured findings / improvements / recommendations response.
"""

import json

from ..budget import enforce_budget
from ..provider_errors import describe_provider_error
from ..provider_manager import get_provider
from ..validators import ArchitectureRequest
from .prompts import build_architecture_prompt


async def run_architecture_review(
    body: ArchitectureRequest,
    api_key: str,
    base_url: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Run an architecture review using the specified provider.

    Returns:
        Dict with findings, improvements, recommendations, provider_used
    """
    prompt = build_architecture_prompt(body)

    try:
        provider = get_provider(
            name=body.provider,
            api_key=api_key,
            base_url=base_url,
            model=model,
        )
    except Exception as e:
        return {
            "findings": [],
            "improvements": [],
            "recommendations": f"Error: {describe_provider_error(e)}",
            "provider_used": body.provider,
        }

    system = (
        "You are a principal software architect. "
        "Analyze the repository structure and return findings as JSON. "
        "Return ONLY the JSON object, no markdown fences, no extra text."
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
            "findings": [],
            "improvements": [],
            "recommendations": f"Error: {describe_provider_error(e)}",
            "provider_used": body.provider,
        }

    data = _parse_json_response(response_text)

    return {
        "findings": data.get("findings", []),
        "improvements": data.get("improvements", []),
        "recommendations": data.get("recommendations", ""),
        "provider_used": body.provider,
    }


def _parse_json_response(response_text: str) -> dict:
    """Parse a JSON response, stripping markdown fences if present."""
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"findings": [], "improvements": [], "recommendations": response_text}
