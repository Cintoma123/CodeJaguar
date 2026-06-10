"""
Pydantic request/response models for all API endpoints.
"""

from pydantic import BaseModel, Field


# ── Shared ──────────────────────────────────────────────

class FileContent(BaseModel):
    path: str
    content: str


# ── Review ──────────────────────────────────────────────

class ReviewRequest(BaseModel):
    diff: str = ""
    files: list[FileContent] = Field(default_factory=list)
    commits: list[str] = Field(default_factory=list)
    provider: str = "openai"
    memory: dict = Field(default_factory=dict)
    rules: str = ""


class ReviewFinding(BaseModel):
    severity: str  # HIGH, MEDIUM, LOW
    category: str  # Performance, Code Smell, Bug, etc.
    file: str
    line: int | None = None
    description: str
    impact: str
    recommendation: str


class ReviewResponse(BaseModel):
    findings: list[ReviewFinding] = Field(default_factory=list)
    summary: str = ""
    provider_used: str = ""
    model_used: str = ""


# ── Security ────────────────────────────────────────────

class SecurityRequest(BaseModel):
    source_files: list[FileContent] = Field(default_factory=list)
    dependency_files: list[FileContent] = Field(default_factory=list)
    docker_files: list[FileContent] = Field(default_factory=list)
    compose_files: list[FileContent] = Field(default_factory=list)
    action_files: list[FileContent] = Field(default_factory=list)
    env_files: list[FileContent] = Field(default_factory=list)
    gitignore: str = ""
    provider: str = "openai"
    scan_modules: list[str] = Field(default_factory=lambda: ["all"])
    memory: dict = Field(default_factory=dict)
    rules: str = ""


class SecurityFinding(BaseModel):
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # Secret, Dependency, Dockerfile, etc.
    module: str = ""
    file: str
    line: int | None = None
    description: str
    impact: str
    recommendation: str


class SecurityStats(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class SecurityResponse(BaseModel):
    findings: list[SecurityFinding] = Field(default_factory=list)
    stats: SecurityStats = Field(default_factory=SecurityStats)
    provider_used: str = ""


# ── Architecture ────────────────────────────────────────

class ArchitectureRequest(BaseModel):
    tree: str = ""
    import_graph: dict = Field(default_factory=dict)
    config_files: list[FileContent] = Field(default_factory=list)
    provider: str = "openai"
    memory: dict = Field(default_factory=dict)
    rules: str = ""


class ArchitectureFinding(BaseModel):
    severity: str
    category: str
    file: str | None = None
    description: str
    recommendation: str


class ArchitectureResponse(BaseModel):
    findings: list[ArchitectureFinding] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    recommendations: str = ""
    provider_used: str = ""


# ── Summary ─────────────────────────────────────────────

class SummaryRequest(BaseModel):
    commits: list[str] = Field(default_factory=list)
    diff: str = ""
    changed_files: list[str] = Field(default_factory=list)
    base_branch: str = "main"
    provider: str = "openai"
    memory: dict = Field(default_factory=dict)
    rules: str = ""


class SummaryResponse(BaseModel):
    markdown: str = ""
    provider_used: str = ""


# ── Provider Test ───────────────────────────────────────

class ProviderTestRequest(BaseModel):
    provider: str
    base_url: str | None = None
    model: str | None = None


class ProviderTestResponse(BaseModel):
    success: bool
    provider: str
    model: str = ""
    latency_ms: int = 0
    error: str | None = None
