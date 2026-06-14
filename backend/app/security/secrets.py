"""
Secret pattern scanner — runs BEFORE any AI call (fast, deterministic).

Scans source code files against a registry of regex patterns to detect
hardcoded secrets, credentials, and API keys.

Any CRITICAL finding immediately prints a warning and exits with code 1.
"""

import re
from dataclasses import dataclass


@dataclass
class SecretPattern:
    name: str
    severity: str  # CRITICAL, HIGH, MEDIUM
    pattern: str
    description: str


# ── Pattern Registry ─────────────────────────────────

SECRET_PATTERNS: list[SecretPattern] = [
    # CRITICAL
    SecretPattern(
        name="OpenAI API Key",
        severity="CRITICAL",
        pattern=r"sk-[a-zA-Z0-9]{20,}",
        description="OpenAI API key detected",
    ),
    SecretPattern(
        name="Anthropic API Key",
        severity="CRITICAL",
        pattern=r"sk-ant-[a-zA-Z0-9\-]{20,}",
        description="Anthropic API key detected",
    ),
    SecretPattern(
        name="AWS Access Key ID",
        severity="CRITICAL",
        pattern=r"(?:AKIA|ASIA)[A-Z0-9]{16}",
        description="AWS Access Key ID detected",
    ),
    SecretPattern(
        name="AWS Secret Access Key",
        severity="CRITICAL",
        pattern=r"(?:aws_secret_access_key|aws_secret|secretAccessKey)\s*[:=]\s*['\"][A-Za-z0-9/+=]{40}['\"]",
        description="AWS Secret Access Key detected",
    ),
    SecretPattern(
        name="GCP Service Account JSON",
        severity="CRITICAL",
        pattern=r'"type"\s*:\s*"service_account"',
        description="GCP service account JSON detected",
    ),
    SecretPattern(
        name="Azure Connection String",
        severity="CRITICAL",
        pattern=r"DefaultEndpointsProtocol=https;AccountName=",  # jaguar-ignore-line
        description="Azure connection string detected",
    ),
    SecretPattern(
        name="Private RSA/EC Key",
        severity="CRITICAL",
        pattern=r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
        description="Private key detected",
    ),
    SecretPattern(
        name="Stripe Secret Key",
        severity="CRITICAL",
        pattern=r"sk_(?:live|test)_[a-zA-Z0-9]{24,}",
        description="Stripe secret key detected",
    ),
    SecretPattern(
        name="GitHub Personal Access Token",
        severity="CRITICAL",
        pattern=r"ghp_[a-zA-Z0-9]{36,}",
        description="GitHub personal access token detected",
    ),
    SecretPattern(
        name="Slack Token",
        severity="CRITICAL",
        pattern=r"xox[bprs]-[a-zA-Z0-9\-]{10,}",
        description="Slack token detected",
    ),
    # HIGH
    SecretPattern(
        name="JWT Token",
        severity="HIGH",
        pattern=r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
        description="JWT token detected",
    ),
    SecretPattern(
        name="Database Connection String",
        severity="HIGH",
        pattern=r"(?:mongodb|mysql|postgresql|postgres|redis|amqp)://[^/\s:]+:[^@\s]+@",
        description="Database connection string with credentials detected",
    ),
    SecretPattern(
        name="Generic Password Assignment",
        severity="HIGH",
        pattern=r"(?:password|passwd|pwd|secret|token|api_key|apikey|access_key)\s*[:=]\s*['\"][^'\"]{8,}['\"]",
        description="Password or secret assignment detected",
    ),
    # MEDIUM
    SecretPattern(
        name="High-Entropy String",
        severity="MEDIUM",
        pattern=r"(?:secret|key|token|password)\s*[:=]\s*['\"][A-Za-z0-9+/=]{32,}['\"]",
        description="High-entropy string in assignment (possible secret)",
    ),
]


@dataclass
class SecretFinding:
    severity: str
    category: str
    module: str
    file: str
    line: int | None
    description: str
    impact: str
    recommendation: str


# Inline allow-list markers. A line containing one of these is skipped by the
# scanner — used to silence legitimate false positives (e.g. the pattern
# definitions above, or documented example strings). Mirrors the CLI scanner.
IGNORE_MARKERS = ("jaguar-ignore-line", "jaguar-ignore")


def _has_ignore_marker(line: str) -> bool:
    return any(marker in line for marker in IGNORE_MARKERS)


def scan_file(file_path: str, content: str) -> list[SecretFinding]:
    """
    Scan a single file's content against all secret patterns.

    Args:
        file_path: Path to the file (for reporting)
        content: File content to scan

    Returns:
        List of SecretFinding objects
    """
    findings: list[SecretFinding] = []
    lines = content.split("\n")

    for pattern_def in SECRET_PATTERNS:
        for line_num, line in enumerate(lines, start=1):
            # Skip comments (basic heuristic)
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
                continue

            # Skip lines explicitly marked as a known-safe false positive.
            if _has_ignore_marker(line):
                continue

            matches = re.findall(pattern_def.pattern, line, re.IGNORECASE)
            if matches:
                # Redact the actual value
                redacted_line = re.sub(pattern_def.pattern, "██████████", line)

                findings.append(
                    SecretFinding(
                        severity=pattern_def.severity,
                        category="Secret",
                        module="secret_scanner",
                        file=file_path,
                        line=line_num,
                        description=f"{pattern_def.description} in source code",
                        impact=f"Exposed {pattern_def.name} could be exploited if code is committed to a repository",
                        recommendation=f"Move {pattern_def.name} to an environment variable or secrets manager. Rotate the exposed key immediately.",
                    )
                )

    return findings


def scan_files(files: list[dict]) -> list[SecretFinding]:
    """
    Scan multiple files for secrets.

    Args:
        files: List of dicts with 'path' and 'content' keys

    Returns:
        List of all SecretFinding objects
    """
    all_findings: list[SecretFinding] = []
    for f in files:
        findings = scan_file(f["path"], f["content"])
        all_findings.extend(findings)
    return all_findings


def has_critical_findings(findings: list[SecretFinding]) -> bool:
    """Check if any findings are CRITICAL severity."""
    return any(f.severity == "CRITICAL" for f in findings)
