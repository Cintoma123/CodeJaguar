# Command Reference

Every CodeJaguar command and flag. Commands that produce a report write it to a
Markdown file in the project root rather than printing to the terminal.

> **Note on naming:** credentials are managed with `jaguar key` (the binary is
> `jaguar`, published as the npm package `codejaguar-cli`).

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

**Output:** findings are printed to the terminal. Pass `--output md` to also
write `review.md` (or `review-consensus.md` with `--consensus`), or
`--output json` to write `review.json` (`review-consensus.json` with consensus).

| Flag | Description |
|------|-------------|
| `--provider <name>` | AI provider to use. Defaults to your configured/default provider. |
| `--model <name>` | Specific model (e.g. `gpt-4o`, `[REDACTED]`). |
| `--file <path>` | Review a single file instead of the git diff. |
| `--consensus` | Run across all configured providers, keep agreed findings. |
| `--watch` | Watch the project and review each file as you save it (streams to the terminal). |
| `--fix` | After the review, propose a code fix per finding and apply it interactively. |
| `--output <format>` | Also save the report to a file: `md` or `json`. Defaults to terminal-only. |
| `--ci` | CI mode: diff PR, emit GitHub Actions annotations, write jaguar-results.json. |
| `--fail-on <severity>` | Exit code 1 when findings meet or exceed severity: `critical`, `high`, `medium`, or `none`. Default: `high`. |

```bash
jaguar review
jaguar review --file src/auth.ts
jaguar review --consensus
jaguar review --watch
jaguar review --fix
jaguar review --output md      # terminal display + review.md
jaguar review --output json    # terminal display + review.json
```

Findings are coloured by severity: red for `CRITICAL`/`HIGH`, yellow for
`MEDIUM`, blue for `LOW`; recommendations are green, and file/line references
are grey. An existing `review.md` is never deleted automatically — the file is
only touched when `--output` is given.

Context gathered: `git diff HEAD`, changed-file contents (size-limited), recent
commit messages, plus `.jaguar/memory.json` and `.jaguar/rules.md` if present.

### Watch mode (`--watch`)

Runs continuously and reviews a file the moment you save it, streaming findings
to the terminal (no `review.md` is written). Press `Ctrl+C` to stop — a summary
of the session's findings is printed on exit.

- Reviews a **single-file diff** per change (not the whole tree), so results are
  fast and focused. Rapid consecutive saves are debounced into one review.
- Always ignores `node_modules/`, `dist/`, `.git/`, `.jaguar/`, binary files,
  and files larger than 500 KB.

Configure watch behaviour in the `watch` block of `.jaguar/memory.json`:

