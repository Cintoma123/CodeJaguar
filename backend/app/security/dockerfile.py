"""
Dockerfile security analyzer.

Detects common Dockerfile security issues:
- Running as root user (missing USER instruction)
- Use of 'latest' tag (non-deterministic builds)
- Secrets in ENV or ARG instructions
- Excessive OS package installation
- Missing HEALTHCHECK
- Large attack surface from unnecessary tools
- --no-cache not used in package installs
"""

import re
from dataclasses import dataclass


@dataclass
class DockerfileFinding:
    severity: str
    category: str
    file: str
    line: int | None
    description: str
    impact: str
    recommendation: str


def analyze_dockerfile(file_path: str, content: str) -> list[DockerfileFinding]:
    """
    Analyze a Dockerfile for security issues.

    Args:
        file_path: Path to the Dockerfile
        content: Dockerfile content

    Returns:
        List of DockerfileFinding objects
    """
    findings: list[DockerfileFinding] = []
    lines = content.split("\n")
    has_user_instruction = False
    has_healthcheck = False
    uses_latest_tag = False
    has_no_cache = False

    for line_num, line in enumerate(lines, start=1):
        stripped = line.strip().upper()

        # Skip comments
        if stripped.startswith("#"):
            continue

        # Check for USER instruction
        if stripped.startswith("USER "):
            has_user_instruction = True
            # Check if USER is root
            user_value = stripped.replace("USER ", "").strip()
            if user_value == "root" or user_value == "0":
                findings.append(
                    DockerfileFinding(
                        severity="HIGH",
                        category="Dockerfile",
                        file=file_path,
                        line=line_num,
                        description="Container explicitly set to run as root",
                        impact="Root user has full system access; container escape could compromise host",
                        recommendation="Use a non-root user: USER appuser (create with RUN useradd first)",
                    )
                )

        # Check for HEALTHCHECK
        if stripped.startswith("HEALTHCHECK"):
            has_healthcheck = True

        # Check for latest tag in FROM
        if stripped.startswith("FROM "):
            image = stripped.replace("FROM ", "").strip()
            if ":latest" in image or ":" not in image.split()[0]:
                uses_latest_tag = True
                findings.append(
                    DockerfileFinding(
                        severity="MEDIUM",
                        category="Dockerfile",
                        file=file_path,
                        line=line_num,
                        description=f"Image '{image}' uses 'latest' tag or no tag",
                        impact="Non-deterministic builds; image could change without notice",
                        recommendation="Pin to a specific version: FROM node:20.11.0-alpine",
                    )
                )

        # Check for secrets in ENV
        if stripped.startswith("ENV "):
            env_line = stripped.replace("ENV ", "", 1)
            secret_patterns = [
                ("PASSWORD", "HIGH"),
                ("SECRET", "HIGH"),
                ("API_KEY", "CRITICAL"),
                ("APIKEY", "CRITICAL"),
                ("TOKEN", "HIGH"),
                ("PRIVATE_KEY", "CRITICAL"),
                ("ACCESS_KEY", "CRITICAL"),
                ("CREDENTIAL", "HIGH"),
            ]
            for pattern, severity in secret_patterns:
                if pattern in env_line.upper():
                    findings.append(
                        DockerfileFinding(
                            severity=severity,
                            category="Secret",
                            file=file_path,
                            line=line_num,
                            description=f"Secret pattern '{pattern}' found in ENV instruction",
                            impact="Secrets in ENV are visible in image history and to anyone with image access",
                            recommendation="Use Docker secrets, runtime env vars, or a secrets manager instead",
                        )
                    )

        # Check for secrets in ARG
        if stripped.startswith("ARG "):
            arg_line = stripped.replace("ARG ", "", 1)
            for pattern, severity in [("PASSWORD", "HIGH"), ("SECRET", "HIGH"), ("TOKEN", "HIGH"), ("KEY", "HIGH")]:
                if pattern in arg_line.upper():
                    findings.append(
                        DockerfileFinding(
                            severity=severity,
                            category="Secret",
                            file=file_path,
                            line=line_num,
                            description=f"Secret pattern '{pattern}' found in ARG instruction",
                            impact="Build args may be visible in image history",
                            recommendation="Avoid passing secrets as build args; use multi-stage builds or runtime secrets",
                        )
                    )

        # Check for --no-cache in package installs
        if any(pkg in stripped for pkg in ("APT-GET", "APK", "YUM", "DNF", "PIP", "NPM")):
            if "INSTALL" in stripped or "ADD" in stripped:
                if "--no-cache" not in stripped and "APT-GET UPDATE" not in stripped:
                    if "APT-GET" in stripped:
                        findings.append(
                            DockerfileFinding(
                                severity="LOW",
                                category="Dockerfile",
                                file=file_path,
                                line=line_num,
                                description="apt-get install without --no-cache or rm -rf /var/lib/apt/lists/*",
                                impact="Increases image size with unnecessary package cache",
                                recommendation="Use apt-get install -y --no-cache ... && rm -rf /var/lib/apt/lists/*",
                            )
                        )
                    elif "APK" in stripped:
                        findings.append(
                            DockerfileFinding(
                                severity="LOW",
                                category="Dockerfile",
                                file=file_path,
                                line=line_num,
                                description="apk add without --no-cache",
                                impact="Increases image size with unnecessary package cache",
                                recommendation="Use apk add --no-cache ...",
                            )
                        )

        # Check for unnecessary tools
        unnecessary = ["VIM", "NANO", "LESS", "MORE", "CURL", "WGET", "NETCAT", "NMAP"]
        for tool in unnecessary:
            if f" {tool}" in stripped or f"={tool}" in stripped:
                findings.append(
                    DockerfileFinding(
                        severity="LOW",
                        category="Dockerfile",
                        file=file_path,
                        line=line_num,
                        description=f"Potentially unnecessary tool '{tool}' installed",
                        impact="Increases attack surface and image size",
                        recommendation=f"Remove {tool} if not required for the application to run",
                    )
                )

    # Check for missing USER instruction (only if we found a FROM)
    if not has_user_instruction and any(l.strip().upper().startswith("FROM ") for l in lines):
        findings.append(
            DockerfileFinding(
                severity="HIGH",
                category="Dockerfile",
                file=file_path,
                line=None,
                description="No USER instruction found — container will run as root",
                impact="Root user has full system access; container escape could compromise host",
                recommendation="Add USER nonroot before CMD/ENTRYPOINT",
            )
        )

    # Check for missing HEALTHCHECK
    if not has_healthcheck:
        findings.append(
            DockerfileFinding(
                severity="LOW",
                category="Dockerfile",
                file=file_path,
                line=None,
                description="No HEALTHCHECK instruction found",
                impact="Orchestrator cannot detect if the application is healthy",
                recommendation="Add HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/health || exit 1",
            )
        )

    return findings
