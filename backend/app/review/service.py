"""
Review service — orchestrates the code review flow.

Week 1: Basic prompt → provider → parse response → return findings.
"""

from ..budget import enforce_budget
from ..provider_errors import describe_provider_error
from ..provider_manager import get_provider
from ..validators import ReviewRequest
from .prompts import build_review_prompt


def _build_system_prompt(fix_mode: bool) -> str:
    """
    Build the review system prompt.

    In fix mode each finding must additionally carry a `fix` object with the
    exact original lines, the replacement lines, and a one-sentence rationale —
    the CLI uses these to apply changes to disk, so `original_code` must match
    the file verbatim.
    """
    if not fix_mode:
        return (
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

    return (
        "You are a senior software engineer and code reviewer. "
        "Analyze the provided code changes and return your findings as JSON. "
        "For every finding you MUST also propose a concrete code fix. "
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
        '      "recommendation": "How to fix it",\n'
        '      "fix": {\n'
        '        "original_code": "the exact line(s) to replace, copied verbatim from the file",\n'
        '        "fixed_code": "the replacement line(s)",\n'
        '        "explanation": "one sentence on why this fix is correct"\n'
        '      }\n'
        '    }\n'
        '  ],\n'
        '  "summary": "Brief overall assessment"\n'
        '}\n'
        "Rules for the fix object:\n"
        "- original_code MUST be copied character-for-character from the provided "
        "file contents, including exact indentation and whitespace, so it can be "
        "found and replaced programmatically. Do NOT paraphrase or reformat it.\n"
        "- Keep original_code minimal: only the lines that actually change.\n"
        "- fixed_code must be the complete replacement for those exact lines.\n"
        "- If you cannot produce a safe, exact fix for a finding, omit the fix "
        "field for that finding rather than guessing.\n"
        "Return ONLY the JSON object, no markdown fences, no extra text."
    )


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
        message = describe_provider_error(e)
        return {
            "findings": [],
            "summary": f"Error: {message}",
            "provider_used": body.provider,
            "model_used": "",
            "error": message,
        }

    # System prompt for code review (fix-aware when the CLI requests fix mode).
    system = _build_system_prompt(body.fix_mode)

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
        message = describe_provider_error(e)
        return {
            "findings": [],
            "summary": f"Error: {message}",
            "provider_used": body.provider,
            "model_used": "",
            "error": message,
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
