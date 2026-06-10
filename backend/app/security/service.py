"""
Security scan orchestrator.

Coordinates all security scan modules:
1. Secret pattern scanner (fast, deterministic — runs first)
2. Dependency file parser
3. Dockerfile analyzer
4. Docker Compose analyzer
5. GitHub Actions analyzer
6. Environment file analyzer
7. .gitignore gap analyzer
8. AI-powered analysis (for findings that need contextual understanding)

If CRITICAL secrets are found, returns immediately with those findings.
"""

import json
from typing import Any

from ..provider_manager import get_provider
from .secrets import scan_files as scan_secrets, has_critical_findings
from .dependency import parse_all_dependency_files
from .dockerfile import analyze_dockerfile
from .compose import analyze_compose_file
from .actions import analyze_actions_file
from .env import analyze_env_file
from .gitignore import analyze_gitignore
from .prompts import build_full_security_prompt


def _parse_ai_response(response_text: str) -> list[dict]:
    """Parse AI response text into a list of finding dicts."""
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    try:
        data = json.loads(cleaned)
        return data.get("findings", [])
    except json.JSONDecodeError:
        return []


def run_security_scan(
    body: Any,
    api_key: str,
) -> dict:
    """
    Run a comprehensive security scan.

    Args:
        body: SecurityRequest with all file contents
        api_key: Provider API key

    Returns:
        Dict with findings, stats, provider_used
    """
    all_findings: list[dict] = []

    # ── Step 1: Secret Pattern Scanner (fast, deterministic) ──────
    source_files = body.source_files if hasattr(body, 'source_files') else []
    dep_files = body.dependency_files if hasattr(body, 'dependency_files') else []
    docker_files = body.docker_files if hasattr(body, 'docker_files') else []
    compose_files = body.compose_files if hasattr(body, 'compose_files') else []
    action_files = body.action_files if hasattr(body, 'action_files') else []
    env_files = body.env_files if hasattr(body, 'env_files') else []
    gitignore = body.gitignore if hasattr(body, 'gitignore') else ""
    scan_modules = body.scan_modules if hasattr(body, 'scan_modules') else ["all"]

    do_all = "all" in scan_modules

    # Scan source files for secrets
    if source_files and (do_all or "secrets" in scan_modules):
        secret_findings = scan_secrets(
            [{"path": f.path, "content": f.content} for f in source_files]
        )
        for sf in secret_findings:
            all_findings.append({
                "severity": sf.severity,
                "category": "Secret",
                "module": sf.module,
                "file": sf.file,
                "line": sf.line,
                "description": sf.description,
                "impact": sf.impact,
                "recommendation": sf.recommendation,
            })

        # If CRITICAL secrets found, return immediately
        if has_critical_findings(secret_findings):
            return {
                "findings": all_findings,
                "stats": _calc_stats(all_findings),
                "provider_used": body.provider,
            }

    # ── Step 2: Dockerfile Analysis ───────────────────────────────
    if docker_files and (do_all or "docker" in scan_modules):
        for f in docker_files:
            docker_findings = analyze_dockerfile(f.path, f.content)
            for df in docker_findings:
                all_findings.append({
                    "severity": df.severity,
                    "category": df.category,
                    "module": "dockerfile",
                    "file": df.file,
                    "line": df.line,
                    "description": df.description,
                    "impact": df.impact,
                    "recommendation": df.recommendation,
                })

    # ── Step 3: Docker Compose Analysis ───────────────────────────
    if compose_files and (do_all or "docker" in scan_modules):
        for f in compose_files:
            compose_findings = analyze_compose_file(f.path, f.content)
            for cf in compose_findings:
                all_findings.append({
                    "severity": cf.severity,
                    "category": cf.category,
                    "module": "compose",
                    "file": cf.file,
                    "line": cf.line,
                    "description": cf.description,
                    "impact": cf.impact,
                    "recommendation": cf.recommendation,
                })

    # ── Step 4: GitHub Actions Analysis ───────────────────────────
    if action_files and (do_all or "actions" in scan_modules):
        for f in action_files:
            actions_findings = analyze_actions_file(f.path, f.content)
            for af in actions_findings:
                all_findings.append({
                    "severity": af.severity,
                    "category": af.category,
                    "module": "actions",
                    "file": af.file,
                    "line": af.line,
                    "description": af.description,
                    "impact": af.impact,
                    "recommendation": af.recommendation,
                })

    # ── Step 5: Environment File Analysis ─────────────────────────
    if env_files and (do_all or "secrets" in scan_modules):
        for f in env_files:
            env_findings = analyze_env_file(f.path, f.content)
            for ef in env_findings:
                all_findings.append({
                    "severity": ef.severity,
                    "category": ef.category,
                    "module": "env",
                    "file": ef.file,
                    "line": ef.line,
                    "description": ef.description,
                    "impact": ef.impact,
                    "recommendation": ef.recommendation,
                })

    # ── Step 6: .gitignore Gap Analysis ───────────────────────────
    if gitignore and do_all:
        gitignore_findings = analyze_gitignore(gitignore)
        for gf in gitignore_findings:
            all_findings.append({
                "severity": gf.severity,
                "category": gf.category,
                "module": "gitignore",
                "file": gf.file,
                "line": gf.line,
                "description": gf.description,
                "impact": gf.impact,
                "recommendation": gf.recommendation,
            })

    # ── Step 7: AI-Powered Analysis ───────────────────────────────
    # Use AI for contextual analysis that rule-based checks can't catch
    if source_files or dependency_files:
        try:
            provider = get_provider(
                name=body.provider,
                api_key=api_key,
            )

            prompt = build_full_security_prompt(
                source_files=[{"path": f.path, "content": f.content} for f in source_files[:10]] if source_files else None,
                dependency_files=[{"path": f.path, "content": f.content} for f in dep_files[:5]] if dep_files else None,
                docker_files=[{"path": f.path, "content": f.content} for f in docker_files[:3]] if docker_files else None,
                compose_files=[{"path": f.path, "content": f.content} for f in compose_files[:3]] if compose_files else None,
                action_files=[{"path": f.path, "content": f.content} for f in action_files[:5]] if action_files else None,
                env_files=[{"path": f.path, "content": f.content} for f in env_files[:5]] if env_files else None,
                gitignore_content=gitignore if gitignore else "",
            )

            system = (
                "You are a senior security engineer and DevSecOps expert. "
                "Analyze the provided project files for security vulnerabilities. "
                "Return findings as structured JSON. "
                "Return ONLY the JSON object, no markdown fences, no extra text."
            )

            ai_response = await provider.complete(
                prompt=prompt,
                system=system,
                max_tokens=4096,
                temperature=0.3,
            )

            ai_findings = _parse_ai_response(ai_response)
            all_findings.extend(ai_findings)

        except Exception as e:
            # If AI analysis fails, return what we have from rule-based scans
            pass

    return {
        "findings": all_findings,
        "stats": _calc_stats(all_findings),
        "provider_used": body.provider,
    }


def _calc_stats(findings: list[dict]) -> dict:
    """Calculate severity statistics from findings."""
    stats = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = f.get("severity", "").lower()
        if sev in stats:
            stats[sev] += 1
    return stats
