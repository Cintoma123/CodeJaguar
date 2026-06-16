import { CodeBlock } from "../CodeBlock";
import {
  DocHeader,
  Section,
  P,
  B,
  Code,
  A,
  List,
  Li,
  Callout,
  Table,
} from "../primitives";

/**
 * Getting Started — hand-built native UI (replaces getting-started.md).
 * Content mirrors the original guide; structure is composed from doc primitives.
 */
export function GettingStarted() {
  return (
    <>
      <DocHeader
        title="Getting Started"
        lead="From a clean machine to your first AI code review in a few minutes."
      />

      <Section title="1. Prerequisites">
        <Table
          head={["Requirement", "Why", "Check"]}
          rows={[
            [
              <>
                Node.js ≥ 18 <B>or</B> Bun ≥ 1.0
              </>,
              "Runs the CLI",
              <Code>node --version</Code>,
            ],
            ["Python ≥ 3.10", "Runs the local backend", <Code>python --version</Code>],
            ["git", "Reads your diffs and history", <Code>git --version</Code>],
            ["An AI provider API key", "BYOK — CodeJaguar calls your provider", "—"],
          ]}
        />
        <P>
          CodeJaguar never ships an API key. You bring your own for OpenAI,
          Anthropic, Gemini, DeepSeek, or any OpenAI-compatible endpoint.
        </P>
      </Section>

      <Section title="2. Install">
        <CodeBlock
          lang="bash"
          prompt
          code={`$ npm install -g codejaguar-cli
# or
$ bun install -g codejaguar-cli`}
        />
        <P>
          This adds the <Code>jaguar</Code> command to your <Code>PATH</Code>.
          Verify:
        </P>
        <CodeBlock lang="bash" prompt code={`$ jaguar --help`} />
        <P>
          The first time you run a command that needs AI, CodeJaguar starts a
          local FastAPI backend on <Code>127.0.0.1</Code> (loopback only) and
          reuses it on subsequent runs.
        </P>
      </Section>

      <Section title="3. Add a provider key">
        <CodeBlock lang="bash" prompt code={`$ jaguar key add openai`} />
        <P>
          You&apos;ll be prompted to paste your API key. Input is hidden — it is
          never echoed, logged, or written to a file. The key is stored in your
          OS keychain.
        </P>
        <P>Verify connectivity:</P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar key test openai
# ✓ openai connection successful (gpt-4o, 342ms)`}
        />
        <Callout>
          Using a provider that isn&apos;t built in (Groq, Ollama, Together AI, …)?
          See <A href="/docs/providers">Providers</A>.
        </Callout>
      </Section>

      <Section title="4. Run your first review">
        <P>
          From inside a git repository with some uncommitted or committed changes:
        </P>
        <CodeBlock lang="bash" prompt code={`$ jaguar review`} />
        <P>
          CodeJaguar gathers your <Code>git diff</Code>, reads the changed files,
          calls your provider, and writes findings to <Code>review.md</Code> in
          the project root:
        </P>
        <CodeBlock lang="bash" prompt code={`$ cat review.md`} />
        <P>
          Each finding includes a severity, category, file/line reference,
          description, impact, and recommendation.
        </P>
      </Section>

      <Section title="5. Try the other commands">
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar security        # full security scan  → security-full-scan.md
$ jaguar architecture    # structure analysis  → architecture.md
$ jaguar summary         # PR description       → pr-summary.md`}
        />
      </Section>

      <Section title="6. Make reviews smarter (optional)">
        <List>
          <Li>
            <B>Repository memory</B> — describe your stack once so every review is
            context-aware:
          </Li>
        </List>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar memory init
$ jaguar memory set framework FastAPI`}
        />
        <List>
          <Li>
            <B>Project rules</B> — enforce your own engineering rules:
          </Li>
        </List>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar rules init
$ jaguar rules edit`}
        />
        <List>
          <Li>
            <B>Protection</B> — block commits that contain secrets:
          </Li>
        </List>
        <CodeBlock lang="bash" prompt code={`$ jaguar protect`} />
        <P>
          See <A href="/docs/advanced">Advanced Features</A> for all three.
        </P>
      </Section>

      <Section title="Troubleshooting">
        <Table
          head={["Symptom", "Fix"]}
          rows={[
            [
              <Code>No provider specified</Code>,
              <>
                Run <Code>jaguar key add &lt;provider&gt;</Code> or pass{" "}
                <Code>--provider</Code>.
              </>,
            ],
            [
              <Code>No API key found for &lt;provider&gt;</Code>,
              <>
                Add it: <Code>jaguar key add &lt;provider&gt;</Code>.
              </>,
            ],
            [
              <Code>Not a git repository</Code>,
              <>
                Run inside a git project (<Code>git init</Code> if needed).
              </>,
            ],
            [
              <Code>This repository has no commits yet</Code>,
              <>
                Make a commit, or review a single file with <Code>--file</Code>.
              </>,
            ],
            [
              <Code>Could not reach the local backend</Code>,
              <>
                Check Python ≥ 3.10 is installed and on <Code>PATH</Code>; re-run
                the command.
              </>,
            ],
            [
              <Code>Authentication failed (HTTP 401)</Code>,
              <>
                The key was rejected — re-add it with <Code>jaguar key add</Code>.
              </>,
            ],
            [
              <Code>The request timed out</Code>,
              <>
                Input may be too large; try <Code>--file</Code> or a smaller diff.
              </>,
            ],
          ]}
        />
        <P>
          Next: <A href="/docs/commands">Command Reference</A> for the full
          command reference.
        </P>
      </Section>
    </>
  );
}
