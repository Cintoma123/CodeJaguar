"""
Security AI prompt templates.

Builds structured prompts for the AI to analyze security across
different scan modules (source code, dependencies, Docker, etc.).
"""


def build_source_security_prompt(files: list[dict]) -> str:
    """Build prompt for source code security analysis."""
    file_sections = []
    for f in files[:20]:  # Limit to 20 files
        content = f["content"][:15000]  # Truncate large files
        file_sections.append(f"### {f['path']}\n\n```\n{content}\n```")

    files_text = "\n\n".join(file_sections)

    return (
        "You are a senior security engineer. Analyze the following source code files "
        "for security vulnerabilities. Look for:\n"
        "- Hardcoded secrets and credentials\n"
        "- SQL injection vectors\n"
        "- Command injection vectors\n"
        "- Server-Side Request Forgery (SSRF)\n"
        "- Cross-Site Scripting (XSS)\n"
        "- Unsafe deserialization\n"
        "- Weak authentication (missing rate limiting, weak password policy)\n"
        "- Broken authorization (missing ownership checks, IDOR)\n"
        "- Insecure file upload handling\n"
        "- Path traversal vulnerabilities\n\n"
        "Return your findings as a JSON object with this exact structure:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "CRITICAL|HIGH|MEDIUM|LOW",\n'
        '      "category": "Injection|Secret|Auth|AuthZ|Config|Crypto|Other",\n'
        '      "file": "path/to/file.ts",\n'
        '      "line": 42,\n'
        '      "description": "What the vulnerability is",\n'
        '      "impact": "Why it matters and what an attacker could do",\n'
        '      "recommendation": "How to fix it"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text.\n\n"
        "## Source Code Files\n\n" + files_text
    )


def build_dependency_security_prompt(dependencies: list[dict]) -> str:
    """Build prompt for dependency security analysis."""
    dep_lines = []
    for dep in dependencies[:100]:  # Limit to 100 deps
        dep_lines.append(f"- {dep['name']}@{dep['version']} ({dep['language']})")

    deps_text = "\n".join(dep_lines)

    return (
        "You are a senior security engineer. Analyze the following project dependencies "
        "for security risks. Look for:\n"
        "- Packages with known CVEs (use your knowledge of recent vulnerabilities)\n"
        "- Severely outdated packages (major version lag behind current)\n"
        "- Abandoned packages (no recent releases, unmaintained)\n"
        "- Supply-chain risks (typosquatting names, suspicious maintainer changes)\n"
        "- Packages with excessive permissions\n\n"
        "Return your findings as a JSON object:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "CRITICAL|HIGH|MEDIUM|LOW",\n'
        '      "category": "CVE|Outdated|Abandoned|SupplyChain|Permission",\n'
        '      "package": "package-name",\n'
        '      "version": "1.0.0",\n'
        '      "description": "What the issue is",\n'
        '      "impact": "Why it matters",\n'
        '      "recommendation": "How to fix it (e.g., upgrade to X.Y.Z)"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text.\n\n"
        "## Dependencies\n\n" + deps_text
    )


def build_dockerfile_security_prompt(files: list[dict]) -> str:
    """Build prompt for Dockerfile security analysis (supplements rule-based checks)."""
    file_sections = []
    for f in files[:5]:
        content = f["content"][:10000]
        file_sections.append(f"### {f['path']}\n\n```dockerfile\n{content}\n```")

    files_text = "\n\n".join(file_sections)

    return (
        "You are a senior DevOps security engineer. Review the following Dockerfiles "
        "for security best practices. The automated scanner has already caught basic issues — "
        "focus on subtle or contextual problems:\n"
        "- Insecure base images\n"
        "- Missing multi-stage builds (increasing attack surface)\n"
        "- Sensitive data in build context\n"
        "- Inappropriate EXPOSE directives\n"
        "- Missing USER instruction or running as root\n"
        "- Secrets in ENV/ARG instructions\n\n"
        "Return your findings as a JSON object:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "CRITICAL|HIGH|MEDIUM|LOW",\n'
        '      "category": "Dockerfile",\n'
        '      "file": "path/to/Dockerfile",\n'
        '      "line": 10,\n'
        '      "description": "What the issue is",\n'
        '      "impact": "Why it matters",\n'
        '      "recommendation": "How to fix it"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text.\n\n"
        "## Dockerfiles\n\n" + files_text
    )