```json
{
  "watch": {
    "ignore": ["dist/", "*.test.ts"],
    "debounce_ms": 800,
    "severity_threshold": "medium"
  }
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `ignore` | `[]` | Extra glob patterns to skip (relative to project root). Supports `*`, `**`, and trailing `/` for a directory. |
| `debounce_ms` | `800` | Wait this long after the last save before reviewing. |
| `severity_threshold` | `low` | Suppress findings below this level while watching. E.g. `medium` hides `LOW` findings to reduce noise. Values: `low`, `medium`, `high`, `critical`. |

### Fix mode (`--fix`)

Runs a normal review (printed to the terminal), then walks you through each finding
that has a proposed fix, showing a coloured diff and prompting before it touches
any file:

```
Apply this fix? (y)es · (n)o · (s)kip all · (q)uit
```

- **Backup first.** Before a file is modified it is copied to
  `~/.jaguar/backups/<timestamp>/<original/path>`. The backup location and an
  undo hint are printed when the session ends.
- **Exact-match only.** A fix is applied only if the reviewer's `original_code`
  is found character-for-character (line endings normalised) in the file. If it
  can't be located unambiguously, the fix is **skipped**, never guessed.
- **Staleness guard.** If a file was modified after the review started, its fix
  is skipped — line numbers may have shifted. Re-run `jaguar review --fix`.
- **Line endings preserved.** A CRLF file stays CRLF after a fix; an LF file
  stays LF.
- **The report reflects the fix session.** After the session, the report is
  re-printed with each finding tagged `✓ Fixed`, `— Skipped`, or `✗ Failed`.
  With `--output md`/`--output json`, the saved file is re-written so it stays an
  accurate record of what was found *and* what was done — the report never goes
  stale against the code you just changed.

`--fix` cannot be combined with `--consensus` (fixes come from one provider's
exact original code, which consensus dedup discards).

To reverse an applied session, see [`jaguar fix`](#jaguar-fix) below.

### CI / GitHub Actions (`--ci`)

Run `jaguar review --ci` inside a GitHub Actions workflow to diff the PR
(base branch vs HEAD), emit inline annotations, write `jaguar-results.json`, and
control the job's exit code based on findings.

| Flag | Description |
|------|-------------|
| `--ci` | CI mode: diff PR, emit annotations, write jaguar-results.json. |
| `--fail-on <severity>` | Exit code 1 when findings meet or exceed severity. Values: `critical`, `high` (default), `medium`, `none`. |

**Environment variables:**

- `JAGUAR_API_KEY` — Provider API key (required; the OS keychain isn't available in CI).
- `GITHUB_BASE_REF` — PR target branch (auto-set by GitHub Actions).
- `GITHUB_HEAD_REF` — PR source branch (auto-set by GitHub Actions).
- `JAGUAR_BASE_URL` — Base URL for generic providers (optional; built-in providers don't need it).

**What it does:**

1. Diffs `${GITHUB_BASE_REF}...HEAD` (falls back to `main...HEAD`).
2. Reviews the changed files.
3. Emits GitHub Actions workflow commands to stdout:
   - `::error` for `CRITICAL` and `HIGH` findings
   - `::warning` for `MEDIUM`
   - `::notice` for `LOW`
4. Writes `jaguar-results.json` (machine-readable findings + metadata).
5. Exits with code `1` if any finding meets or exceeds `--fail-on` threshold, `0` otherwise.

The annotations appear inline on the PR diff in the Files Changed tab.

**Example workflow:**

```yaml
name: Code Review
on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for git diff

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install CodeJaguar
        run: npm install -g codejaguar-cli

      - name: Run review
        run: jaguar review --ci --provider openai --fail-on high
        env:
          JAGUAR_API_KEY: ${{ secrets.JAGUAR_API_KEY }}
```

`--ci` is mutually exclusive with `--watch`, `--fix`, and `--consensus`.

---

## `jaguar fix`

Restore files changed by a `jaguar review --fix` session from their backup.

| Flag | Description |
|------|-------------|
| `--undo <timestamp>` | Restore every file backed up under this timestamp to its original contents. |

```bash
jaguar fix --undo 2026-07-31T14-30-00-123Z
```

The `<timestamp>` is the one printed at the end of a `--fix` session (the folder
name under `~/.jaguar/backups/`). Every file in that backup is written back to
its original project-relative location.

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
| `--ci` | CI mode: emit GitHub Actions annotations, write jaguar-results.json. |
| `--fail-on <severity>` | Exit code 1 when findings meet or exceed severity: `critical`, `high` (default), `medium`, or `none`. |

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

### CI / GitHub Actions (`--ci`)

Run `jaguar security --ci` inside a GitHub Actions workflow to scan the project,
emit inline annotations, write `jaguar-results.json`, and control the job's exit
code based on findings.

**Environment variables:**

- `JAGUAR_API_KEY` — Provider API key (required in CI).
- `JAGUAR_BASE_URL` — Base URL for generic providers (optional).

**What it does:**

1. Scans all source files, dependencies, Docker files, GitHub Actions, and environment files.
2. Emits GitHub Actions workflow commands to stdout (same format as review: `::error` for CRITICAL/HIGH, `::warning` for MEDIUM, `::notice` for LOW).
3. Writes `jaguar-results.json` with all findings and metadata.
4. Exits with code `1` if any finding meets or exceeds `--fail-on` threshold, `0` otherwise.

**Example workflow:**

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install CodeJaguar
        run: npm install -g codejaguar-cli

      - name: Run security scan
        run: jaguar security --ci --provider openai --fail-on critical
        env:
          JAGUAR_API_KEY: ${{ secrets.JAGUAR_API_KEY }}
```

Both `jaguar review --ci` and `jaguar security --ci` write `jaguar-results.json`.
If you run both in the same job, parse and upload each result before the next
overwrites it, or rename the output between steps.

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
