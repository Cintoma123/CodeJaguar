"""
Docker Compose security analyzer.

Detects common Docker Compose security issues:
- privileged: true containers
- Host network mode (network_mode: host)
- Dangerous volume mounts (/, /etc, /var/run/docker.sock)
- Hardcoded credentials in environment variables
- Missing resource limits (mem_limit, cpus)
- Dangerous Linux capabilities (cap_add: [SYS_ADMIN])
"""

import re
from dataclasses import dataclass


@dataclass
class ComposeFinding:
    severity: str
    category: str
    file: str
    line: int | None
    description: str
    impact: str
    recommendation: str


def analyze_compose_file(file_path: str, content: str) -> list[ComposeFinding]:
    """
    Analyze a Docker Compose file for security issues.

    Args:
        file_path: Path to the compose file
        content: Compose file content (YAML)

    Returns:
        List of ComposeFinding objects
    """
    findings: list[ComposeFinding] = []
    lines = content.split("\n")

    # Track which service we're in
    current_service = None
    service_indent = 0

    for line_num, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Detect service name (top-level key under 'services:')
        indent = len(line) - len(line.lstrip())
        if indent == 4 and not stripped.startswith("-") and stripped.endswith(":"):
            current_service = stripped[:-1]
            service_indent = indent

        # Check for privileged mode
        if "privileged: true" in stripped.lower():
            findings.append(
                ComposeFinding(
                    severity="CRITICAL",
                    category="Docker Compose",
                    file=file_path,
                    line=line_num,
                    description=f"Service '{current_service or 'unknown'}' uses privileged: true",
                    impact="Privileged containers have full access to host resources and can escape isolation",
                    recommendation="Remove privileged: true. Use specific capabilities via cap_add instead",
                )
            )

        # Check for host network mode
        if "network_mode: host" in stripped.lower():
            findings.append(
                ComposeFinding(
                    severity="HIGH",
                    category="Docker Compose",
                    file=file_path,
                    line=line_num,
                    description=f"Service '{current_service or 'unknown'}' uses network_mode: host",
                    impact="Container shares host network stack; can access host network services",
                    recommendation="Use a custom bridge network and expose only required ports",
                )
            )

        # Check for dangerous volume mounts
        dangerous_mounts = {
            "/var/run/docker.sock": "CRITICAL",
            "/": "HIGH",
            "/etc": "HIGH",
            "/proc": "HIGH",
            "/sys": "HIGH",
            "/root": "MEDIUM",
            "/home": "MEDIUM",
        }
        for mount, severity in dangerous_mounts.items():
            if f"- {mount}:" in stripped or f"- '{mount}':" in stripped or f'- "{mount}":' in stripped:
                findings.append(
                    ComposeFinding(
                        severity=severity,
                        category="Docker Compose",
                        file=file_path,
                        line=line_num,
                        description=f"Service '{current_service or 'unknown'}' mounts '{mount}' from host",
                        impact=f"Mounting {mount} gives container access to host filesystem/resources",
                        recommendation=f"Remove the {mount} mount or use read-only mode with minimal access",
                    )
                )

        # Check for hardcoded credentials in environment
        secret_patterns = [
            ("PASSWORD", "HIGH"),
            ("SECRET", "HIGH"),
            ("API_KEY", "CRITICAL"),
            ("APIKEY", "CRITICAL"),
            ("TOKEN", "HIGH"),
            ("PRIVATE_KEY", "CRITICAL"),
            ("ACCESS_KEY", "CRITICAL"),
        ]
        for pattern, severity in secret_patterns:
            if pattern in stripped.upper() and ("=" in stripped or ":" in stripped):
                # Check it's not using ${VAR} syntax (env var reference)
                value_part = stripped.split("=", 1)[-1].split(":", 1)[-1].strip()
                if not value_part.startswith("${"):
                    findings.append(
                        ComposeFinding(
                            severity=severity,
                            category="Secret",
                            file=file_path,
                            line=line_num,
                            description=f"Hardcoded {pattern} in environment variables",
                            impact="Secrets in compose files are visible in version control",
                            recommendation=f"Use environment variable substitution: {pattern}: ${{{pattern}}}",
                        )
                    )

        # Check for dangerous capabilities
        dangerous_caps = ["SYS_ADMIN", "SYS_PTRACE", "SYS_RAWIO", "DAC_READ_SEARCH", "NET_ADMIN"]
        for cap in dangerous_caps:
            if cap in stripped.upper():
                findings.append(
                    ComposeFinding(
                        severity="HIGH",
                        category="Docker Compose",
                        file=file_path,
                        line=line_num,
                        description=f"Service '{current_service or 'unknown'}' adds dangerous capability: {cap}",
                        impact=f"{cap} grants elevated privileges that could be used for container escape",
                        recommendation=f"Remove {cap} from cap_add unless absolutely necessary",
                    )
                )

    # Check for missing resource limits (file-level)
    if "mem_limit" not in content and "mem_limit" not in content:
        findings.append(
            ComposeFinding(
                severity="MEDIUM",
                category="Docker Compose",
                file=file_path,
                line=None,
                description="No memory limits (mem_limit) found in compose file",
                impact="Containers can consume all host memory, causing denial of service",
                recommendation="Add mem_limit to each service: mem_limit: 512m",
            )
        )

    if "cpus" not in content and "cpu_shares" not in content:
        findings.append(
            ComposeFinding(
                severity="MEDIUM",
                category="Docker Compose",
                file=file_path,
                line=None,
                description="No CPU limits (cpus) found in compose file",
                impact="Containers can consume all host CPU, causing denial of service",
                recommendation="Add CPU limits to each service: cpus: '0.5'",
            )
        )

    return findings
