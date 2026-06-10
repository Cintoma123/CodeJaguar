"""
Environment file analyzer.

Detects security issues in .env files:
- Real credentials in .env.example (should only contain placeholders)
- Weak or placeholder secrets shipped to production
- Production database URLs in development env files
- JWT secrets below minimum entropy threshold
"""

import re
from dataclasses import dataclass


@dataclass
class EnvFinding:
    severity: str
    category: str
    file: str
    line: int | None
    description: str
    impact: str
    recommendation: str


# Patterns that indicate a real secret (not a placeholder)
REAL_SECRET_PATTERNS = [
    (r"(?:PASSWORD|PWD)\s*=\s*(?!.*(?:changeme|password|secret|example|test|dummy|placeholder|your_|my_))[A-Za-z0-9!@#$%^&*]{8,}", "HIGH"),
    (r"(?:API_KEY|APIKEY|API_SECRET)\s*=\s*(?!.*(?:changeme|example|test|dummy|placeholder|your_|my_))[A-Za-z0-9_\-]{16,}", "CRITICAL"),
    (r"(?:SECRET_KEY|SESSION_SECRET|JWT_SECRET)\s*=\s*(?!.*(?:changeme|example|test|dummy|placeholder|your_|my_))[A-Za-z0-9!@#$%^&*]{8,}", "CRITICAL"),
    (r"(?:DATABASE_URL|DB_URL)\s*=\s*\w+://[^:]+:[^@]+@", "HIGH"),
    (r"(?:AWS_SECRET|AWS_ACCESS_KEY)\s*=\s*[A-Za-z0-9/+=]{16,}", "CRITICAL"),
    (r"(?:PRIVATE_KEY|RSA_KEY)\s*=\s*-----BEGIN", "CRITICAL"),
]

# Weak/placeholder values that shouldn't be in production
WEAK_VALUES = [
    "password", "secret", "changeme", "test", "123456",
    "admin", "default", "example", "placeholder", "dummy",
    "your_password_here", "your_secret_here", "change_this",
]

# Production-like URL patterns
PRODUCTION_URL_PATTERNS = [
    r"\.prod\.",
    r"\.production\.",
    r"\.amazonaws\.com",
    r"\.cloudapp\.azure\.com",
    r"\.appspot\.com",
    r"\.herokuapp\.com",
    r"\.ondigitalocean\.app",
]


def analyze_env_file(file_path: str, content: str) -> list[EnvFinding]:
    """
    Analyze an environment file for security issues.

    Args:
        file_path: Path to the .env file
        content: File content

    Returns:
        List of EnvFinding objects
    """
    findings: list[EnvFinding] = []
    lines = content.split("\n")
    is_example = ".example" in file_path or ".template" in file_path

    for line_num, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Check for real secrets in .env.example files
        if is_example:
            for pattern, severity in REAL_SECRET_PATTERNS:
                if re.search(pattern, stripped, re.IGNORECASE):
                    findings.append(
                        EnvFinding(
                            severity=severity,
                            category="Environment",
                            file=file_path,
                            line=line_num,
                            description="Real credential value found in .env.example file",
                            impact=".env.example is often committed to version control, exposing real secrets",
                            recommendation="Use placeholder values in .env.example: API_KEY=your_api_key_here",
                        )
                    )
                    break

        # Check for weak/placeholder secrets
        for weak_val in WEAK_VALUES:
            if re.search(rf"=\s*{weak_val}\s*$", stripped, re.IGNORECASE):
                findings.append(
                    EnvFinding(
                        severity="MEDIUM",
                        category="Environment",
                        file=file_path,
                        line=line_num,
                        description=f"Weak or placeholder value detected: '{weak_val}'",
                        impact="Weak secrets are easily guessable and should not be used in any environment",
                        recommendation="Generate a strong random secret: openssl rand -hex 32",
                    )
                )
                break

        # Check for production database URLs
        if "DATABASE_URL" in stripped or "DB_URL" in stripped:
            for prod_pattern in PRODUCTION_URL_PATTERNS:
                if re.search(prod_pattern, stripped, re.IGNORECASE):
                    findings.append(
                        EnvFinding(
                            severity="HIGH",
                            category="Environment",
                            file=file_path,
                            line=line_num,
                            description="Production database URL found in environment file",
                            impact="Production credentials in env files risk exposure and accidental production access",
                            recommendation="Use separate .env files for development and production; never commit production credentials",
                        )
                    )
                    break

        # Check for low-entropy JWT secrets
        if "JWT_SECRET" in stripped or "SESSION_SECRET" in stripped:
            value = stripped.split("=", 1)[-1].strip().strip("'\"")
            if len(value) < 32:
                findings.append(
                    EnvFinding(
                        severity="HIGH",
                        category="Environment",
                        file=file_path,
                        line=line_num,
                        description=f"JWT/Session secret is too short ({len(value)} chars, minimum 32 recommended)",
                        impact="Short secrets are vulnerable to brute-force attacks",
                        recommendation="Generate a strong secret: openssl rand -hex 32",
                    )
                )

    return findings
