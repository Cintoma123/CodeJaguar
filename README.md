# 🐆 CodeJaguar

> **Local-first AI Code Review & DevSecOps CLI**
> Local-first · BYOK · No SaaS · No Cloud · No Database · No Telemetry

CodeJaguar is a production-grade AI code reviewer and security auditor that runs
entirely on your machine. Bring your own API key for any AI provider — there is
no hosted backend, no account, and no telemetry. It acts as a personal senior
engineer and security auditor embedded directly in your git workflow.

---

## Table of Contents

1. [What is CodeJaguar](#what-is-codejaguar)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands](#commands)
5. [Provider Setup](#provider-setup)
6. [Repository Memory](#repository-memory)
7. [Project Rules](#project-rules)
8. [Consensus Mode](#consensus-mode)
9. [Git Protection](#git-protection)
10. [How It Works](#how-it-works)
11. [FAQ](#faq)
12. [License](#license)

---

## What is CodeJaguar

CodeJaguar reviews your code, scans for security issues, analyzes your
architecture, and writes pull-request summaries — all powered by the AI provider
of your choice (OpenAI, Anthropic, Gemini, DeepSeek, or any OpenAI-compatible
endpoint). Your code never leaves your machine except to go directly to the AI
provider you configured.

| Principle | What it means |
|-----------|---------------|
| **Local-first** | All processing happens on your machine |
| **BYOK** | You supply your own provider API keys |
| **No SaaS** | No hosted backend; only calls go to *your* AI provider |
| **No database** | File-based state only (`memory.json`, `rules.md`) |
| **No accounts** | No login, no billing, no telemetry |

---

## Installation

```bash
npm install -g codejaguar-cli
# or
bun install -g codejaguar-cli
```

This installs the `jaguar` command globally.

**Requirements:**
- Node.js ≥ 18 (or Bun ≥ 1.0)
- Python ≥ 3.10 — the local backend runs on FastAPI. On first run, CodeJaguar
  starts the backend automatically on `127.0.0.1` (loopback only).
- `git` available on your `PATH`

> See [`docs/getting-started.md`](docs/getting-started.md) for a step-by-step setup walkthrough.

---

## Quick Start

Three commands to your first review:

```bash
# 1. Store a provider key (input is hidden, never echoed or logged)
jaguar key add openai

# 2. Make some code changes, then review them
jaguar review

# 3. Open the generated report
cat review.md
```

That's it. Reviews, security scans, architecture analysis, and PR summaries are
written to Markdown files in your project root — not dumped to the terminal — so
you can read, commit, or share them.

---

## Commands

| Command | Description | Output file |
|---------|-------------|-------------|
| `jaguar key` | Manage provider API keys (BYOK) | — |
| `jaguar review` | Review code changes for bugs, smells, performance | `review.md` |
| `jaguar security` | Scan source, deps, Docker, Actions, secrets | `security-*.md` |
| `jaguar architecture` | Analyze repository structure | `architecture.md` |
| `jaguar summary` | Generate a GitHub-ready PR summary | `pr-summary.md` |
| `jaguar memory` | Manage repository memory | `.jaguar/memory.json` |
| `jaguar rules` | Manage project rules | `.jaguar/rules.md` |
| `jaguar protect` | Install a pre-commit secret-scanning hook | — |

A full reference with every flag lives in [`docs/commands.md`](docs/commands.md).

### Common examples

```bash
jaguar review --provider anthropic            # Use a specific provider
jaguar review --model gpt-4o                  # Pick a model
jaguar review --file src/auth.ts              # Review a single file
jaguar review --consensus                     # Agree across multiple providers

jaguar security                               # Full security scan
jaguar security --only secrets                # Secrets only
jaguar security --only deps --provider openai # Dependencies only

jaguar architecture --depth 5                 # Deeper directory analysis
jaguar summary --base develop --copy          # PR summary vs develop + clipboard
```

---

## Provider Setup

CodeJaguar works with any AI provider. Built-in providers need only a key;
OpenAI-compatible providers also take a base URL.

```bash
jaguar key add openai        # built-in
jaguar key add anthropic     # built-in
jaguar key add gemini        # built-in
jaguar key add deepseek      # built-in
jaguar key add groq          # generic — prompts for a base URL

jaguar key list              # show configured providers (names only)
jaguar key test openai       # verify the key works
jaguar key remove openai     # delete a key
```

Keys are stored in your OS keychain (macOS Keychain, Windows Credential Manager,
Linux Secret Service) — never in a file, never in terminal output, never logged.

See [`docs/providers.md`](docs/providers.md) for the full provider guide,
including Ollama, Together AI, Groq, Mistral, and other OpenAI-compatible
endpoints.

---

## Repository Memory

Make every review context-aware by describing your codebase once in
`.jaguar/memory.json`. CodeJaguar injects it into every AI prompt.

```bash
jaguar memory init                       # create a template
jaguar memory set framework FastAPI      # set a field
jaguar memory set patterns "Repository Pattern,Dependency Injection"
jaguar memory show
```

Details in [`docs/advanced.md`](docs/advanced.md#repository-memory).

---

## Project Rules

Enforce project-specific engineering rules by listing them in `.jaguar/rules.md`.
They are appended to the system prompt of every AI call.

```bash
jaguar rules init    # create a template
jaguar rules edit    # open in $EDITOR
jaguar rules show
```

Details in [`docs/advanced.md`](docs/advanced.md#project-rules).

---

## Consensus Mode

Reduce false positives by running a review across multiple configured providers
and keeping only the findings they agree on.

```bash
jaguar review --consensus
```

Requires at least two providers configured. With only one, it falls back to a
single-provider review and warns you. Output is written to
`review-consensus.md`. Details in
[`docs/advanced.md`](docs/advanced.md#consensus-mode).

---

## Git Protection

Install a pre-commit hook that scans staged files for secrets and blocks commits
that would leak credentials.

```bash
jaguar protect            # install the hook
jaguar protect --status   # check whether it's installed
jaguar protect --remove   # uninstall
```

The scan is local, fast, and AI-free. Bypass in an emergency with
`git commit --no-verify`. Details in
[`docs/advanced.md`](docs/advanced.md#git-protection).

---

## How It Works

```
User Terminal
     │
     ▼
TypeScript CLI (Commander.js)  ── gathers git context, reads key from keychain
     │  HTTP POST to 127.0.0.1
     ▼
FastAPI Backend (localhost only)  ── injects memory + rules, enforces token budget
     │
     ▼
Provider Abstraction Layer  ──►  OpenAI · Anthropic · Gemini · DeepSeek · Generic
```

1. You run a command.
2. The CLI gathers context (git diff, file tree, lock files, etc.).
3. The CLI reads your API key from the OS keychain.
4. The CLI sends a structured request to the local FastAPI backend.
5. The backend injects memory + rules, enforces the token budget, and calls your
   AI provider.
6. The response is parsed and written to a Markdown report.

The backend binds only to `127.0.0.1` and is started automatically on first use.

---

## FAQ

**Does my code get sent anywhere?**
Only to the AI provider whose key you configured, and only the relevant context
(diffs, changed files). There is no CodeJaguar server.

**Where are my API keys stored?**
In your operating system's native keychain — never in a project file, log, or
terminal output.

**Which providers are supported?**
OpenAI, Anthropic, Gemini, and DeepSeek out of the box, plus any
OpenAI-compatible endpoint (Ollama, Groq, Together AI, Mistral, LM Studio, vLLM,
etc.) via a custom base URL.

**Why is there a Python backend?**
The provider abstraction, security scanners, and prompt assembly run in Python.
It runs locally on loopback only and is started automatically.

**How are oversized prompts handled?**
The backend enforces a per-provider token budget and safely truncates input that
would exceed the model's context window.

---

## License

MIT
