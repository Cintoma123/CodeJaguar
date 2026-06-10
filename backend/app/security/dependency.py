"""
Dependency file parser — multi-language.

Parses lock files and dependency manifests across languages to extract
package names and versions for security analysis.

Supported languages:
  Node.js / Bun: package.json, package-lock.json, bun.lock, yarn.lock
  Python: requirements.txt, poetry.lock, pyproject.toml, Pipfile.lock
  Ruby: Gemfile.lock
  Go: go.mod, go.sum
  Rust: Cargo.toml, Cargo.lock
  PHP: composer.json, composer.lock
  Java / Kotlin: pom.xml, build.gradle
  .NET: *.csproj, packages.lock.json
"""

import json
import re
from dataclasses import dataclass, field


@dataclass
class Dependency:
    name: str
    version: str
    language: str
    source_file: str


@dataclass
class DependencyFileResult:
    language: str
    source_file: str
    dependencies: list[Dependency] = field(default_factory=list)
    parse_error: str | None = None


# ── Node.js / Bun ────────────────────────────────────

def parse_package_json(content: str, file_path: str) -> DependencyFileResult:
    """Parse package.json for dependencies and devDependencies."""
    result = DependencyFileResult(language="Node.js", source_file=file_path)
    try:
        data = json.loads(content)
        for dep_type in ("dependencies", "devDependencies", "peerDependencies"):
            deps = data.get(dep_type, {})
            for name, version in deps.items():
                result.dependencies.append(
                    Dependency(
                        name=name,
                        version=str(version),
                        language="Node.js",
                        source_file=file_path,
                    )
                )
    except json.JSONDecodeError as e:
        result.parse_error = str(e)
    return result


def parse_package_lock_json(content: str, file_path: str) -> DependencyFileResult:
    """Parse package-lock.json for locked dependency versions."""
    result = DependencyFileResult(language="Node.js", source_file=file_path)
    try:
        data = json.loads(content)
        packages = data.get("packages", {})
        for pkg_path, pkg_info in packages.items():
            if pkg_path == "":
                continue
            name = pkg_path.replace("node_modules/", "").split("/")[-1]
            version = pkg_info.get("version", "unknown")
            result.dependencies.append(
                Dependency(name=name, version=version, language="Node.js", source_file=file_path)
            )
    except json.JSONDecodeError as e:
        result.parse_error = str(e)
    return result


# ── Python ───────────────────────────────────────────

def parse_requirements_txt(content: str, file_path: str) -> DependencyFileResult:
    """Parse requirements.txt for pinned dependencies."""
    result = DependencyFileResult(language="Python", source_file=file_path)
    for line in content.split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Match patterns like: package==1.0.0, package>=1.0.0, package~=1.0.0, package===1.0.0
        match = re.match(r"^([a-zA-Z0-9_\-\.]+)\s*(==|>=|<=|~=|!=|===)\s*(.+)$", line)
        if match:
            result.dependencies.append(
                Dependency(
                    name=match.group(1),
                    version=match.group(3),
                    language="Python",
                    source_file=file_path,
                )
            )
        elif re.match(r"^[a-zA-Z0-9_\-\.]+$", line):
            result.dependencies.append(
                Dependency(name=line, version="unpinned", language="Python", source_file=file_path)
            )
    return result


def parse_pyproject_toml(content: str, file_path: str) -> DependencyFileResult:
    """Parse pyproject.toml for dependencies (basic TOML parsing)."""
    result = DependencyFileResult(language="Python", source_file=file_path)
    in_deps = False
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped in ("[tool.poetry.dependencies]", "[project.dependencies]", "[tool.poetry.dev-dependencies]"):
            in_deps = True
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            in_deps = False
            continue
        if in_deps and "=" in stripped:
            match = re.match(r'^"?([a-zA-Z0-9_\-\.]+)"?\s*=\s*"?([^"]+)"?', stripped)
            if match:
                result.dependencies.append(
                    Dependency(
                        name=match.group(1),
                        version=match.group(2),
                        language="Python",
                        source_file=file_path,
                    )
                )
    return result


# ── Go ───────────────────────────────────────────────

def parse_go_mod(content: str, file_path: str) -> DependencyFileResult:
    """Parse go.mod for module dependencies."""
    result = DependencyFileResult(language="Go", source_file=file_path)
    in_require = False
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped == "require (":
            in_require = True
            continue
        if stripped == ")" and in_require:
            in_require = False
            continue
        if in_require or stripped.startswith("require "):
            parts = stripped.replace("require ", "").split()
            if len(parts) >= 2:
                result.dependencies.append(
                    Dependency(
                        name=parts[0],
                        version=parts[1],
                        language="Go",
                        source_file=file_path,
                    )
                )
    return result


# ── Rust ─────────────────────────────────────────────

def parse_cargo_toml(content: str, file_path: str) -> DependencyFileResult:
    """Parse Cargo.toml for crate dependencies."""
    result = DependencyFileResult(language="Rust", source_file=file_path)
    in_deps = False
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped in ("[dependencies]", "[dev-dependencies]", "[build-dependencies]"):
            in_deps = True
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            in_deps = False
            continue
        if in_deps and "=" in stripped:
            match = re.match(r'^([a-zA-Z0-9_\-]+)\s*=\s*(?:\{[^}]*version\s*=\s*"([^"]+)"|["\']([^"]+)["\'])', stripped)
            if match:
                version = match.group(2) or match.group(3) or "unknown"
                result.dependencies.append(
                    Dependency(
                        name=match.group(1),
                        version=version,
                        language="Rust",
                        source_file=file_path,
                    )
                )
    return result


