"""
.gitignore gap analyzer.

Detects missing entries in .gitignore that could lead to sensitive files
being committed to version control.

Checks for:
- .env not excluded
- *.pem, *.key not excluded
- secrets/ not excluded
- credentials.json not excluded
- IDE config folders with sensitive data not excluded
- node_modules, __pycache__, .venv not excluded
- dist/, build/ not excluded
- *.log not excluded
"""

from dataclasses import dataclass


@dataclass
class GitignoreFinding:
    severity: str
    category: str
    file: str
    line: int | None
    description: str
    impact: str
    recommendation: str


# Required patterns and their severity if missing
REQUIRED_PATTERNS = [
    (".env", "CRITICAL", "Environment files containing secrets"),
    (".env.*", "CRITICAL", "Environment file variants"),
    ("*.pem", "CRITICAL", "Private key files"),
    ("*.key", "CRITICAL", "Private key files"),
    ("*.p12", "CRITICAL", "PKCS#12 certificate files"),
    ("*.pfx", "CRITICAL", "PKCS#12 certificate files"),
    ("secrets/", "HIGH", "Secrets directory"),
    ("credentials.json", "HIGH", "Credentials file"),
    ("*.secret", "HIGH", "Secret files"),
    (".venv/", "MEDIUM", "Python virtual environment"),
    ("node_modules/", "LOW", "Node.js dependencies"),
    ("__pycache__/", "LOW", "Python cache files"),
    ("dist/", "LOW", "Build output directory"),
    ("build/", "LOW", "Build output directory"),
    ("*.log", "LOW", "Log files"),
    (".DS_Store", "LOW", "macOS system files"),
    ("Thumbs.db", "LOW", "Windows system files"),
    (".idea/", "MEDIUM", "JetBrains IDE config (may contain sensitive paths)"),
    (".vscode/", "LOW", "VS Code config"),
    ("*.swp", "LOW", "Vim swap files"),
    ("coverage/", "LOW", "Code coverage reports"),
    (".terraform/", "HIGH", "Terraform state (may contain secrets)"),
    ("*.tfstate", "CRITICAL", "Terraform state files (may contain secrets)"),
]


def analyze_gitignore(content: str, file_path: str = ".gitignore") -> list[GitignoreFinding]:
    """
    Analyze a .gitignore file for missing security-relevant patterns.

    Args:
        content: .gitignore file content
        file_path: Path to the .gitignore file

    Returns:
        List of GitignoreFinding objects for missing patterns
    """
    findings: list[GitignoreFinding] = []
    lines = content.split("\n")

    # Build a set of all patterns in the file (normalized)
    existing_patterns: set[str] = set()
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            existing_patterns.add(stripped)
            # Also add without leading slash
            if stripped.startswith("/"):
                existing_patterns.add(stripped[1:])
            # Also add with leading slash
            if not stripped.startswith("/"):
                existing_patterns.add("/" + stripped)

    for pattern, severity, reason in REQUIRED_PATTERNS:
        # Check if pattern or a superset exists
        found = False
        for existing in existing_patterns:
            if existing == pattern or existing.rstrip("/") == pattern.rstrip("/"):
                found = True
                break
            # Check if a broader pattern covers it
            if pattern.startswith("*") and existing == pattern:
                found = True
                break
            # Check directory patterns
            if pattern.endswith("/") and existing == pattern.rstrip("/"):
                found = True
                break

        if not found:
            findings.append(
                GitignoreFinding(
                    severity=severity,
                    category="Gitignore",
                    file=file_path,
                    line=None,
                    description=f"Missing .gitignore entry: '{pattern}' ({reason})",
                    impact=f"Files matching '{pattern}' may be committed to version control",
                    recommendation=f"Add '{pattern}' to .gitignore",
                )
            )

    return findings
