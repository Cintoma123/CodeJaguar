# Changelog

All notable changes to CodeJaguar are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — MVP Release

First public MVP. A local-first, BYOK AI code review and DevSecOps CLI that runs
entirely on your machine with no cloud, no database, no accounts, and no
telemetry.

### Added

**Core commands**
- `jaguar review` — AI code review of git changes; writes `review.md`. Supports
  `--provider`, `--model`, `--file`, and `--consensus`.
- `jaguar security` — eight-module security scan (secrets, dependencies,
  Dockerfile, Docker Compose, GitHub Actions, `.env`, `.gitignore`, and
  AI source analysis); writes `security-*.md`. Supports `--only`.
- `jaguar architecture` — repository structure analysis; writes
  `architecture.md`. Supports `--depth`.
- `jaguar summary` — GitHub-ready PR summary; writes `pr-summary.md`. Supports
  `--base` and `--copy`.

**Credentials (BYOK)**
- `jaguar key add/list/test/remove` — provider keys stored in the OS keychain;
  never logged, echoed, or written to files. Keys pass to the backend via the
  `X-Provider-Key` header only.

**Providers**
- Built-in: OpenAI, Anthropic, Gemini, DeepSeek.
- Generic OpenAI-compatible support (Groq, Together AI, Mistral, OpenRouter,
  Ollama, LM Studio, vLLM, …) via a custom base URL.

**Context & rules**
- Repository memory (`.jaguar/memory.json`) via `jaguar memory init/show/set`.
- Project rules (`.jaguar/rules.md`) via `jaguar rules init/show/edit`.
- Both are injected into every AI prompt automatically.

**Consensus & protection**
- `jaguar review --consensus` — multi-provider agreement to cut false positives;
  writes `review-consensus.md`.
- `jaguar protect` — pre-commit hook that blocks commits containing secrets;
  supports `--status` and `--remove`.

**Reliability**
- Per-provider token-budget enforcement to prevent oversized prompts; large
  inputs are truncated safely instead of failing.
- Graceful error handling for missing providers, bad keys, network errors,
  timeouts, and malformed git state (not a repo, no commits, empty diff).

**First-run experience**
- Animated splash screen on a bare `jaguar` / `jaguar --help` invocation in an
  interactive terminal.

**Documentation**
- `README.md`, plus `docs/getting-started.md`, `docs/commands.md`,
  `docs/providers.md`, and `docs/advanced.md`.

### Architecture
- TypeScript CLI (Commander.js) ↔ local FastAPI backend on `127.0.0.1`.
- Backend started automatically on first use; binds to loopback only.
- File-based state only — no database.

[1.0.0]: https://github.com/Cintoma123/CodeJaguar/releases/tag/v1.0.0
