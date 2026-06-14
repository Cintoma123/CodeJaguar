# Command Reference

Every CodeJaguar command and flag. Commands that produce a report write it to a
Markdown file in the project root rather than printing to the terminal.

> **Note on naming:** credentials are managed with `jaguar key` (the binary is
> `jaguar`, published as the npm package `codejaguar-review`).

---

## `jaguar key`

Manage provider API keys (BYOK). Keys are stored in the OS keychain and never
written to files, logs, or terminal output.

| Subcommand | Description |
|------------|-------------|
| `jaguar key add [provider]` | Store an API key (hidden prompt). Generic providers also prompt for a base URL. |
| `jaguar key list` | List configured providers (names only). |
| `jaguar key test <provider>` | Verify the key by making a minimal API call. |
| `jaguar key remove <provider>` | Delete a stored key and its metadata. |

```bash
jaguar key add openai
jaguar key add groq          # generic — prompts for base URL
jaguar key list
jaguar key test anthropic
jaguar key remove deepseek
```

Built-in providers: `openai`, `anthropic`, `gemini`, `deepseek`. Any other name
is treated as a generic OpenAI-compatible provider. See [providers.md](providers.md).

---

## `jaguar review`

Analyze recent code changes for bugs, code smells, performance issues,
maintainability problems, and refactoring opportunities.

**Output:** `review.md` (or `review-consensus.md` with `--consensus`).

| Flag | Description |
|------|-------------|
| `--provider <name>` | AI provider to use. Defaults to your configured/default provider. |
| `--model <name>` | Specific model (e.g. `gpt-4o`, `claude-sonnet-4-20250514`). |
| `--file <path>` | Review a single file instead of the git diff. |
| `--consensus` | Run across all configured providers, keep agreed findings. |

```bash
jaguar review
jaguar review --provider openai --model gpt-4o
jaguar review --file src/auth.ts
jaguar review --consensus
```

Context gathered: `git diff HEAD`, changed-file contents (size-limited), recent
commit messages, plus `.jaguar/memory.json` and `.jaguar/rules.md` if present.

---

## `jaguar security`

Comprehensive security scan across source code, dependencies, Docker,
Docker Compose, GitHub Actions, environment files, `.gitignore`, and secrets.

**Output:** `security-full-scan.md`, or `security-<module>.md` with `--only`.

| Flag | Description |
|------|-------------|
| `--provider <name>` | AI provider to use. |
| `--model <name>` | Specific model. |
| `--only <module>` | Run a single module: `secrets`, `deps`, `docker`, `actions`. |

```bash
jaguar security
jaguar security --only secrets
jaguar security --only deps --provider openai --model gpt-4o
jaguar security --only docker --provider anthropic
```

Modules: secret pattern scanner (deterministic, runs first), dependency CVE
analysis, Dockerfile checks, Docker Compose checks, GitHub Actions checks, `.env`
analysis, `.gitignore` gap analysis, and AI-powered contextual source review.
A CRITICAL secret short-circuits the scan and is reported immediately.

---

## `jaguar architecture`

Analyze repository structure for architectural issues — coupling, layering
violations, god modules, and drift.

**Output:** `architecture.md`.

| Flag | Description |
|------|-------------|
| `--provider <name>` | AI provider to use. |
| `--model <name>` | Specific model. |
| `--depth <n>` | Directory-tree depth (default `3`). |

```bash
jaguar architecture
jaguar architecture --provider anthropic
jaguar architecture --depth 5
```

Context gathered: directory tree, key config files (`tsconfig.json`,
`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.), plus memory and
rules.

---

## `jaguar summary`

Generate a GitHub-ready pull request summary from your branch's changes.

**Output:** `pr-summary.md`.

| Flag | Description |
|------|-------------|
| `--provider <name>` | AI provider to use. |
| `--model <name>` | Specific model. |
| `--base <branch>` | Base branch to compare against (default `main`). |
| `--copy` | Also copy the Markdown to the clipboard. |

```bash
jaguar summary
jaguar summary --base develop
jaguar summary --provider openai --copy
```

The summary always contains these sections: Summary, Features Added, Files
Changed, Risks, Suggested Tests, Breaking Changes.

---

## `jaguar memory`

Manage repository memory (`.jaguar/memory.json`) — see
[advanced.md](advanced.md#repository-memory).

| Subcommand | Description |
|------------|-------------|
| `jaguar memory init` | Create `memory.json` from a template. |
| `jaguar memory show` | Print current memory. |
| `jaguar memory set <key> <value>` | Set a field (comma-separated for list fields). |

List fields: `patterns`, `conventions`, `services`.

```bash
jaguar memory init
jaguar memory set framework FastAPI
jaguar memory set patterns "Repository Pattern,Dependency Injection"
jaguar memory show
```

---

## `jaguar rules`

Manage project rules (`.jaguar/rules.md`) — see
[advanced.md](advanced.md#project-rules).

| Subcommand | Description |
|------------|-------------|
| `jaguar rules init` | Create `rules.md` from a template. |
| `jaguar rules show` | Print current rules. |
| `jaguar rules edit` | Open `rules.md` in `$EDITOR` (creates it if missing). |

```bash
jaguar rules init
jaguar rules edit
jaguar rules show
```

---

## `jaguar protect`

Install a pre-commit git hook that scans staged files for secrets and blocks
commits that would leak them — see [advanced.md](advanced.md#git-protection).

| Flag | Description |
|------|-------------|
| *(none)* | Install the pre-commit hook. |
| `--status` | Show whether the hook is installed. |
| `--remove` | Uninstall the hook. |

```bash
jaguar protect
jaguar protect --status
jaguar protect --remove
```

CRITICAL/HIGH secret matches block the commit; MEDIUM matches warn but allow it.
Bypass with `git commit --no-verify`.

---

## Global

| Flag | Description |
|------|-------------|
| `--help`, `-h` | Show help for any command. |
| `--version`, `-V` | Print the CLI version. |

```bash
jaguar --help
jaguar review --help
jaguar --version
```
