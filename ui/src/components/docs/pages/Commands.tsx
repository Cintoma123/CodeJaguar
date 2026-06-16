import { CodeBlock } from "../CodeBlock";
import {
  DocHeader,
  Section,
  P,
  B,
  Code,
  A,
  Callout,
  Table,
} from "../primitives";

/**
 * Command Reference — hand-built native UI (replaces commands.md).
 */
export function Commands() {
  return (
    <>
      <DocHeader
        title="Command Reference"
        lead="Every CodeJaguar command and flag. Commands that produce a report write it to a Markdown file in the project root rather than printing to the terminal."
      />

      <Callout>
        <B>Note on naming:</B> credentials are managed with <Code>jaguar key</Code>{" "}
        (the binary is <Code>jaguar</Code>, published as the npm package{" "}
        <Code>codejaguar-cli</Code>).
      </Callout>

      <Section title="jaguar key" id="key">
        <P>
          Manage provider API keys (BYOK). Keys are stored in the OS keychain and
          never written to files, logs, or terminal output.
        </P>
        <Table
          head={["Subcommand", "Description"]}
          rows={[
            [
              <Code>jaguar key add [provider]</Code>,
              "Store an API key (hidden prompt). Generic providers also prompt for a base URL.",
            ],
            [<Code>jaguar key list</Code>, "List configured providers (names only)."],
            [
              <Code>jaguar key test &lt;provider&gt;</Code>,
              "Verify the key by making a minimal API call.",
            ],
            [
              <Code>jaguar key remove &lt;provider&gt;</Code>,
              "Delete a stored key and its metadata.",
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar key add openai
$ jaguar key add groq          # generic — prompts for base URL
$ jaguar key list
$ jaguar key test anthropic
$ jaguar key remove deepseek`}
        />
        <P>
          Built-in providers: <Code>openai</Code>, <Code>anthropic</Code>,{" "}
          <Code>gemini</Code>, <Code>deepseek</Code>. Any other name is treated as
          a generic OpenAI-compatible provider. See{" "}
          <A href="/docs/providers">Providers</A>.
        </P>
      </Section>

      <Section title="jaguar review" id="review">
        <P>
          Analyze recent code changes for bugs, code smells, performance issues,
          maintainability problems, and refactoring opportunities.
        </P>
        <P>
          <B>Output:</B> <Code>review.md</Code> (or <Code>review-consensus.md</Code>{" "}
          with <Code>--consensus</Code>).
        </P>
        <Table
          head={["Flag", "Description"]}
          rows={[
            [
              <Code>--provider &lt;name&gt;</Code>,
              "AI provider to use. Defaults to your configured/default provider.",
            ],
            [
              <Code>--model &lt;name&gt;</Code>,
              <>
                Specific model (e.g. <Code>gpt-4o</Code>,{" "}
                <Code>claude-sonnet-4-20250514</Code>).
              </>,
            ],
            [
              <Code>--file &lt;path&gt;</Code>,
              "Review a single file instead of the git diff.",
            ],
            [
              <Code>--consensus</Code>,
              "Run across all configured providers, keep agreed findings.",
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review
$ jaguar review --provider openai --model gpt-4o
$ jaguar review --file src/auth.ts
$ jaguar review --consensus`}
        />
        <P>
          Context gathered: <Code>git diff HEAD</Code>, changed-file contents
          (size-limited), recent commit messages, plus{" "}
          <Code>.jaguar/memory.json</Code> and <Code>.jaguar/rules.md</Code> if
          present.
        </P>
      </Section>

      <Section title="jaguar security" id="security">
        <P>
          Comprehensive security scan across source code, dependencies, Docker,
          Docker Compose, GitHub Actions, environment files, <Code>.gitignore</Code>,
          and secrets.
        </P>
        <P>
          <B>Output:</B> <Code>security-full-scan.md</Code>, or{" "}
          <Code>security-&lt;module&gt;.md</Code> with <Code>--only</Code>.
        </P>
        <Table
          head={["Flag", "Description"]}
          rows={[
            [<Code>--provider &lt;name&gt;</Code>, "AI provider to use."],
            [<Code>--model &lt;name&gt;</Code>, "Specific model."],
            [
              <Code>--only &lt;module&gt;</Code>,
              <>
                Run a single module: <Code>secrets</Code>, <Code>deps</Code>,{" "}
                <Code>docker</Code>, <Code>actions</Code>.
              </>,
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar security
$ jaguar security --only secrets
$ jaguar security --only deps --provider openai --model gpt-4o
$ jaguar security --only docker --provider anthropic`}
        />
        <P>
          Modules: secret pattern scanner (deterministic, runs first), dependency
          CVE analysis, Dockerfile checks, Docker Compose checks, GitHub Actions
          checks, <Code>.env</Code> analysis, <Code>.gitignore</Code> gap
          analysis, and AI-powered contextual source review. A CRITICAL secret
          short-circuits the scan and is reported immediately.
        </P>
      </Section>

      <Section title="jaguar architecture" id="architecture">
        <P>
          Analyze repository structure for architectural issues — coupling,
          layering violations, god modules, and drift.
        </P>
        <P>
          <B>Output:</B> <Code>architecture.md</Code>.
        </P>
        <Table
          head={["Flag", "Description"]}
          rows={[
            [<Code>--provider &lt;name&gt;</Code>, "AI provider to use."],
            [<Code>--model &lt;name&gt;</Code>, "Specific model."],
            [
              <Code>--depth &lt;n&gt;</Code>,
              <>
                Directory-tree depth (default <Code>3</Code>).
              </>,
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar architecture
$ jaguar architecture --provider anthropic
$ jaguar architecture --depth 5`}
        />
        <P>
          Context gathered: directory tree, key config files (
          <Code>tsconfig.json</Code>, <Code>package.json</Code>,{" "}
          <Code>pyproject.toml</Code>, <Code>go.mod</Code>, <Code>Cargo.toml</Code>,
          etc.), plus memory and rules.
        </P>
      </Section>

      <Section title="jaguar summary" id="summary">
        <P>
          Generate a GitHub-ready pull request summary from your branch&apos;s
          changes.
        </P>
        <P>
          <B>Output:</B> <Code>pr-summary.md</Code>.
        </P>
        <Table
          head={["Flag", "Description"]}
          rows={[
            [<Code>--provider &lt;name&gt;</Code>, "AI provider to use."],
            [<Code>--model &lt;name&gt;</Code>, "Specific model."],
            [
              <Code>--base &lt;branch&gt;</Code>,
              <>
                Base branch to compare against (default <Code>main</Code>).
              </>,
            ],
            [<Code>--copy</Code>, "Also copy the Markdown to the clipboard."],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar summary
$ jaguar summary --base develop
$ jaguar summary --provider openai --copy`}
        />
        <P>
          The summary always contains these sections: Summary, Features Added,
          Files Changed, Risks, Suggested Tests, Breaking Changes.
        </P>
      </Section>

      <Section title="jaguar memory" id="memory">
        <P>
          Manage repository memory (<Code>.jaguar/memory.json</Code>) — see{" "}
          <A href="/docs/advanced">Advanced Features</A>.
        </P>
        <Table
          head={["Subcommand", "Description"]}
          rows={[
            [<Code>jaguar memory init</Code>, <>Create <Code>memory.json</Code> from a template.</>],
            [<Code>jaguar memory show</Code>, "Print current memory."],
            [
              <Code>jaguar memory set &lt;key&gt; &lt;value&gt;</Code>,
              "Set a field (comma-separated for list fields).",
            ],
          ]}
        />
        <P>
          List fields: <Code>patterns</Code>, <Code>conventions</Code>,{" "}
          <Code>services</Code>.
        </P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar memory init
$ jaguar memory set framework FastAPI
$ jaguar memory set patterns "Repository Pattern,Dependency Injection"
$ jaguar memory show`}
        />
      </Section>

      <Section title="jaguar rules" id="rules">
        <P>
          Manage project rules (<Code>.jaguar/rules.md</Code>) — see{" "}
          <A href="/docs/advanced">Advanced Features</A>.
        </P>
        <Table
          head={["Subcommand", "Description"]}
          rows={[
            [<Code>jaguar rules init</Code>, <>Create <Code>rules.md</Code> from a template.</>],
            [<Code>jaguar rules show</Code>, "Print current rules."],
            [
              <Code>jaguar rules edit</Code>,
              <>
                Open <Code>rules.md</Code> in <Code>$EDITOR</Code> (creates it if
                missing).
              </>,
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar rules init
$ jaguar rules edit
$ jaguar rules show`}
        />
      </Section>

      <Section title="jaguar protect" id="protect">
        <P>
          Install a pre-commit git hook that scans staged files for secrets and
          blocks commits that would leak them — see{" "}
          <A href="/docs/advanced">Advanced Features</A>.
        </P>
        <Table
          head={["Flag", "Description"]}
          rows={[
            [<em>(none)</em>, "Install the pre-commit hook."],
            [<Code>--status</Code>, "Show whether the hook is installed."],
            [<Code>--remove</Code>, "Uninstall the hook."],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar protect
$ jaguar protect --status
$ jaguar protect --remove`}
        />
        <P>
          CRITICAL/HIGH secret matches block the commit; MEDIUM matches warn but
          allow it. Bypass with <Code>git commit --no-verify</Code>.
        </P>
      </Section>

      <Section title="jaguar doctor" id="doctor">
        <P>
          Diagnose your CodeJaguar setup. Run this first whenever a command fails
          to start the backend — it prints a clear pass/fail for each part of the
          environment and tells you how to fix anything that&apos;s broken.
        </P>
        <Table
          head={["Check", "What it verifies"]}
          rows={[
            [<Code>Backend source</Code>, "The bundled Python backend is present in the package."],
            [<Code>System Python</Code>, "A Python 3.10+ interpreter is on your PATH (used to build the venv)."],
            [<Code>Backend venv</Code>, <>The isolated environment exists at <Code>~/.jaguar/venv</Code>.</>],
            [<Code>Dependencies</Code>, "fastapi, uvicorn, httpx, keyring, and pydantic import cleanly."],
            [<Code>Backend service</Code>, "Whether a backend is currently running (it starts on demand)."],
            [<Code>Provider keys</Code>, "At least one provider API key is configured."],
          ]}
        />
        <CodeBlock lang="bash" prompt code={`$ jaguar doctor`} />
      </Section>

      <Section title="jaguar setup" id="setup">
        <Callout>
          You normally never run this. The first command that needs the backend
          (e.g. <Code>jaguar review</Code>) creates the Python environment and
          installs dependencies automatically. <Code>setup</Code> exists only to
          repair a broken environment.
        </Callout>
        <P>
          Reinstall or rebuild the local Python backend environment. Use it when{" "}
          <Code>jaguar doctor</Code> reports a broken venv or missing
          dependencies.
        </P>
        <Table
          head={["Flag", "Description"]}
          rows={[
            [<em>(none)</em>, "Reinstall the venv and dependencies if they're missing or out of date."],
            [
              <Code>--force</Code>,
              <>
                Delete <Code>~/.jaguar/venv</Code> and rebuild it from scratch.
              </>,
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar setup           # repair a broken environment
$ jaguar setup --force   # rebuild the venv from scratch`}
        />
      </Section>

      <Section title="Global" id="global">
        <Table
          head={["Flag", "Description"]}
          rows={[
            [
              <>
                <Code>--help</Code>, <Code>-h</Code>
              </>,
              "Show help for any command.",
            ],
            [
              <>
                <Code>--version</Code>, <Code>-V</Code>
              </>,
              "Print the CLI version.",
            ],
          ]}
        />
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar --help
$ jaguar review --help
$ jaguar --version`}
        />
      </Section>
    </>
  );
}
