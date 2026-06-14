# Getting Started

This guide takes you from a clean machine to your first AI code review in a few
minutes.

---

## 1. Prerequisites

| Requirement | Why | Check |
|-------------|-----|-------|
| Node.js ≥ 18 **or** Bun ≥ 1.0 | Runs the CLI | `node --version` |
| Python ≥ 3.10 | Runs the local backend | `python --version` |
| git | Reads your diffs and history | `git --version` |
| An AI provider API key | BYOK — CodeJaguar calls *your* provider | — |

CodeJaguar never ships an API key. You bring your own for OpenAI, Anthropic,
Gemini, DeepSeek, or any OpenAI-compatible endpoint.

---

## 2. Install

```bash
npm install -g codejaguar-review
# or
bun install -g codejaguar-review
```

This adds the `jaguar` command to your `PATH`. Verify:

```bash
jaguar --help
```

The first time you run a command that needs AI, CodeJaguar starts a local
FastAPI backend on `127.0.0.1` (loopback only) and reuses it on subsequent runs.

---

## 3. Add a provider key

```bash
jaguar key add openai
```

You'll be prompted to paste your API key. Input is hidden — it is never echoed,
logged, or written to a file. The key is stored in your OS keychain.

Verify connectivity:

```bash
jaguar key test openai
# ✓ openai connection successful (gpt-4o, 342ms)
```

> Using a provider that isn't built in (Groq, Ollama, Together AI, …)? See
> [providers.md](providers.md).

---

## 4. Run your first review

From inside a git repository with some uncommitted or committed changes:

```bash
jaguar review
```

CodeJaguar gathers your `git diff`, reads the changed files, calls your provider,
and writes findings to `review.md` in the project root:

```bash
cat review.md
```

Each finding includes a severity, category, file/line reference, description,
impact, and recommendation.

---

## 5. Try the other commands

```bash
jaguar security        # full security scan  → security-full-scan.md
jaguar architecture    # structure analysis  → architecture.md
jaguar summary         # PR description       → pr-summary.md
```

---

## 6. Make reviews smarter (optional)

- **Repository memory** — describe your stack once so every review is
  context-aware:
  ```bash
  jaguar memory init
  jaguar memory set framework FastAPI
  ```
- **Project rules** — enforce your own engineering rules:
  ```bash
  jaguar rules init
  jaguar rules edit
  ```
- **Protection** — block commits that contain secrets:
  ```bash
  jaguar protect
  ```

See [advanced.md](advanced.md) for all three.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No provider specified` | Run `jaguar key add <provider>` or pass `--provider`. |
| `No API key found for <provider>` | Add it: `jaguar key add <provider>`. |
| `Not a git repository` | Run inside a git project (`git init` if needed). |
| `This repository has no commits yet` | Make a commit, or review a single file with `--file`. |
| `Could not reach the local backend` | Check Python ≥ 3.10 is installed and on `PATH`; re-run the command. |
| `Authentication failed (HTTP 401)` | The key was rejected — re-add it with `jaguar key add`. |
| `The request timed out` | Input may be too large; try `--file` or a smaller diff. |

---

Next: [commands.md](commands.md) for the full command reference.