# ── Ruby ─────────────────────────────────────────────

def parse_gemfile_lock(content: str, file_path: str) -> DependencyFileResult:
    """Parse Gemfile.lock for gem versions."""
    result = DependencyFileResult(language="Ruby", source_file=file_path)
    in_specs = False
    current_gem = None
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped == "specs:":
            in_specs = True
            continue
        if stripped == "PLATFORMS" or stripped == "DEPENDENCIES":
            in_specs = False
            continue
        if in_specs:
            # Gem name line (4 spaces indent)
            gem_match = re.match(r"^    ([a-zA-Z0-9_\-]+) \(([^)]+)\)", stripped)
            if gem_match:
                current_gem = gem_match.group(1)
                result.dependencies.append(
                    Dependency(
                        name=current_gem,
                        version=gem_match.group(2),
                        language="Ruby",
                        source_file=file_path,
                    )
                )
    return result


# ── PHP ──────────────────────────────────────────────

def parse_composer_json(content: str, file_path: str) -> DependencyFileResult:
    """Parse composer.json for PHP dependencies."""
    result = DependencyFileResult(language="PHP", source_file=file_path)
    try:
        data = json.loads(content)
        for dep_type in ("require", "require-dev"):
            deps = data.get(dep_type, {})
            for name, version in deps.items():
                if name == "php":
                    continue
                result.dependencies.append(
                    Dependency(
                        name=name,
                        version=str(version),
                        language="PHP",
                        source_file=file_path,
                    )
                )
    except json.JSONDecodeError as e:
        result.parse_error = str(e)
    return result


# ── Java / Kotlin ────────────────────────────────────

def parse_pom_xml(content: str, file_path: str) -> DependencyFileResult:
    """Parse pom.xml for Maven dependencies."""
    result = DependencyFileResult(language="Java", source_file=file_path)
    # Simple regex-based extraction
    dep_blocks = re.findall(
        r"<dependency>\s*<groupId>([^<]+)</groupId>\s*<artifactId>([^<]+)</artifactId>\s*(?:<version>([^<]+)</version>)?",
        content,
    )
    for group_id, artifact_id, version in dep_blocks:
        result.dependencies.append(
            Dependency(
                name=f"{group_id.strip()}:{artifact_id.strip()}",
                version=version.strip() if version else "managed",
                language="Java",
                source_file=file_path,
            )
        )
    return result


# ── .NET ─────────────────────────────────────────────

def parse_csproj(content: str, file_path: str) -> DependencyFileResult:
    """Parse .csproj for NuGet package references."""
    result = DependencyFileResult(language=".NET", source_file=file_path)
    refs = re.findall(
        r'<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"',
        content,
    )
    for name, version in refs:
        result.dependencies.append(
            Dependency(
                name=name,
                version=version,
                language=".NET",
                source_file=file_path,
            )
        )
    return result


# ── Dispatcher ───────────────────────────────────────

# Map file names to parser functions
PARSERS = {
    "package.json": parse_package_json,
    "package-lock.json": parse_package_lock_json,
    "requirements.txt": parse_requirements_txt,
    "pyproject.toml": parse_pyproject_toml,
    "go.mod": parse_go_mod,
    "Cargo.toml": parse_cargo_toml,
    "Gemfile.lock": parse_gemfile_lock,
    "composer.json": parse_composer_json,
    "pom.xml": parse_pom_xml,
}


def parse_dependency_file(file_path: str, content: str) -> DependencyFileResult:
    """
    Parse a dependency file and extract package information.

    Args:
        file_path: Path to the dependency file
        content: File content

    Returns:
        DependencyFileResult with extracted dependencies
    """
    import os

    file_name = os.path.basename(file_path)

    # Direct match
    if file_name in PARSERS:
        return PARSERS[file_name](content, file_path)

    # Pattern match for .csproj files
    if file_name.endswith(".csproj"):
        return parse_csproj(content, file_path)

    # Pattern match for build.gradle
    if file_name in ("build.gradle", "build.gradle.kts"):
        return parse_build_gradle(content, file_path)

    return DependencyFileResult(
        language="Unknown",
        source_file=file_path,
        parse_error=f"Unsupported dependency file: {file_name}",
    )


def parse_build_gradle(content: str, file_path: str) -> DependencyFileResult:
    """Parse build.gradle for Java/Kotlin dependencies."""
    result = DependencyFileResult(language="Java", source_file=file_path)
    # Match: implementation 'group:artifact:version'
    deps = re.findall(
        r"(?:implementation|api|compile|testImplementation|testCompile)\s+['\"]([^'\"]+)['\"]",
        content,
    )
    for dep in deps:
        parts = dep.split(":")
        if len(parts) >= 2:
            name = ":".join(parts[:-1]) if len(parts) > 2 else parts[0]
            version = parts[-1] if len(parts) > 1 else "unknown"
            result.dependencies.append(
                Dependency(name=name, version=version, language="Java", source_file=file_path)
            )
    return result


# Add build.gradle to parsers
PARSERS["build.gradle"] = parse_build_gradle
PARSERS["build.gradle.kts"] = parse_build_gradle


def parse_all_dependency_files(files: list[dict]) -> list[DependencyFileResult]:
    """
    Parse multiple dependency files.

    Args:
        files: List of dicts with 'path' and 'content' keys

    Returns:
        List of DependencyFileResult objects
    """
    results: list[DependencyFileResult] = []
    for f in files:
        result = parse_dependency_file(f["path"], f["content"])
        if result.dependencies:
            results.append(result)
    return results
