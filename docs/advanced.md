# Advanced Features

Repository memory, project rules, consensus reviews, and git protection — the
features that make CodeJaguar context-aware and safe by default.

---

## Repository Memory

**File:** `.jaguar/memory.json` (lives in your project root; safe to commit)

Repository memory describes your codebase's intended design once, so **every**
review, security scan, and architecture analysis is context-aware. The backend
injects it into every AI prompt.

### Structure

```json
{
  "framework": "FastAPI",
  "database": "PostgreSQL",
  "architecture": "Clean Architecture",
  "testing": "Pytest",
  "language": "Python 3.12",
  "patterns": ["Repository Pattern", "Dependency Injection"],
  "conventions": ["snake_case for files", "PEP 8"],
  "services": ["auth-service", "payment-service"],
  "notes": "All endpoints must use the auth middleware"
}
```

### Commands

```bash
jaguar memory init                  # create the template
jaguar memory show                  # print current memory
jaguar memory set framework FastAPI # set a single field
```

List fields (`patterns`, `conventions`, `services`) take a comma-separated value:

```bash
jaguar memory set patterns "Repository Pattern,Dependency Injection"
jaguar memory set services "auth-service,billing-service"
```

Memory is loaded automatically when present — no flag required. Missing or
malformed `memory.json` is ignored gracefully.

---

## Project Rules

**File:** `.jaguar/rules.md` (lives in your project root; safe to commit)

Project rules are engineering conventions appended to the **system prompt** of
every AI call, so the model enforces your standards and flags violations.

### Example

```markdown
# Project Rules

- Always use the Repository Pattern for data access
- Avoid raw SQL; use the ORM query builder
- All public API endpoints must require authentication
- Prefer dependency injection over direct instantiation
- Never return raw database errors to API consumers
- All async functions must handle errors with try/catch
```

### Commands

```bash
jaguar rules init    # create the template
jaguar rules show    # print current rules
jaguar rules edit    # open in $EDITOR (creates the file if missing)
```

`jaguar rules edit` uses `$EDITOR`/`$VISUAL`, falling back to `notepad` on
Windows and `vi` elsewhere.

---

## Consensus Mode

**Command:** `jaguar review --consensus`
**Output:** `review-consensus.md`

Consensus mode reduces false positives by running the same review across all
configured providers and keeping only findings that **at least two** of them
agree on.

### Flow

```
Gather context
      │
      ├── Provider A → findings set A
      ├── Provider B → findings set B
      └── Provider C → findings set C
            │
            ▼
   Match findings across sets (by file + semantic similarity)
            │
            ▼
   Keep findings present in ≥ 2 providers
```

### Requirements & behavior

- Needs **at least 2** configured providers. With only one, it falls back to a
  standard single-provider review and warns you.
- A provider that errors mid-run is skipped; consensus continues with the rest,
  as long as at least two return results.
- The report records which providers participated and the agreement threshold.

```bash
jaguar key add openai
jaguar key add anthropic
jaguar review --consensus
cat review-consensus.md
```

---

## Git Protection

**Command:** `jaguar protect`
**Installs:** `.git/hooks/pre-commit`

Installs a local pre-commit hook that scans **staged** files for secrets before a
commit is written to history. The scan is deterministic, local, and AI-free, so
commits stay fast.

### Commands

```bash
jaguar protect            # install the hook
jaguar protect --status   # show whether it's installed
jaguar protect --remove   # uninstall the hook
```

### Behavior on commit

| Match severity | Result |
|----------------|--------|
| CRITICAL / HIGH | Commit **blocked** (exit 1), with file/line and remediation steps |
| MEDIUM | Commit allowed, with a warning |
| None | Commit proceeds normally |

CodeJaguar refuses to overwrite a pre-existing pre-commit hook it didn't create,
and `--remove` won't touch a hook it didn't author.

### Blocked-commit example

```
╔════════════════════════════════════════╗
║        COMMIT BLOCKED — CodeJaguar     ║
╠════════════════════════════════════════╣
║  Secret(s) detected in staged files.   ║
║  The commit has been prevented.        ║
╚════════════════════════════════════════╝

  [CRITICAL] OpenAI API Key  src/config.ts:23
    sk-…redacted…

Action required:
  1. Remove the secret from the file
  2. Add the file to .gitignore if needed
  3. Rotate the exposed key immediately

To bypass (NOT recommended): git commit --no-verify
```

Detected secret types include OpenAI/Anthropic keys, AWS access keys, GCP service
account JSON, private keys, JWTs, database connection strings, Stripe keys,
GitHub tokens, Slack tokens, and high-entropy assignments.

---

## Reliability notes

- **Token budgets** — each provider has an input-token budget below its context
  window; oversized prompts are truncated safely instead of erroring.
- **Graceful failures** — missing providers, bad keys, network errors, timeouts,
  and malformed git state all produce clear, actionable messages rather than
  stack traces.
- **Local-only backend** — the FastAPI backend binds to `127.0.0.1` and is
  started automatically on first use.
