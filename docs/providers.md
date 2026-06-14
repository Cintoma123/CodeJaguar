# Providers

CodeJaguar is BYOK (bring your own key) and provider-agnostic. It ships with four
built-in providers and supports **any** OpenAI-compatible endpoint via a custom
base URL.

---

## How keys are stored

Keys live in your operating system's native secret store, accessed by the CLI:

| OS | Store |
|----|-------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service API (GNOME Keyring / KWallet) |

Keys are **never** written to a project file, log, terminal output, or
`config.json`. They are passed to the local backend only via the
`X-Provider-Key` request header, never in a request body.

---

## Built-in providers

These need only an API key:

| Provider | Auth | Default base URL | Default model |
|----------|------|------------------|---------------|
| `openai` | `Authorization: Bearer` | `https://api.openai.com/v1` | `gpt-4o` |
| `anthropic` | `x-api-key` | `https://api.anthropic.com` | `claude-sonnet-4-20250514` |
| `gemini` | key in URL | `https://generativelanguage.googleapis.com` | `gemini-1.5-pro` |
| `deepseek` | `Authorization: Bearer` | `https://api.deepseek.com/v1` | `deepseek-chat` |

```bash
jaguar key add openai
jaguar key add anthropic
jaguar key add gemini
jaguar key add deepseek
```

Override the model per command with `--model`:

```bash
jaguar review --provider openai --model gpt-4o-mini
jaguar review --provider anthropic --model claude-3-5-haiku-20241022
```

---

## Generic (OpenAI-compatible) providers

Any provider that speaks the OpenAI Chat Completions API works through the
generic provider. Use any name that isn't built in; you'll be prompted for a
**base URL**.

```bash
jaguar key add groq
# Enter your groq API key: ********
# Enter base URL for groq (or press Enter to skip): https://api.groq.com/openai/v1
```

Then pass `--model` so the backend knows which model to call:

```bash
jaguar review --provider groq --model llama-3.3-70b-versatile
```

### Tested-compatible endpoints

| Service | Base URL | Notes |
|---------|----------|-------|
| Groq | `https://api.groq.com/openai/v1` | Fast Llama/Mixtral hosting |
| Together AI | `https://api.together.xyz/v1` | Many open models |
| Mistral | `https://api.mistral.ai/v1` | Mistral/Codestral |
| OpenRouter | `https://openrouter.ai/api/v1` | Aggregates many providers |
| Ollama (local) | `http://localhost:11434/v1` | Fully offline; any local key value |
| LM Studio (local) | `http://localhost:1234/v1` | Local model server |
| vLLM (self-hosted) | `http://<host>:8000/v1` | Self-hosted inference |

> If you paste a full `…/chat/completions` URL, CodeJaguar normalizes it down to
> the base automatically.

---

## Choosing a provider per command

Resolution order when you run a command:

1. `--provider <name>` flag, if given.
2. Otherwise, the first configured **built-in** provider (in order: openai,
   anthropic, gemini, deepseek).
3. Otherwise, the first configured **generic** provider.

```bash
jaguar review                       # auto-pick
jaguar review --provider deepseek   # force a provider
```

---

## Managing keys

```bash
jaguar key list                 # names only, never values
jaguar key test openai          # verify connectivity + validity
jaguar key remove openai        # delete the key (and its base URL/type metadata)
```

`jaguar key test` reports the model and round-trip latency on success, or a
clear authentication/connection error on failure.

---

## Token budget

Each provider has a conservative per-request input-token budget so prompts never
exceed the model's context window. If your diff or files are very large, the
backend safely truncates the input (and notes the truncation in the prompt)
rather than failing. To keep reviews focused, prefer:

```bash
jaguar review --file path/to/file.ts   # scope to one file
```

---

## Security model

- Only the AI provider you configured ever receives your code.
- The backend binds to `127.0.0.1` only — it is never exposed to the network.
- No telemetry, no analytics, no third-party calls beyond your provider.
