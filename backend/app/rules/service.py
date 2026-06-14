"""
Rules service — read .jaguar/rules.md.

Project rules are injected into the system prompt of every AI call so the
model enforces project-specific engineering conventions. Stored as Markdown
in the project root under .jaguar/rules.md (no database).
"""

import os

RULES_DIR = ".jaguar"
RULES_FILE = "rules.md"

DEFAULT_RULES = """# Project Rules

- Add your project-specific rules here
- These rules will be injected into every AI review prompt
- Example: Always use the Repository Pattern for data access
- Example: All public API endpoints must require authentication
"""


def _rules_path(cwd: str) -> str:
    return os.path.join(cwd, RULES_DIR, RULES_FILE)


def load_rules(cwd: str = ".") -> str:
    """Load rules.md from the project root; return '' if absent/unreadable."""
    path = _rules_path(cwd)
    if not os.path.exists(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def init_rules(cwd: str = ".") -> str:
    """Create rules.md with the default template if it doesn't exist."""
    path = _rules_path(cwd)
    if not os.path.exists(path):
        os.makedirs(os.path.join(cwd, RULES_DIR), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(DEFAULT_RULES)
    return load_rules(cwd)
