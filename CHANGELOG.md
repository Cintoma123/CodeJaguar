# Changelog

All notable changes to CodeJaguar are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] — Watch Mode, Auto-Fix & CI Integration

The v2 release turns CodeJaguar from a one-shot reviewer into a live coding
companion and a team CI gate. Three headline features land together, all built
on the existing local-first, BYOK backend — no new cloud, no new accounts.

### Added

**Watch mode — `jaguar review --watch`**
- Monitors the project and reviews each file the moment it is saved, streaming
  findings to the terminal in append mode (no screen clear, full scroll-back).
- Per-file debounce (default 800ms) collapses rapid saves into a single review;
  reviews are serialized so concurrent saves never interleave their output.
- Reviews a single-file diff per change (not the whole tree), so each result is
  fast and scoped to what you just touched.
- Ignores `node_modules/`, `dist/`, `.git/`, `.jaguar/`, binaries, and files
  over 500KB; honours user `ignore` globs from `.jaguar/memory.json`.
- Configurable via a `watch` block in `.jaguar/memory.json` (`ignore`,
  `debounce_ms`, `severity_threshold`) — `severity_threshold: "medium"`
  suppresses LOW findings to reduce noise while coding.
- Ctrl+C prints a session summary (files reviewed, findings by severity).

**Fix suggestions — `jaguar review --fix`**
- After a review, proposes concrete corrected code per finding and walks the
  user through each one interactively (y / n / s / q) with a red/green diff.
- Safety first: backs up every original to `~/.jaguar/backups/{timestamp}/`,
  refuses to apply if the file changed since the review started (mtime check),
  and skips rather than guessing when the original code can't be located
  exactly or is ambiguous. CRLF/LF line endings are preserved on write.
- `jaguar fix --undo <timestamp>` restores every file from a backup.
- Backend: `POST /review` accepts `fix_mode: true` and returns a per-finding
  `fix` object (`original_code`, `fixed_code`, `explanation`); ordinary reviews
  are unaffected.

**GitHub Actions CI integration — `jaguar review --ci` / `jaguar security --ci`**
- Detects the CI environment, diffs the PR base vs HEAD (via `GITHUB_BASE_REF`),
  and emits GitHub Actions annotations (`::error`/`::warning`/`::notice`) so
  findings render inline on the PR diff.
- Writes a machine-readable `jaguar-results.json` for downstream steps.
- `--fail-on <critical|high|medium|none>` controls the exit code (default
  `high`), letting critical findings block a merge.
- Reads the provider key from the `JAGUAR_API_KEY` env var in CI — never the
  keychain, never disk.

### Changed

- `jaguar review` now prints findings to the terminal by default instead of
  writing `review.md`. Findings are severity-coloured (red `CRITICAL`/`HIGH`,
  yellow `MEDIUM`, blue `LOW`) with green recommendations and grey file/line
  references. File output is opt-in: `--output md` writes `review.md`, and
  `--output json` writes `review.json`. `--consensus` mirrors this with
  `review-consensus.md` / `review-consensus.json`.
- Added `chokidar` as a CLI dependency for cross-platform file watching.

[2.0.0]: https://github.com/Cintoma123/CodeJaguar/releases/tag/v2.0.0

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
