# Codejaguar — Complete MVP Implementation Plan

> **Local-first · BYOK · No SaaS · No Cloud · No Database · No Telemetry**

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Core Principles](#2-core-principles)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack](#4-tech-stack)
5. [Project Structure](#5-project-structure)
6. [Secure Credential System (BYOK)](#6-secure-credential-system-byok)
7. [Provider Abstraction Layer](#7-provider-abstraction-layer)
8. [CLI Command Specifications](#8-cli-command-specifications)
9. [Backend API Specification](#9-backend-api-specification)
10. [Advanced Features](#10-advanced-features)
11. [Four-Week Delivery Plan](#11-four-week-delivery-plan)
12. [Testing Strategy](#12-testing-strategy)
13. [Documentation & Publishing](#13-documentation--publishing)
14. [Success Criteria](#14-success-criteria)

---

## 1. Product Vision

Codejaguar is a **production-grade, local-first AI Code Review and DevSecOps CLI**. It runs entirely on the user's machine with no cloud infrastructure, no database, no user accounts, and no telemetry. Users bring their own API keys (BYOK) for any AI provider. The tool acts as a personal senior engineer and security auditor embedded directly in the developer workflow.

**CLI invocation pattern:**

```
jaguar review
jaguar security
jaguar architecture
jaguar summary
jaguar auth <subcommand>
jaguar protect
```

**Installation:**

```bash
npm install -g codejaguar-review
# or
bun install -g codejaguar-review
```

---

## 2. Core Principles

| Principle | Constraint |
|-----------|------------|
| Local-first | All processing happens on the user's machine |
| BYOK | User supplies their own provider API keys |
| No SaaS | No hosted backend, no external service calls except the AI provider |
| No cloud backend | FastAPI runs on `localhost` only |
| No database | File-based state only (memory.json, rules.md) |
| No user accounts | No auth system, no login |
| No billing | No payment layer |
| No telemetry | Zero analytics by default; opt-in only if ever added |
| No GitHub App | Works purely via local git commands |
| No deployment | Nothing to deploy; install and run |

---

## 3. Architecture Overview

```
User Terminal
     │
     ▼
TypeScript CLI (Commander.js)
     │  HTTP POST to localhost
     ▼
FastAPI Backend (localhost:PORT)
     │
     ▼
Provider Abstraction Layer
     │
     ├── OpenAI
     ├── Anthropic
     ├── Gemini
     ├── DeepSeek
     └── Any provider with an API key
```

### Communication Flow

1. CLI command invoked by user.
2. CLI gathers context (git diff, file tree, lock files, etc.).
3. CLI reads stored API key from OS keychain.
4. CLI sends structured POST request to local FastAPI.
5. FastAPI selects provider, injects memory + rules into prompt, calls AI API.
6. FastAPI parses and structures the response.
7. CLI receives JSON, formats and renders to terminal.

### Backend Lifecycle

The FastAPI backend is started automatically by the CLI on first command if not already running. It binds only to `127.0.0.1` (loopback), never `0.0.0.0`. A PID file tracks the running process. The CLI checks the PID file before starting a new instance.

---

## 4. Tech Stack

### CLI (TypeScript)

| Package | Purpose |
|---------|---------|
| `commander` | Command and subcommand parsing |
| `axios` | HTTP client to local FastAPI |
| `chalk` | Colored terminal output |
| `ora` | Spinner for loading states |
| `keytar` | Cross-platform OS keychain access |
| `simple-git` | Git diff and log extraction |
| `boxen` | Styled terminal boxes for output |
| `table` | Tabular output rendering |

**Runtime:** Node.js ≥ 18 and Bun ≥ 1.0 both supported.

### Backend (Python)

| Package | Purpose |
|---------|---------|
| `fastapi` | API framework |
| `uvicorn` | ASGI server |
| `pydantic` | Request/response validation |
| `httpx` | Async HTTP client for provider calls |
| `secretstorage` | Linux Secret Service API |
| `python-dotenv` | Env management (internal only) |
| `toml` | pyproject.toml parsing |
| `pyyaml` | Docker Compose and GitHub Actions parsing |

---

## 5. Project Structure

```
codejaguar/
│
├── cli/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── auth.ts          # BYOK credential management
│   │   │   ├── review.ts        # Code review command
│   │   │   ├── security.ts      # Security scan command
│   │   │   ├── architecture.ts  # Architecture review command
│   │   │   ├── summary.ts       # PR summary generator
│   │   │   └── protect.ts       # Git hook installation
│   │   │
│   │   ├── services/
│   │   │   ├── backend.ts       # Backend lifecycle (start/stop/health)
│   │   │   ├── git.ts           # Git context extraction
│   │   │   ├── context.ts       # Memory + rules loader
│   │   │   └── output.ts        # Terminal rendering
│   │   │
│   │   ├── providers/
│   │   │   └── keychain.ts      # OS keychain read/write via keytar
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.ts        # Internal debug logging
│   │   │   └── errors.ts        # Typed error handling
│   │   │
│   │   ├── types/
│   │   │   ├── review.ts
│   │   │   ├── security.ts
│   │   │   ├── provider.ts
│   │   │   └── config.ts
│   │   │
│   │   └── index.ts             # CLI entrypoint (Commander root)
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── bun.lockb
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py        # POST /review /security /architecture /summary /providers/test
│   │   │
│   │   ├── review/
│   │   │   ├── service.py       # Review orchestration
│   │   │   └── prompts.py       # Review prompt templates
│   │   │
│   │   ├── security/
│   │   │   ├── service.py       # Security scan orchestration
│   │   │   ├── prompts.py       # Security prompt templates
│   │   │   ├── dependency.py    # Dependency file parser (multi-language)
│   │   │   ├── dockerfile.py    # Dockerfile analyzer
│   │   │   ├── compose.py       # Docker Compose analyzer
│   │   │   ├── actions.py       # GitHub Actions analyzer
│   │   │   ├── env.py           # .env file analyzer
│   │   │   ├── secrets.py       # Secret pattern scanner
│   │   │   └── gitignore.py     # .gitignore gap analyzer
│   │   │
│   │   ├── architecture/
│   │   │   ├── service.py       # Architecture orchestration
│   │   │   └── prompts.py       # Architecture prompt templates
│   │   │
│   │   ├── summary/
│   │   │   ├── service.py       # PR summary orchestration
│   │   │   └── prompts.py       # Summary prompt templates
│   │   │
│   │   ├── memory/
│   │   │   └── service.py       # memory.json read/write
│   │   │
│   │   ├── rules/
│   │   │   └── service.py       # rules.md read and injection
│   │   │
│   │   ├── providers/
│   │   │   ├── base.py          # Abstract provider interface
│   │   │   ├── openai.py        # OpenAI implementation
│   │   │   ├── anthropic.py     # Anthropic implementation
│   │   │   ├── gemini.py        # Gemini implementation
│   │   │   ├── deepseek.py      # DeepSeek implementation
│   │   │   └── generic.py       # Generic OpenAI-compatible implementation
│   │   │
│   │   ├── prompts/
│   │   │   └── builder.py       # Prompt assembly with memory + rules injection
│   │   │
│   │   ├── secrets/
│   │   │   └── patterns.py      # Secret regex patterns registry
│   │   │
│   │   ├── keychain.py          # OS keychain interface (Python side)
│   │   ├── validators.py        # Pydantic request/response models
│   │   └── provider_manager.py  # Provider selection and routing
│   │
│   ├── main.py                  # FastAPI app entrypoint
│   └── requirements.txt
│
├── tests/
│   ├── cli/
│   └── backend/
│
├── docs/
│   ├── getting-started.md
│   ├── commands.md
│   ├── providers.md
│   └── advanced.md
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── package.json                 # Root workspace
├── README.md
└── LICENSE
```

---

## 6. Secure Credential System (BYOK)

### Design Constraints

API keys **must never**:
- Appear in terminal output
- Appear in log files
- Be written to `.env`, `config.json`, or any project file
- Be committed to any repository

### OS Keychain Integration

Keys are stored using native OS secret storage, accessed via `keytar` (Node.js) and platform-native Python libraries on the backend.

| OS | Storage Mechanism | Library |
|----|------------------|---------|
| macOS | Keychain | `keytar` / `keyring` |
| Windows | Windows Credential Manager | `keytar` / `keyring` |
| Linux | Secret Service API / GNOME Keyring / KWallet | `keytar` / `secretstorage` |

**Keychain namespace:** `codejaguar/<provider-name>`

### Auth Commands

```bash
# Add a provider key (prompts securely, no echo)
jaguar auth add openai
jaguar auth add anthropic
jaguar auth add gemini
jaguar auth add deepseek
jaguar auth add <any-provider>     # Generic provider with custom base URL

# List configured providers (names only, never keys)
jaguar auth list

# Test connectivity and key validity
jaguar auth test openai

# Remove a provider key
jaguar auth remove openai
```

### `jaguar auth add` Flow

1. Prompt: `Enter your <provider> API key:` (input hidden, no echo).
2. Optional prompt for custom base URL (for OpenAI-compatible providers).
3. Store in OS keychain under `codejaguar/<provider>`.
4. Print: `✓ <provider> key stored securely in OS keychain`.
5. Key never logged or echoed.

### `jaguar auth test <provider>` Flow

1. Retrieve key from OS keychain.
2. POST to local backend `/providers/test` with provider name (key passed securely in header, never in body).
3. Backend makes minimal API call (e.g., list models or minimal completion).
4. Return: `✓ <provider> connection successful` or `✗ <provider> authentication failed`.

---

## 7. Provider Abstraction Layer

### Abstract Interface (Python)

Every provider implements:

```
class BaseProvider:
    name: str
    base_url: str

    async def complete(prompt: str, system: str, max_tokens: int) -> str
    async def test_connection() -> bool
```

### Supported Providers at Launch

| Provider | Auth Method | Base URL |
|---------|-------------|---------|
| OpenAI | `Authorization: Bearer` | `https://api.openai.com/v1` |
| Anthropic | `x-api-key` | `https://api.anthropic.com` |
| Gemini | API key in URL | `https://generativelanguage.googleapis.com` |
| DeepSeek | `Authorization: Bearer` | `https://api.deepseek.com/v1` |
| Generic (OpenAI-compatible) | `Authorization: Bearer` | User-defined |

### Extensibility

Any provider with an OpenAI-compatible API (Ollama, Together AI, Groq, Mistral, etc.) works via the generic provider with a custom base URL. Users register with:

```bash
jaguar auth add groq
# Prompts: API key + base URL
```

### Provider Selection

- Per-command flag: `--provider openai`
- Default provider: stored in `~/.jaguar/config.json` (provider name only, no key)
- Fallback: first provider found in keychain

---

## 8. CLI Command Specifications

---

### Command: `jaguar review`

**Purpose:** Analyze recent code changes for bugs, code quality, and maintainability issues.

**Context gathered by CLI before API call:**

- `git diff HEAD` (staged + unstaged changes)
- `git diff HEAD~1` (last commit)
- Changed file contents (truncated if > token limit)
- Repository language detection (file extensions)
- `memory.json` (if present)
- `rules.md` (if present)

**Flags:**

```bash
jaguar review                          # Use default provider
jaguar review --provider openai        # Specify provider
jaguar review --provider deepseek
jaguar review --consensus              # Multi-model consensus mode
jaguar review --since HEAD~3           # Review last 3 commits
jaguar review --file src/auth.ts       # Review a specific file
```

**Output Format:**

```
┌─────────────────────────────────────────────────┐
│  Code Review Results  │  3 issues found          │
└─────────────────────────────────────────────────┘

[HIGH] Performance Issue — src/users/service.ts:47
  Description: N+1 query pattern detected inside loop
  Impact: Degrades response time proportionally with dataset size
  Recommendation: Batch the query outside the loop using whereIn()

[MEDIUM] Code Smell — src/auth/middleware.ts:23
  Description: Magic number 86400 used without named constant
  Impact: Reduces readability and makes intent unclear
  Recommendation: Extract to SESSION_TTL_SECONDS = 86400

[LOW] Refactoring Opportunity — src/utils/format.ts:12
  Description: Function handles 3 unrelated concerns
  Impact: Violates Single Responsibility Principle
  Recommendation: Split into formatDate(), formatCurrency(), formatUser()
```

**Detected issue categories:**

- Bugs and logic flaws
- Performance issues (N+1, inefficient loops, memory leaks)
- Code smells (magic numbers, long functions, dead code)
- Maintainability problems (missing error handling, unclear naming)
- Refactoring opportunities (duplication, over-complexity)

---

### Command: `jaguar security`

**Purpose:** Comprehensive security scan across source code, dependencies, infrastructure files, and secrets.

**Flags:**

```bash
jaguar security                        # Full scan
jaguar security --only secrets         # Secrets only
jaguar security --only deps            # Dependencies only
jaguar security --only docker          # Docker files only
jaguar security --only actions         # GitHub Actions only
jaguar security --provider anthropic
```

**Scan Modules:**

#### 8.1 Source Code Security

Analyzed via AI with structured prompts.

Detects:
- Hardcoded secrets and credentials
- SQL injection vectors
- Command injection vectors
- Server-Side Request Forgery (SSRF)
- Cross-Site Scripting (XSS)
- Unsafe deserialization
- Weak authentication (missing rate limiting, weak password policy)
- Broken authorization (missing ownership checks, IDOR)
- Insecure file upload handling
- Path traversal vulnerabilities

#### 8.2 Dependency Security

**Files analyzed by language:**

| Language | Files |
|---------|-------|
| Node.js / Bun | `package.json`, `package-lock.json`, `bun.lock`, `yarn.lock` |
| Python | `requirements.txt`, `poetry.lock`, `pyproject.toml`, `Pipfile.lock` |
| Ruby | `Gemfile.lock` |
| Go | `go.mod`, `go.sum` |
| Rust | `Cargo.toml`, `Cargo.lock` |
| PHP | `composer.json`, `composer.lock` |
| Java / Kotlin | `pom.xml`, `build.gradle` |
| .NET | `*.csproj`, `packages.lock.json` |

Detects:
- Packages with known CVEs (via AI knowledge + pattern matching)
- Severely outdated packages (major version lag)
- Abandoned packages (no recent activity)
- Supply-chain risks (typosquatting names, suspicious maintainer changes)
- Packages with excessive permissions

#### 8.3 Dockerfile Security

**File:** `Dockerfile`, `Dockerfile.*`

Detects:
- Running as root user (missing `USER` instruction)
- Use of `latest` tag (non-deterministic builds)
- Secrets in `ENV` or `ARG` instructions
- Excessive OS package installation
- Missing `HEALTHCHECK`
- Large attack surface from unnecessary tools
- `--no-cache` not used in package installs

#### 8.4 Docker Compose Security

**File:** `docker-compose.yml`, `docker-compose.*.yml`

Detects:
- `privileged: true` containers
- Host network mode (`network_mode: host`)
- Dangerous volume mounts (mounting `/`, `/etc`, `/var/run/docker.sock`)
- Hardcoded credentials in environment variables
- Missing resource limits (`mem_limit`, `cpus`)
- Dangerous Linux capabilities (`cap_add: [SYS_ADMIN]`)

#### 8.5 GitHub Actions Security

**Files:** `.github/workflows/*.yml`

Detects:
- Unpinned actions (using `@main` or `@latest` instead of SHA)
- `pull_request_target` with checkout of untrusted code
- Secrets printed to logs via `echo`
- Excessive token permissions (`permissions: write-all`)
- Insecure use of `${{ github.event.inputs }}` without sanitization
- Third-party actions from unverified publishers

#### 8.6 Environment File Security

**Files:** `.env`, `.env.*`, `.env.example`

Detects:
- Real credentials in `.env.example` (should only contain placeholders)
- Weak or placeholder secrets shipped to production
- Production database URLs in development env files
- JWT secrets below minimum entropy threshold

#### 8.7 .gitignore Gap Analysis

**File:** `.gitignore`

Detects:
- `.env` not excluded
- `*.pem`, `*.key` not excluded
- `secrets/` not excluded
- `credentials.json` not excluded
- IDE config folders with sensitive data not excluded

#### 8.8 Secret Pattern Scanner

Regex-based scanner run **before** any AI call (fast, deterministic).

Patterns detected:

| Secret Type | Severity |
|------------|---------|
| OpenAI API keys (`sk-...`) | CRITICAL |
| Anthropic API keys (`sk-ant-...`) | CRITICAL |
| AWS Access Key ID (`AKIA...`) | CRITICAL |
| AWS Secret Access Key | CRITICAL |
| GCP service account JSON | CRITICAL |
| Azure connection strings | CRITICAL |
| Private RSA/EC keys (`-----BEGIN`) | CRITICAL |
| JWT tokens | HIGH |
| Database connection strings with credentials | HIGH |
| Stripe secret keys | CRITICAL |
| GitHub personal access tokens | HIGH |
| Slack tokens | HIGH |
| Generic high-entropy strings in assignments | MEDIUM |

Any CRITICAL finding immediately prints a warning and exits with code 1.

**Security Output Example:**

```
┌─────────────────────────────────────────────────────────┐
│  Security Scan Results  │  2 critical, 4 high, 1 medium  │
└─────────────────────────────────────────────────────────┘

[CRITICAL] Secret Detected — src/config/db.ts:14
  Type: Database password in source code
  Value: ██████████ (redacted)
  Recommendation: Move to environment variable, rotate immediately

[CRITICAL] Dockerfile — Dockerfile:8
  Issue: Container runs as root (no USER instruction)
  Recommendation: Add USER nonroot before CMD/ENTRYPOINT

[HIGH] Dependency — package.json
  Package: lodash@4.17.15 → CVE-2021-23337 (Prototype Pollution)
  Recommendation: Upgrade to lodash@4.17.21

[HIGH] GitHub Actions — .github/workflows/deploy.yml:23
  Issue: Action pinned to branch, not SHA
  Recommendation: Pin to actions/checkout@a81bbbf8298c0fa03ea29cdc473d45769f953675
```

---

### Command: `jaguar architecture`

**Purpose:** Analyze repository structure and identify architectural issues.

**Context gathered:**

- Full directory tree (depth-limited)
- Import/require graph (static analysis)
- Key config files (`tsconfig.json`, `pyproject.toml`, etc.)
- `memory.json` (if present)

**Flags:**

```bash
jaguar architecture
jaguar architecture --provider anthropic
jaguar architecture --depth 5           # Directory tree depth
```

**Detects:**
- Circular dependency chains
- Violation of defined layer boundaries
- Tight coupling between unrelated modules
- Missing abstraction layers
- Architecture drift from defined patterns
- God modules (single files with too many responsibilities)
- Incorrect dependency direction (infrastructure depending on domain)

**Output sections:**
- Findings (with file references)
- Improvements (prioritized)
- Architectural recommendations (pattern-based)
- Dependency graph anomalies

---

### Command: `jaguar summary`

**Purpose:** Generate a GitHub-ready pull request summary from recent git changes.

**Context gathered:**
- `git log --oneline` (since branching point from main/master)
- `git diff main...HEAD` (all changes)
- Changed file list

**Flags:**

```bash
jaguar summary
jaguar summary --provider openai
jaguar summary --base main              # Compare against specific branch
jaguar summary --copy                   # Copy to clipboard
```

**Output format (GitHub Markdown):**

```markdown
## Summary
Brief description of what changed and why.

## Features Added
- Feature 1 description
- Feature 2 description

## Files Changed
- `src/auth/service.ts` — Added JWT refresh token logic
- `src/users/controller.ts` — New endpoint: GET /users/:id/sessions

## Risks
- Token rotation logic needs load testing under concurrent requests
- Breaking change in session cookie name (see Breaking Changes)

## Suggested Tests
- Unit: test JWT refresh with expired tokens
- Unit: test session cleanup on logout
- Integration: test concurrent session invalidation

## Breaking Changes
- Cookie name changed from `session` to `jaguar_session` — clients must update
```

---

### Command: `jaguar auth`

Already described in Section 6. Subcommands: `add`, `list`, `test`, `remove`.

---

### Command: `jaguar protect`

**Purpose:** Install local git hooks that scan for secrets before every commit.

```bash
jaguar protect          # Install hooks in current repo
jaguar protect --remove # Uninstall hooks
jaguar protect --status # Show hook status
```

**Installs:**
- `.git/hooks/pre-commit` — runs secret scanner on staged files

**Pre-commit hook behavior:**

1. Scan all staged files against secret pattern registry.
2. If no secrets found → allow commit (exit 0).
3. If secrets found → print warning, **block commit** (exit 1).

**Blocked commit output:**

```
╔════════════════════════════════════════╗
║         COMMIT BLOCKED — Codejaguar    ║
╠════════════════════════════════════════╣
║  CRITICAL: Secret detected in staged   ║
║  files. Commit has been prevented.     ║
╚════════════════════════════════════════╝

Location:  src/config.ts:23
Type:      OpenAI API Key
Pattern:   sk-[redacted]

Action required:
  1. Remove the secret from the file
  2. Add the file to .gitignore if needed
  3. Rotate the exposed key immediately
  4. Run: git reset HEAD src/config.ts

To bypass (NOT recommended):
  git commit --no-verify
```

---

## 9. Backend API Specification

The FastAPI backend runs on `localhost` only, on a randomly chosen available port stored in `~/.jaguar/backend.port`. The CLI reads this file to know where to connect.

### Endpoints

#### `POST /review`

**Request:**
```json
{
  "diff": "string",
  "files": [{"path": "string", "content": "string"}],
  "commits": ["string"],
  "provider": "openai",
  "memory": {},
  "rules": "string"
}
```

**Response:**
```json
{
  "findings": [
    {
      "severity": "HIGH",
      "category": "Performance",
      "file": "src/users/service.ts",
      "line": 47,
      "description": "string",
      "impact": "string",
      "recommendation": "string"
    }
  ],
  "summary": "string",
  "provider_used": "openai",
  "model_used": "gpt-4o"
}
```

---

#### `POST /security`

**Request:**
```json
{
  "source_files": [{"path": "string", "content": "string"}],
  "dependency_files": [{"path": "string", "content": "string"}],
  "docker_files": [{"path": "string", "content": "string"}],
  "compose_files": [{"path": "string", "content": "string"}],
  "action_files": [{"path": "string", "content": "string"}],
  "env_files": [{"path": "string", "content": "string"}],
  "gitignore": "string",
  "provider": "anthropic",
  "scan_modules": ["all"],
  "memory": {},
  "rules": "string"
}
```

**Response:**
```json
{
  "findings": [
    {
      "severity": "CRITICAL",
      "category": "Secret",
      "module": "secret_scanner",
      "file": "src/config.ts",
      "line": 23,
      "description": "string",
      "impact": "string",
      "recommendation": "string"
    }
  ],
  "stats": {
    "critical": 2,
    "high": 4,
    "medium": 1,
    "low": 0
  },
  "provider_used": "anthropic"
}
```

---

#### `POST /architecture`

**Request:**
```json
{
  "tree": "string",
  "import_graph": {},
  "config_files": [{"path": "string", "content": "string"}],
  "provider": "openai",
  "memory": {},
  "rules": "string"
}
```

**Response:**
```json
{
  "findings": [],
  "improvements": [],
  "recommendations": "string",
  "provider_used": "openai"
}
```

---

#### `POST /summary`

**Request:**
```json
{
  "commits": ["string"],
  "diff": "string",
  "changed_files": ["string"],
  "base_branch": "main",
  "provider": "openai",
  "memory": {}
}
```

**Response:**
```json
{
  "markdown": "string",
  "provider_used": "openai"
}
```

---

#### `POST /providers/test`

**Request:**
```json
{
  "provider": "openai"
}
```
API key passed via `X-Provider-Key` header (never in body).

**Response:**
```json
{
  "success": true,
  "provider": "openai",
  "model": "gpt-4o",
  "latency_ms": 342
}
```

---

## 10. Advanced Features

---

### 10.1 Repository Memory

**File:** `.jaguar/memory.json` (stored in project root, can be committed)

**Purpose:** Make all reviews context-aware by providing AI with knowledge of the codebase's intended design.

**Structure:**
```json
{
  "framework": "FastAPI",
  "database": "PostgreSQL",
  "architecture": "Clean Architecture",
  "testing": "Pytest",
  "language": "Python 3.12",
  "patterns": ["Repository Pattern", "Dependency Injection"],
  "conventions": ["snake_case for files", "PEP 8"],
  "services": ["auth-service", "payment-service", "notification-service"],
  "notes": "All endpoints must use the auth middleware"
}
```

**Commands:**
```bash
jaguar memory init          # Interactive setup wizard
jaguar memory show          # Print current memory
jaguar memory set key value # Update a field
```

**Injection:** Every AI prompt automatically prepends memory context when `.jaguar/memory.json` exists.

---

### 10.2 Local Rules Engine

**File:** `.jaguar/rules.md` (stored in project root, can be committed)

**Purpose:** Inject project-specific engineering rules into every AI prompt.

**Example content:**
```markdown
# Project Rules

- Always use the Repository Pattern for data access
- Avoid raw SQL; use the ORM query builder
- All public API endpoints must require authentication
- Prefer dependency injection over direct instantiation
- Never return raw database errors to API consumers
- Services must not import from other services directly; use interfaces
- All async functions must handle errors with try/catch
```

**Commands:**
```bash
jaguar rules init     # Create rules.md template
jaguar rules show     # Print current rules
jaguar rules edit     # Open in $EDITOR
```

**Injection:** Rules are appended to the system prompt of every AI call.

---

### 10.3 Consensus Review

**Purpose:** Run a review across multiple providers and return only findings that multiple models agree on, reducing false positives.

**Command:**
```bash
jaguar review --consensus
jaguar security --consensus
```

**Flow:**

```
Gather Context
      │
      ├── Send to DeepSeek → Findings Set A
      ├── Send to Claude   → Findings Set B
      └── Send to GPT-4    → Findings Set C
            │
            ▼
      Compare Findings
      (semantic similarity matching)
            │
            ▼
      Return findings present in ≥ 2 of 3 responses
```

**Requirements:** At least 2 providers configured in keychain. If only 1 is available, falls back to single-provider mode with a warning.

**Output includes:** Which models agreed on each finding.

---

### 10.4 Git Protection Hooks

**Command:** `jaguar protect`

**Installed hook:** `.git/hooks/pre-commit`

**Behavior:** On every `git commit`, scans staged files against the secret pattern registry before the commit is written to history. Blocks the commit if any pattern matches.

**Pattern categories scanned:**
- All patterns from Section 8.8
- High-entropy string detection (Shannon entropy > threshold)
- Filename-based detection (`*.pem`, `credentials.json`, `id_rsa`)

---

## 11. Four-Week Delivery Plan

---

### Week 1 — Foundation

**Goal:** Working auth workflow and basic review command end-to-end.

#### CLI Tasks

- [ ] Initialize TypeScript project with Commander.js
- [ ] Implement `jaguar auth add` with secure keychain storage via `keytar`
- [ ] Implement `jaguar auth list` (names only)
- [ ] Implement `jaguar auth remove`
- [ ] Implement backend lifecycle manager (start, health check, PID file)
- [ ] Implement basic `jaguar review` command (context gathering only)

#### Backend Tasks

- [ ] Initialize FastAPI project with uvicorn
- [ ] Implement provider abstraction base class
- [ ] Implement OpenAI provider
- [ ] Implement Anthropic provider
- [ ] Implement Gemini provider
- [ ] Implement DeepSeek provider
- [ ] Implement generic OpenAI-compatible provider
- [ ] Implement `provider_manager.py` (key retrieval + routing)
- [ ] Implement `POST /providers/test` endpoint
- [ ] Implement `POST /review` endpoint (basic prompt, basic response)

#### Integration Tasks

- [ ] CLI ↔ Backend HTTP communication working
- [ ] Key passed securely via header (never logged)
- [ ] `jaguar auth test openai` returns pass/fail

**Deliverable:** `jaguar auth add openai` + `jaguar review` produces AI output in terminal.

---

### Week 2 — Core Review Engine

**Goal:** `review` and `security` commands fully functional.

#### CLI Tasks

- [ ] Git diff extraction (`simple-git`)
- [ ] Changed file content collector (with token budget)
- [ ] Terminal output renderer (severity colors, tables, boxes)
- [ ] `jaguar security` command with all scan module flags
- [ ] File collection logic for all security scan inputs

#### Backend Tasks

- [ ] `review/prompts.py` — comprehensive review prompt
- [ ] `security/secrets.py` — regex pattern scanner (runs before AI)
- [ ] `security/dependency.py` — multi-language dependency file parser
- [ ] `security/dockerfile.py` — Dockerfile rule checker
- [ ] `security/compose.py` — Docker Compose rule checker
- [ ] `security/actions.py` — GitHub Actions rule checker
- [ ] `security/env.py` — .env file analyzer
- [ ] `security/gitignore.py` — .gitignore gap analyzer
- [ ] `security/prompts.py` — security AI prompt templates
- [ ] `POST /security` endpoint wired to all modules

#### Output Tasks

- [ ] Severity-colored output (CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=blue)
- [ ] Redacted secret display (never print key values)
- [ ] Structured finding cards with file + line reference

**Deliverable:** `jaguar review` and `jaguar security` fully functional across all scan modules.

---

### Week 3 — Advanced Features and Remaining Commands

**Goal:** All four core commands complete plus memory, rules, and architecture.

#### CLI Tasks

- [ ] `jaguar memory init` wizard
- [ ] `jaguar memory show` / `set`
- [ ] `jaguar rules init` / `show` / `edit`
- [ ] `jaguar architecture` command with tree collection
- [ ] `jaguar summary` command with git log extraction
- [ ] Memory + rules loader in `context.ts`

#### Backend Tasks

- [ ] `memory/service.py` — read/write `.jaguar/memory.json`
- [ ] `rules/service.py` — read `.jaguar/rules.md`
- [ ] `prompts/builder.py` — inject memory + rules into every prompt
- [ ] `architecture/service.py` — orchestration
- [ ] `architecture/prompts.py` — architecture analysis prompts
- [ ] `summary/service.py` — orchestration
- [ ] `summary/prompts.py` — PR summary prompts
- [ ] `POST /architecture` endpoint
- [ ] `POST /summary` endpoint

**Deliverable:** All four core commands (`review`, `security`, `architecture`, `summary`) complete with memory and rules injection.

---

### Week 4 — Polish, Consensus, Protection, and Release

**Goal:** Public MVP release candidate.

#### Feature Tasks

- [ ] `jaguar review --consensus` multi-model flow
- [ ] Semantic finding deduplication / agreement matching
- [ ] `jaguar protect` — git hook installation
- [ ] Pre-commit secret scanner hook script
- [ ] `jaguar protect --remove` and `--status`

#### Quality Tasks

- [ ] Unit tests for all security scan modules
- [ ] Unit tests for secret pattern scanner
- [ ] Integration tests for all CLI ↔ backend flows
- [ ] Test on macOS (Keychain), Windows (Credential Manager), Linux (Secret Service)
- [ ] Bun compatibility verification (install + run)
- [ ] npm compatibility verification
- [ ] Token budget enforcement (prevent oversized prompts)
- [ ] Graceful error handling for missing providers, network errors, malformed git state

#### Release Tasks

- [ ] `README.md` — installation, quickstart, all commands documented
- [ ] `docs/getting-started.md`
- [ ] `docs/commands.md` — full command reference
- [ ] `docs/providers.md` — adding providers guide
- [ ] `docs/advanced.md` — memory, rules, consensus, protect
- [ ] `package.json` — bin entry, publishConfig
- [ ] npm publish dry run (`npm pack`)
- [ ] Verify `npx codejaguar-review` works from clean environment
- [ ] GitHub release with changelog

**Deliverable:** Public MVP release candidate published to npm.

---

## 12. Testing Strategy

### Unit Tests

| Module | What to Test |
|--------|-------------|
| `secrets/patterns.py` | Every regex pattern matches expected samples; no false positives on clean samples |
| `security/dependency.py` | Parses all supported lock file formats correctly |
| `security/dockerfile.py` | Detects each rule violation; passes clean Dockerfile |
| `security/actions.py` | Detects unpinned actions, dangerous triggers |
| `providers/*.py` | Correct request format per provider; handles auth errors |
| `prompts/builder.py` | Memory + rules injected correctly; handles missing files |
| `keychain.ts` | Store/retrieve/delete across mock keychain |

### Integration Tests

| Flow | What to Verify |
|------|---------------|
| `jaguar auth add` → `jaguar auth test` | Key stored and validated end-to-end |
| `jaguar review` on a repo with known issues | Findings produced with correct severity |
| `jaguar security` on a repo with planted secrets | CRITICAL findings returned; secret value redacted |
| `jaguar summary` on a branch with commits | Valid GitHub-ready markdown output |
| `jaguar protect` + dirty commit attempt | Commit blocked; clean commit passes |
| Consensus mode with 2 providers | Only shared findings returned |

### Platform Tests

- macOS: Keychain read/write
- Windows: Credential Manager read/write
- Linux: GNOME Keyring / Secret Service API

### Manual Smoke Test Checklist (before each release)

- [ ] Fresh install via npm on macOS
- [ ] Fresh install via bun on Linux
- [ ] `jaguar auth add openai` → key stored, not echoed
- [ ] `jaguar review` → output rendered
- [ ] `jaguar security` → secret detected on planted sample
- [ ] `jaguar protect` → commit blocked
- [ ] Consensus mode with 2 providers

---

## 13. Documentation & Publishing

### README.md Sections

1. What is Codejaguar
2. Installation (npm + bun)
3. Quick Start (3 commands to first review)
4. Available commands (table)
5. Provider setup guide
6. Repository memory
7. Project rules
8. Consensus mode
9. Git protection
10. FAQ
11. License

### npm Publishing

```json
// package.json (cli/)
{
  "name": "codejaguar-review",
  "version": "1.0.0",
  "bin": {
    "jaguar": "./dist/index.js"
  },
  "files": ["dist/", "backend/"],
  "publishConfig": {
    "access": "public"
  }
}
```

The published package includes both the compiled CLI (`dist/`) and the Python backend (`backend/`). On first run, the CLI checks for Python ≥ 3.10 and installs backend dependencies via `pip install -r requirements.txt` into an isolated venv at `~/.jaguar/venv`.

### Version Strategy

- `1.0.0` — MVP release (all 9 success criteria met)
- Semantic versioning: MAJOR.MINOR.PATCH
- Changelog maintained in `CHANGELOG.md`

---

## 14. Success Criteria

The MVP is complete when a user can perform all of the following on a clean machine with only `npm` or `bun` installed:

| # | Criterion | Verified By |
|---|-----------|------------|
| 1 | Install via `npm install -g codejaguar-review` or `bun install -g codejaguar-review` | Clean machine install test |
| 2 | Store API keys securely in OS Keychain via `jaguar auth add <provider>` | Key stored; never appears in logs or terminal |
| 3 | Run `jaguar review` and receive structured code review findings | Review output rendered in terminal |
| 4 | Run `jaguar security` and detect issues across source code, dependencies, Dockerfiles, Docker Compose, GitHub Actions, and secrets | All scan modules produce output on fixture repos |
| 5 | Run `jaguar summary` and produce GitHub-ready PR markdown | Markdown output matches required sections |
| 6 | Use `.jaguar/memory.json` to make reviews context-aware | Memory fields appear in AI prompts |
| 7 | Use `.jaguar/rules.md` to inject project-specific rules | Rules appear in AI prompts; violations flagged |
| 8 | Run `jaguar review --consensus` and receive only multi-model agreed findings | Consensus output differs from single-model output |
| 9 | Run `jaguar protect` and have a commit containing a secret automatically blocked | Pre-commit hook blocks; clean commit succeeds |

**Infrastructure requirements at MVP:** None. No cloud. No database. No deployment.

---

*Codejaguar MVP Implementation Plan — v1.0*
*Local-first · BYOK · Open Source*