def build_compose_security_prompt(files: list[dict]) -> str:
    """Build prompt for Docker Compose security analysis."""
    file_sections = []
    for f in files[:5]:
        content = f["content"][:10000]
        file_sections.append(f"### {f['path']}\n\n```yaml\n{content}\n```")

    files_text = "\n\n".join(file_sections)

    return (
        "You are a senior DevOps security engineer. Review the following Docker Compose "
        "files for security issues. The automated scanner has already caught basic issues — "
        "focus on subtle or contextual problems:\n"
        "- Overly permissive network configurations\n"
        "- Missing resource limits\n"
        "- Insecure volume mounts\n"
        "- Hardcoded credentials\n"
        "- Missing security options\n\n"
        "Return your findings as a JSON object:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "CRITICAL|HIGH|MEDIUM|LOW",\n'
        '      "category": "Docker Compose",\n'
        '      "file": "docker-compose.yml",\n'
        '      "line": 15,\n'
        '      "description": "What the issue is",\n'
        '      "impact": "Why it matters",\n'
        '      "recommendation": "How to fix it"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text.\n\n"
        "## Docker Compose Files\n\n" + files_text
    )


def build_actions_security_prompt(files: list[dict]) -> str:
    """Build prompt for GitHub Actions security analysis."""
    file_sections = []
    for f in files[:10]:
        content = f["content"][:10000]
        file_sections.append(f"### {f['path']}\n\n```yaml\n{content}\n```")

    files_text = "\n\n".join(file_sections)

    return (
        "You are a senior security engineer. Review the following GitHub Actions "
        "workflow files for security issues. The automated scanner has already caught "
        "basic issues — focus on subtle or contextual problems:\n"
        "- Insecure use of third-party actions\n"
        "- Missing OIDC token configuration\n"
        "- Insecure artifact handling\n"
        "- Missing concurrency controls\n"
        "- Workflow injection vulnerabilities\n\n"
        "Return your findings as a JSON object:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "CRITICAL|HIGH|MEDIUM|LOW",\n'
        '      "category": "GitHub Actions",\n'
        '      "file": ".github/workflows/deploy.yml",\n'
        '      "line": 25,\n'
        '      "description": "What the issue is",\n'
        '      "impact": "Why it matters",\n'
        '      "recommendation": "How to fix it"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text.\n\n"
        "## GitHub Actions Workflows\n\n" + files_text
    )


def build_full_security_prompt(
    source_files: list[dict] | None = None,
    dependency_files: list[dict] | None = None,
    docker_files: list[dict] | None = None,
    compose_files: list[dict] | None = None,
    action_files: list[dict] | None = None,
    env_files: list[dict] | None = None,
    gitignore_content: str = "",
) -> str:
    """
    Build a comprehensive security analysis prompt combining all modules.

    This is used for the full security scan mode.
    """
    sections = []

    sections.append(
        "You are a senior security engineer and DevSecOps expert. "
        "Perform a comprehensive security scan of the following project files. "
        "Analyze each category and return structured findings.\n\n"
        "Return a JSON object with this exact structure:\n"
        "{\n"
        '  "findings": [\n'
        "    {\n"
        '      "severity": "CRITICAL|HIGH|MEDIUM|LOW",\n'
        '      "category": "Secret|Dependency|Dockerfile|Compose|Actions|Environment|Gitignore|Source",\n'
        '      "module": "secret_scanner|dependency|dockerfile|compose|actions|env|gitignore|source_ai",\n'
        '      "file": "path/to/file",\n'
        '      "line": 42,\n'
        '      "description": "What the issue is",\n'
        '      "impact": "Why it matters",\n'
        '      "recommendation": "How to fix it"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return ONLY the JSON object, no markdown fences, no extra text.\n"
    )

    if source_files:
        file_sections = []
        for f in source_files[:20]:
            content = f["content"][:10000]
            file_sections.append(f"### {f['path']}\n\n```\n{content}\n```")
        sections.append("## Source Code Files\n\n" + "\n\n".join(file_sections))

    if dependency_files:
        dep_lines = []
        for f in dependency_files[:50]:
            content = f["content"][:5000]
            dep_lines.append(f"### {f['path']}\n\n```\n{content}\n```")
        sections.append("## Dependency Files\n\n" + "\n\n".join(dep_lines))

    if docker_files:
        for f in docker_files[:5]:
            sections.append(f"## Dockerfile: {f['path']}\n\n```dockerfile\n{f['content'][:5000]}\n```")

    if compose_files:
        for f in compose_files[:5]:
            sections.append(f"## Docker Compose: {f['path']}\n\n```yaml\n{f['content'][:5000]}\n```")

    if action_files:
        for f in action_files[:10]:
            sections.append(f"## GitHub Actions: {f['path']}\n\n```yaml\n{f['content'][:5000]}\n```")

    if env_files:
        for f in env_files[:10]:
            sections.append(f"## Environment File: {f['path']}\n\n```\n{f['content'][:2000]}\n```")

    if gitignore_content:
        sections.append(f"## .gitignore\n\n```\n{gitignore_content[:2000]}\n```")

    return "\n\n---\n\n".join(sections)
