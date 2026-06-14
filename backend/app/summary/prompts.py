"""
Summary prompt templates — builds the PR summary prompt from request data.
"""

import json

from ..validators import SummaryRequest


def build_summary_prompt(body: SummaryRequest) -> str:
    """
    Build the PR summary prompt from the request body.

    Combines commits, diff, and the changed-file list into a structured
    prompt that asks the AI to produce GitHub-ready Markdown.
    """
    sections = []

    if body.commits:
        sections.append(
            "## Commits\n\n" + "\n".join(f"- {c}" for c in body.commits)
        )

    if body.changed_files:
        sections.append(
            "## Changed Files\n\n"
            + "\n".join(f"- {f}" for f in body.changed_files)
        )

    if body.diff:
        sections.append("## Diff\n\n```diff\n" + body.diff[:40000] + "\n```")

    if body.memory:
        sections.append(
            "## Repository Memory\n\n" + json.dumps(body.memory, indent=2)
        )

    header = (
        "You are a senior engineer writing a pull request description. "
        f"Summarize the changes below (base branch: {body.base_branch}). "
        "Produce a GitHub-ready Markdown document with EXACTLY these sections, "
        "in this order, using `##` headings:\n"
        "## Summary\n"
        "## Features Added\n"
        "## Files Changed\n"
        "## Risks\n"
        "## Suggested Tests\n"
        "## Breaking Changes\n\n"
        "Use bullet lists where appropriate. If a section has nothing to "
        'report, write "None". '
        "Return ONLY the Markdown document, no code fences around the whole "
        "thing, no extra commentary."
    )

    if not sections:
        return header + "\n\nNo changes were provided to summarize."

    return header + "\n\n" + "\n\n---\n\n".join(sections)
