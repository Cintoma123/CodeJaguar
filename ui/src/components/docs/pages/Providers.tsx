import { CodeBlock } from "../CodeBlock";
import {
  DocHeader,
  Section,
  SubHeading,
  P,
  B,
  Code,
  List,
  Li,
  OL,
  OLi,
  Callout,
  Table,
} from "../primitives";

/**
 * Providers — hand-built native UI (replaces providers.md).
 */
export function Providers() {
  return (
    <>
      <DocHeader
        title="Providers"
        lead={
          <>
            CodeJaguar is BYOK (bring your own key) and provider-agnostic. It ships
            with four built-in providers and supports <B>any</B>{" "}
            OpenAI-compatible endpoint via a custom base URL.
          </>
        }
      />

      <Section title="How keys are stored">
        <P>
          Keys live in your operating system&apos;s native secret store, accessed
          by the CLI:
        </P>
        <Table
          head={["OS", "Store"]}
          rows={[
            ["macOS", "Keychain"],
            ["Windows", "Credential Manager"],
            ["Linux", "Secret Service API (GNOME Keyring / KWallet)"],
          ]}
        />
        <P>
          Keys are <B>never</B> written to a project file, log, terminal output, or{" "}
          <Code>config.json</Code>. They are passed to the local backend only via
          the <Code>X-Provider-Key</Code> request header, never in a request body.
        </P>
      </Section>

      <Section title="Built-in providers">
        <P>These need only an API key:</P>
        <Table
          head={["Provider", "Auth", "Default base URL", "Default model"]}
          rows={[
            [
              <Code>openai</Code>,
              <Code>Authorization: Bearer</Code>,
              <Code>https://api.openai.com/v1</Code>,
              <Code>gpt-4o</Code>,
            ],
            [
              <Code>anthropic</Code>,
              <Code>x-api-key</Code>,
              <Code>https://api.anthropic.com</Code>,
              <Code>claude-sonnet-4-20250514</Code>,
            ],
            [
              <Code>gemini</Code>,
              "key in URL",
              <Code>https://generativelanguage.googleapis.com</Code>,
              <Code>gemini-1.5-pro</Code>,
            ],
            [
              <Code>deepseek</Code>,
              <Code>Authorization: Bearer</Code>,
              <Code>https://api.deepseek.com/v1</Code>,
              <Code>deepseek-chat</Code>,
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar key add openai
$ jaguar key add anthropic
$ jaguar key add gemini
$ jaguar key add deepseek`}
        />
        <P>
          Override the model per command with <Code>--model</Code>:
        </P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review --provider openai --model gpt-4o-mini
$ jaguar review --provider anthropic --model claude-3-5-haiku-20241022`}
        />
      </Section>

      <Section title="Generic (OpenAI-compatible) providers">
        <P>
          Any provider that speaks the OpenAI Chat Completions API works through
          the generic provider. Use any name that isn&apos;t built in; you&apos;ll
          be prompted for a <B>base URL</B>.
        </P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar key add groq
# Enter your groq API key: ********
# Enter base URL for groq (or press Enter to skip): https://api.groq.com/openai/v1`}
        />
        <P>
          Then pass <Code>--model</Code> so the backend knows which model to call:
        </P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review --provider groq --model llama-3.3-70b-versatile`}
        />

        <SubHeading>Tested-compatible endpoints</SubHeading>
        <Table
          head={["Service", "Base URL", "Notes"]}
          rows={[
            [
              "Groq",
              <Code>https://api.groq.com/openai/v1</Code>,
              "Fast Llama/Mixtral hosting",
            ],
            [
              "Together AI",
              <Code>https://api.together.xyz/v1</Code>,
              "Many open models",
            ],
            ["Mistral", <Code>https://api.mistral.ai/v1</Code>, "Mistral/Codestral"],
            [
              "OpenRouter",
              <Code>https://openrouter.ai/api/v1</Code>,
              "Aggregates many providers",
            ],
            [
              "Ollama (local)",
              <Code>http://localhost:11434/v1</Code>,
              "Fully offline; any local key value",
            ],
            [
              "LM Studio (local)",
              <Code>http://localhost:1234/v1</Code>,
              "Local model server",
            ],
            [
              "vLLM (self-hosted)",
              <Code>http://&lt;host&gt;:8000/v1</Code>,
              "Self-hosted inference",
            ],
          ]}
        />
        <Callout>
          If you paste a full <Code>…/chat/completions</Code> URL, CodeJaguar
          normalizes it down to the base automatically.
        </Callout>
      </Section>

      <Section title="Choosing a provider per command">
        <P>Resolution order when you run a command:</P>
        <OL>
          <OLi n={1}>
            <Code>--provider &lt;name&gt;</Code> flag, if given.
          </OLi>
          <OLi n={2}>
            Otherwise, the first configured <B>built-in</B> provider (in order:
            openai, anthropic, gemini, deepseek).
          </OLi>
          <OLi n={3}>
            Otherwise, the first configured <B>generic</B> provider.
          </OLi>
        </OL>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review                       # auto-pick
$ jaguar review --provider deepseek   # force a provider`}
        />
      </Section>

      <Section title="Managing keys">
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar key list                 # names only, never values
$ jaguar key test openai          # verify connectivity + validity
$ jaguar key remove openai        # delete the key (and its base URL/type metadata)`}
        />
        <P>
          <Code>jaguar key test</Code> reports the model and round-trip latency on
          success, or a clear authentication/connection error on failure.
        </P>
      </Section>

      <Section title="Token budget">
        <P>
          Each provider has a conservative per-request input-token budget so
          prompts never exceed the model&apos;s context window. If your diff or
          files are very large, the backend safely truncates the input (and notes
          the truncation in the prompt) rather than failing. To keep reviews
          focused, prefer:
        </P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review --file path/to/file.ts   # scope to one file`}
        />
      </Section>

      <Section title="Security model">
        <List>
          <Li>Only the AI provider you configured ever receives your code.</Li>
          <Li>
            The backend binds to <Code>127.0.0.1</Code> only — it is never exposed
            to the network.
          </Li>
          <Li>
            No telemetry, no analytics, no third-party calls beyond your provider.
          </Li>
        </List>
      </Section>
    </>
  );
}
