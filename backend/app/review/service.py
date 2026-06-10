"""
Review service — orchestrates the code review flow.

Week 1: Basic prompt → provider → parse response → return findings.
"""

from ..provider_manager import get_provider
from ..validators import ReviewRequest
from .prompts import build_review_prompt


async def run_review(body: ReviewRequest, api_key: str) -> dict:
    """
    Run a code review using the specified provider.

    Args:
        body: The review request with diff, files, commits, etc.
        api_key: The provider API key (from header)

    Returns:
        Dict with findings, summary, provider_used, model_used
    """
    # Build the prompt
    prompt = build_review_prompt(body)

    # Instantiate provider
    provider = get_provider(
        name=body.provider,
        api_key=api_key,
    )

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
            "summary": f"Error calling provider: {e}",
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
