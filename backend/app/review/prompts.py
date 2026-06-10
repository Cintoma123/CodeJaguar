"""
Review prompt templates — builds the user-facing prompt from request data.
"""

from ..validators import ReviewRequest


def build_review_prompt(body: ReviewRequest) -> str:
    """
    Build the full review prompt from the request body.
    
    Combines diff, file contents, and commits into a structured prompt
    for the AI to analyze.
    """
    sections = []

    # Section: Code Changes (diff)
    if body.diff:
        sections.append("## Code Changes (git diff)\n\n```\n" + body.diff + "\n```")

    # Section: Changed File Contents
    if body.files:
        file_sections = []
        for f in body.files[:20]:  # Limit to 20 files to stay within token budget
            content = f.content[:15000]  # Truncate very large files
            file_sections.append(f"### {f.path}\n\n```\n{content}\n```")
        sections.append("## Changed File Contents\n\n" + "\n\n".join(file_sections))

    # Section: Commits
    if body.commits:
        sections.append("## Recent Commits\n\n" + "\n".join(f"- {c}" for c in body.commits))

    # Section: Memory (if present)
    if body.memory:
        import json
        sections.append("## Repository Memory\n\n" + json.dumps(body.memory, indent=2))

    # Section: Rules (if present)
    if body.rules:
        sections.append("## Project Rules\n\n" + body.rules)

    # Assemble the full prompt
    header = (
        "Please perform a thorough code review of the following changes. "
        "Look for bugs, performance issues, code smells, maintainability problems, "
        "and refactoring opportunities. Return your findings as structured JSON."
    )

    if not sections:
        return header + "\n\nNo changes provided to review."

    return header + "\n\n" + "\n\n---\n\n".join(sections)
