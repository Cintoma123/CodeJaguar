"""
Review service — orchestrates the code review flow.

Week 1: Basic prompt → provider → parse response → return findings.
"""

from ..budget import enforce_budget
from ..provider_errors import describe_provider_error
from ..provider_manager import get_provider
from ..validators import ReviewRequest
from .prompts import build_review_prompt


async def run_review(body: ReviewRequest, api_key: str, base_url: str | None = None, model: str | None = None) -> dict:
    """
    Run a code review using the specified provider.

    Args:
        body: The review request with diff, files, commits, etc.
        api_key: The provider API key (from header)
        model: Optional model name override

    Returns:
        Dict with findings, summary, provider_used, model_used
    """
    # Build the prompt
    prompt = build_review_prompt(body)

    # Instantiate provider (config errors → graceful response, not a 500)
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
            "summary": f"Error: {describe_provider_error(e)}",
            "provider_used": body.provider,
            "model_used": "",
        }

    # System prompt for code review
    system = (
        "You are a senior software engineer and code reviewer. "
        "Analyze the provided code changes and return your findings as JSON. "
        "Return a JSON object with this exact structure:\n"
        '{\n'
        '  "findings": [\n'
        '    {\n'
        '      "severity": "HIGH|MEDIUM|LOW",\n'
        '      "category": "Performance|Bug|Code Smell|Maintainability|Refactoring",\n'
        '      "file": "path/to/file.ts",\n'
        '      "line": 42,\n'
        '      "description": "What the issue is",\n'
        '      "impact": "Why it matters",\n'
        '      "recommendation": "How to fix it"\n'
        '    }\n'
        '  ],\n'
        '  "summary": "Brief overall assessment"\n'
        '}\n'
        "Return ONLY the JSON object, no markdown fences, no extra text."
    )

    # Enforce the token budget so we never send an oversized prompt.
    prompt, _truncated = enforce_budget(prompt, system, body.provider)

    # Call the provider
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
            "summary": f"Error: {describe_provider_error(e)}",
            "provider_used": body.provider,
            "model_used": "",
        }

    # Parse the response
    import json

    try:
        # Strip markdown fences if present
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # Remove first and last lines (```json and ```)
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        data = json.loads(cleaned)
        findings = data.get("findings", [])
        summary = data.get("summary", "")
    except json.JSONDecodeError:
        # If JSON parsing fails, return the raw text as summary
        findings = []
        summary = response_text

    return {
        "findings": findings,
        "summary": summary,
        "provider_used": body.provider,
        "model_used": getattr(provider, "model", "default"),
    }
