"""
GitHub Actions security analyzer.

Detects common GitHub Actions workflow security issues:
- Unpinned actions (using @main or @latest instead of SHA)
- pull_request_target with checkout of untrusted code
- Secrets printed to logs via echo
- Excessive token permissions (permissions: write-all)
- Insecure use of ${{ github.event.inputs }} without sanitization
- Third-party actions from unverified publishers
"""

import re
from dataclasses import dataclass


@dataclass
class ActionsFinding:
    severity: str
    category: str
    file: str
    line: int | None
    description: str
    impact: str
    recommendation: str


def analyze_actions_file(file_path: str, content: str) -> list[ActionsFinding]:
    """
    Analyze a GitHub Actions workflow file for security issues.

    Args:
        file_path: Path to the workflow file
        content: Workflow YAML content

    Returns:
        List of ActionsFinding objects
    """
    findings: list[ActionsFinding] = []
    lines = content.split("\n")

    in_pull_request_target = False
    has_untrusted_checkout = False

    for line_num, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Check for unpinned actions (uses: @main, @latest, @v1 without SHA)
        uses_match = re.match(r"uses:\s*([^\s]+)", stripped)
        if uses_match:
            action_ref = uses_match.group(1)
            # Check if it's a version tag (not a SHA)
            if re.search(r"@(main|master|latest|v\d+)$", action_ref):
                findings.append(
                    ActionsFinding(
                        severity="HIGH",
                        category="GitHub Actions",
                        file=file_path,
                        line=line_num,
                        description=f"Action '{action_ref}' is pinned to a branch/tag, not a SHA",
                        impact="Branch/tag can be updated to include malicious code",
                        recommendation=f"Pin to a specific commit SHA: uses: {action_ref.split('@')[0]}@<full-sha>",
                    )
                )

        # Check for pull_request_target trigger
        if "pull_request_target" in stripped:
            in_pull_request_target = True

        # Check for checkout in pull_request_target context
        if in_pull_request_target and "uses: actions/checkout" in stripped:
            has_untrusted_checkout = True
            findings.append(
                ActionsFinding(
                    severity="CRITICAL",
                    category="GitHub Actions",
                    file=file_path,
                    line=line_num,
                    description="actions/checkout used in pull_request_target context",
                    impact="pull_request_target runs in the context of the base repository with access to secrets; checking out untrusted PR code is dangerous",
                    recommendation="Avoid checking out PR code in pull_request_target, or use a separate job without secret access",
                )
            )

        # Check for secrets printed to logs
        if "secrets." in stripped and any(kw in stripped.lower() for kw in ["echo", "print", "log", "console"]):
            findings.append(
                ActionsFinding(
                    severity="CRITICAL",
                    category="GitHub Actions",
                    file=file_path,
                    line=line_num,
                    description="Secret value may be printed to logs",
                    impact="Secrets logged in workflow output are visible to anyone with repo read access",
                    recommendation="Never echo or print secret values. Use them only as inputs to trusted actions",
                )
            )

        # Check for excessive permissions
        if "permissions:" in stripped:
            # Check next few lines for write-all
            remaining_content = "\n".join(lines[line_num - 1:line_num + 5])
            if "write-all" in remaining_content:
                findings.append(
                    ActionsFinding(
                        severity="HIGH",
                        category="GitHub Actions",
                        file=file_path,
                        line=line_num,
                        description="Workflow uses permissions: write-all",
                        impact="write-all grants full write access to all scopes including contents, actions, packages",
                        recommendation="Use least-privilege permissions: permissions: { contents: read, issues: write }",
                    )
                )

        # Check for unsanitized event inputs
        if "github.event.inputs" in stripped:
            # Check if it's used in a shell context without sanitization
            if any(kw in stripped.lower() for kw in ["run:", "shell:", "bash", "sh -c"]):
                findings.append(
                    ActionsFinding(
                        severity="HIGH",
                        category="GitHub Actions",
                        file=file_path,
                        line=line_num,
                        description="Unsanitized github.event.inputs used in shell context",
                        impact="Malicious input values could lead to command injection",
                        recommendation="Sanitize inputs or use them as action inputs instead of shell interpolation",
                    )
                )

        # Check for third-party actions from unverified publishers
        uses_match = re.match(r"uses:\s*([^/]+)/([^@]+)@", stripped)
        if uses_match:
            publisher = uses_match.group(1)
            trusted_publishers = [
                "actions", "github", "docker", "aws-actions",
                "azure", "google-github-actions", "codecov",
                "dependabot", "renovatebot",
            ]
            if publisher not in trusted_publishers:
                findings.append(
                    ActionsFinding(
                        severity="MEDIUM",
                        category="GitHub Actions",
                        file=file_path,
                        line=line_num,
                        description=f"Third-party action from '{publisher}' (unverified publisher)",
                        impact="Third-party actions may contain malicious code or be compromised",
                        recommendation=f"Review the action source code at https://github.com/{publisher}/ and pin to a specific SHA",
                    )
                )

    return findings
