"""
Architecture prompt templates — builds the analysis prompt from request data.
"""

import json

from ..validators import ArchitectureRequest


def build_architecture_prompt(body: ArchitectureRequest) -> str:
    """
    Build the architecture analysis prompt from the request body.

    Combines the directory tree, import graph, and config files into a
    structured prompt for the AI to analyze for architectural issues.
    """
    sections = []

    # Section: Directory Tree
    if body.tree:
        sections.append("## Directory Tree\n\n```\n" + body.tree[:20000] + "\n```")

    # Section: Import / Dependency Graph
    if body.import_graph:
        sections.append(
            "## Import Graph\n\n```json\n"
            + json.dumps(body.import_graph, indent=2)[:15000]
            + "\n```"
        )

    # Section: Key Config Files
    if body.config_files:
        file_sections = []
        for f in body.config_files[:15]:
            content = f.content[:8000]
            file_sections.append(f"### {f.path}\n\n```\n{content}\n```")
        sections.append("## Config Files\n\n" + "\n\n".join(file_sections))

    # Section: Memory (if present)
    if body.memory:
        sections.append(
            "## Repository Memory\n\n" + json.dumps(body.memory, indent=2)
        )

    # Section: Rules (if present)
    if body.rules:
        sections.append("## Project Rules\n\n" + body.rules)

    header = (
        "You are a principal software architect. Analyze the repository "
        "structure described below and identify architectural problems. "
        "Look specifically for:\n"
        "- Circular dependency chains\n"
        "- Violations of defined layer boundaries\n"
        "- Tight coupling between unrelated modules\n"
        "- Missing abstraction layers\n"
        "- Architecture drift from defined patterns\n"
        "- God modules (single files with too many responsibilities)\n"
        "- Incorrect dependency direction (infrastructure depending on domain)\n\n"
        "Return a JSON object with this exact structure:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "HIGH|MEDIUM|LOW",\n'
        '      "category": "Coupling|Layering|Circular|Abstraction|Drift|GodModule|Other",\n'
        '      "file": "path/to/file or module (optional)",\n'
        '      "description": "What the architectural issue is",\n'
        '      "recommendation": "How to resolve it"\n'
        "    }\n"
        "  ],\n"
        '  "improvements": ["Prioritized improvement 1", "Improvement 2"],\n'
        '  "recommendations": "Overall architectural guidance as prose"\n'
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text."
    )

    if not sections:
        return header + "\n\nNo repository structure provided to analyze."

    return header + "\n\n" + "\n\n---\n\n".join(sections)
