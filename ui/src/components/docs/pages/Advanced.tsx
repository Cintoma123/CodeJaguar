import { CodeBlock } from "../CodeBlock";
import {
  DocHeader,
  Section,
  SubHeading,
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
 * Advanced Features — hand-built native UI (replaces advanced.md).
 */
export function Advanced() {
  return (
    <>
      <DocHeader
        title="Advanced Features"
        lead="Watch mode, interactive fixes, CI integration, repository memory, project rules, consensus reviews, and git protection — the features that make CodeJaguar a full workflow, not just a one-shot review."
      />

      <Section title="Watch Mode" id="watch-mode">
        <P>
          <B>Command:</B> <Code>jaguar review --watch</Code>
        </P>
        <P>
          Watch mode turns CodeJaguar into a live co-pilot. It monitors your project
          and, every time you save a file, automatically reviews just that file and
          streams the findings to the terminal — no need to re-run a command. Press{" "}
          <Code>Ctrl+C</Code> to stop; a session summary is printed on exit.
        </P>

        <SubHeading>Behavior</SubHeading>
        <List>
          <Li>
            Reviews a <B>single-file diff</B> per change (not the whole tree), so each
            review is fast and focused.
          </Li>
          <Li>
            Changes are <B>debounced</B> (800ms by default) so rapid consecutive saves
            collapse into one review.
          </Li>
          <Li>
            Findings append inline below the previous result with a separator — the
            terminal is never cleared.
          </Li>
          <Li>
            Always ignores <Code>node_modules/</Code>, <Code>dist/</Code>,{" "}
            <Code>.git/</Code>, <Code>.jaguar/</Code>, binary files, and files larger
            than 500KB.
          </Li>
        </List>

        <SubHeading>Configuration</SubHeading>
        <P>
          Tune watch behavior in the <Code>watch</Code> block of{" "}
          <Code>.jaguar/memory.json</Code>. Every field is optional and falls back to a
          default if missing or malformed:
        </P>
        <CodeBlock
          lang="json"
          code={`{
  "watch": {
    "ignore": ["dist/", "*.test.ts"],
    "debounce_ms": 800,
    "severity_threshold": "medium"
  }
}`}
        />
        <Table
          head={["Field", "Default", "Meaning"]}
          rows={[
            [
              <Code>ignore</Code>,
              <Code>[]</Code>,
              <>
                Extra glob-ish patterns to skip (on top of the always-ignored dirs).
                Supports <Code>*</Code>, <Code>**</Code>, and a trailing{" "}
                <Code>/</Code> for a directory prefix.
              </>,
            ],
            [
              <Code>debounce_ms</Code>,
              <Code>800</Code>,
              "Milliseconds to wait after the last write before reviewing a file.",
            ],
            [
              <Code>severity_threshold</Code>,
              <Code>low</Code>,
              <>
                Findings below this severity are suppressed in watch output. One of{" "}
                <Code>low</Code>, <Code>medium</Code>, <Code>high</Code>,{" "}
                <Code>critical</Code>.
              </>,
            ],
          ]}
        />
        <Callout>
          <B>Note:</B> the default <Code>severity_threshold</Code> is{" "}
          <Code>low</Code> (every finding is shown). Set it to <Code>medium</Code> to
          hide LOW findings and reduce noise while coding.
        </Callout>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review --watch
$ jaguar review --watch --provider openai --model gpt-4o`}
        />
      </Section>

      <Section title="Fix Mode" id="fix-mode">
        <P>
          <B>Command:</B> <Code>jaguar review --fix</Code>
        </P>
        <P>
          Fix mode turns a review from read-only information into a one-key action.
          After each finding is displayed, CodeJaguar proposes the exact corrected code
          and prompts you to apply or skip it. This transforms the review loop from
          &quot;read, then hand-edit&quot; into &quot;review, then approve.&quot;
        </P>

        <SubHeading>Interactive flow</SubHeading>
        <P>
          For each finding, CodeJaguar shows a red/green diff of the proposed change and
          prompts for an action:
        </P>
        <Table
          head={["Key", "Action"]}
          rows={[
            [<Code>y</Code>, "Apply this fix and move to the next finding."],
            [<Code>n</Code>, "Skip this finding, leave the file unchanged."],
            [<Code>s</Code>, "Skip all remaining fixes."],
            [<Code>q</Code>, "Quit the fix session immediately."],
          ]}
        />

        <SubHeading>Safety mechanisms</SubHeading>
        <List>
          <Li>
            Before any change, the original file is backed up to{" "}
            <Code>~/.jaguar/backups/&lt;timestamp&gt;/</Code>.
          </Li>
          <Li>
            A fix is only applied when the finding&apos;s{" "}
            <Code>original_code</Code> is found <B>verbatim</B> in the file — CodeJaguar
            never guesses, so it can&apos;t corrupt a file.
          </Li>
          <Li>
            Files modified after the review started (mtime check) are skipped with a
            warning, since their line numbers may have shifted.
          </Li>
          <Li>
            Undo an entire session with{" "}
            <Code>jaguar fix --undo &lt;timestamp&gt;</Code> (the timestamp is printed
            when the session ends).
          </Li>
        </List>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar review --fix
# ... apply/skip each fix ...
# ✓ 2 applied · Originals backed up to ~/.jaguar/backups/2026-08-07T14-30-00-123Z
$ jaguar fix --undo 2026-08-07T14-30-00-123Z   # roll everything back`}
        />
        <Callout tone="warn">
          <B>Not combinable with <Code>--consensus</Code>.</B> Fixes are applied from a
          single provider&apos;s exact <Code>original_code</Code>, which consensus dedup
          discards.
        </Callout>
      </Section>

      <Section title="CI Integration" id="ci-integration">
        <P>
          <B>Command:</B> <Code>jaguar review --ci</Code> ·{" "}
          <Code>jaguar security --ci</Code>
        </P>
        <P>
          CI mode runs CodeJaguar as part of a pull-request pipeline. It reviews only
          what the PR changed, prints findings as GitHub Actions annotations (rendered
          inline on the PR diff), writes a machine-readable{" "}
          <Code>jaguar-results.json</Code>, and controls the job&apos;s pass/fail through
          its exit code. This moves CodeJaguar from a personal tool to a team standard.
        </P>

        <SubHeading>How it differs from a normal review</SubHeading>
        <Table
          head={["", "jaguar review", "jaguar review --ci"]}
          rows={[
            ["Diffs", "Your working tree (uncommitted changes)", "Committed base…HEAD (the PR's changes)"],
            ["API key from", "OS keychain", <><Code>JAGUAR_API_KEY</Code> env var (a GitHub secret)</>],
            ["Output", "Pretty terminal report", <>Annotations on stdout + <Code>jaguar-results.json</Code></>],
            ["Result", "Just prints", <>Exit code 1 when findings hit <Code>--fail-on</Code></>],
          ]}
        />

        <SubHeading>Key handling in CI</SubHeading>
        <P>
          A GitHub runner has no OS keychain, so in CI the key is read from the{" "}
          <Code>JAGUAR_API_KEY</Code> environment variable (never written to disk). For
          a generic OpenAI-compatible provider, set the base URL via{" "}
          <Code>JAGUAR_BASE_URL</Code>. CI mode is detected automatically from{" "}
          <Code>CI=true</Code> / <Code>GITHUB_ACTIONS=true</Code>.
        </P>

        <SubHeading>The --fail-on threshold</SubHeading>
        <Table
          head={["Value", "Fails the job when…"]}
          rows={[
            [<Code>critical</Code>, "any CRITICAL finding is present"],
            [<Code>high</Code>, <>any HIGH or CRITICAL finding is present (<B>default</B>)</>],
            [<Code>medium</Code>, "any MEDIUM or higher finding is present"],
            [<Code>none</Code>, "never — annotations only, always exit 0"],
          ]}
        />

        <SubHeading>GitHub Actions example</SubHeading>
        <CodeBlock
          lang="yaml"
          code={`# .github/workflows/jaguar.yml
name: CodeJaguar Review

on:
  pull_request:
    branches: [main, develop]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # full history so base...HEAD can be diffed

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm install -g codejaguar-cli

      - run: jaguar review --ci --provider openai --fail-on high
        env:
          JAGUAR_API_KEY: \${{ secrets.OPENAI_API_KEY }}`}
        />
        <Callout>
          Your local keychain key is <B>not</B> used by a GitHub Actions run — you must
          add the provider key as a repository secret and expose it as{" "}
          <Code>JAGUAR_API_KEY</Code>. See the{" "}
          <A href="/docs/commands#review">Command Reference</A> for all CI flags.
        </Callout>
      </Section>

      <Section title="Repository Memory" id="repository-memory">
        <P>
          <B>File:</B> <Code>.jaguar/memory.json</Code> (lives in your project
          root; safe to commit)
        </P>
        <P>
          Repository memory describes your codebase&apos;s intended design once, so{" "}
          <B>every</B> review, security scan, and architecture analysis is
          context-aware. The backend injects it into every AI prompt.
        </P>

        <SubHeading>Structure</SubHeading>
        <CodeBlock
          lang="json"
          code={`{
  "framework": "FastAPI",
  "database": "PostgreSQL",
  "architecture": "Clean Architecture",
  "testing": "Pytest",
  "language": "Python 3.12",
  "patterns": ["Repository Pattern", "Dependency Injection"],
  "conventions": ["snake_case for files", "PEP 8"],
  "services": ["auth-service", "payment-service"],
  "notes": "All endpoints must use the auth middleware"
}`}
        />
        <P>
          The same file can also hold a <Code>watch</Code> block that configures{" "}
          <A href="/docs/advanced#watch-mode">Watch Mode</A> — it is read from{" "}
          <Code>memory.json</Code> but ignored by non-watch commands.
        </P>

        <SubHeading>Commands</SubHeading>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar memory init                  # create the template
$ jaguar memory show                  # print current memory
$ jaguar memory set framework FastAPI # set a single field`}
        />
        <P>
          List fields (<Code>patterns</Code>, <Code>conventions</Code>,{" "}
          <Code>services</Code>) take a comma-separated value:
        </P>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar memory set patterns "Repository Pattern,Dependency Injection"
$ jaguar memory set services "auth-service,billing-service"`}
        />
        <P>
          Memory is loaded automatically when present — no flag required. Missing
          or malformed <Code>memory.json</Code> is ignored gracefully.
        </P>
      </Section>

      <Section title="Project Rules" id="project-rules">
        <P>
          <B>File:</B> <Code>.jaguar/rules.md</Code> (lives in your project root;
          safe to commit)
        </P>
        <P>
          Project rules are engineering conventions appended to the{" "}
          <B>system prompt</B> of every AI call, so the model enforces your
          standards and flags violations.
        </P>

        <SubHeading>Example</SubHeading>
        <CodeBlock
          lang="markdown"
          code={`# Project Rules

- Always use the Repository Pattern for data access
- Avoid raw SQL; use the ORM query builder
- All public API endpoints must require authentication
- Prefer dependency injection over direct instantiation
- Never return raw database errors to API consumers
- All async functions must handle errors with try/catch`}
        />

        <SubHeading>Commands</SubHeading>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar rules init    # create the template
$ jaguar rules show    # print current rules
$ jaguar rules edit    # open in $EDITOR (creates the file if missing)`}
        />
        <P>
          <Code>jaguar rules edit</Code> uses <Code>$EDITOR</Code>/
          <Code>$VISUAL</Code>, falling back to <Code>notepad</Code> on Windows and{" "}
          <Code>vi</Code> elsewhere.
        </P>
      </Section>

      <Section title="Consensus Mode" id="consensus-mode">
        <P>
          <B>Command:</B> <Code>jaguar review --consensus</Code>
        </P>
        <P>
          <B>Output:</B> terminal; add <Code>--output md</Code> for{" "}
          <Code>review-consensus.md</Code> or <Code>--output json</Code> for{" "}
          <Code>review-consensus.json</Code>.
        </P>
        <P>
          Consensus mode reduces false positives by running the same review across
          all configured providers and keeping only findings that{" "}
          <B>at least two</B> of them agree on.
        </P>

        <SubHeading>Flow</SubHeading>
        <CodeBlock
          code={`Gather context
      │
      ├── Provider A → findings set A
      ├── Provider B → findings set B
      └── Provider C → findings set C
            │
            ▼
   Match findings across sets (by file + semantic similarity)
            │
            ▼
   Keep findings present in ≥ 2 providers`}
        />

        <SubHeading>Requirements &amp; behavior</SubHeading>
        <List>
          <Li>
            Needs <B>at least 2</B> configured providers. With only one, it falls
            back to a standard single-provider review and warns you.
          </Li>
          <Li>
            A provider that errors mid-run is skipped; consensus continues with the
            rest, as long as at least two return results.
          </Li>
          <Li>
            The report records which providers participated and the agreement
            threshold.
          </Li>
        </List>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar key add openai
$ jaguar key add anthropic
$ jaguar review --consensus
$ jaguar review --consensus --output md   # terminal display + review-consensus.md`}
        />
      </Section>

      <Section title="Git Protection" id="git-protection">
        <P>
          <B>Command:</B> <Code>jaguar protect</Code>
        </P>
        <P>
          <B>Installs:</B> <Code>.git/hooks/pre-commit</Code>
        </P>
        <P>
          Installs a local pre-commit hook that scans <B>staged</B> files for
          secrets before a commit is written to history. The scan is
          deterministic, local, and AI-free, so commits stay fast.
        </P>

        <SubHeading>Commands</SubHeading>
        <CodeBlock
          lang="bash"
          prompt
          code={`$ jaguar protect            # install the hook
$ jaguar protect --status   # show whether it's installed
$ jaguar protect --remove   # uninstall the hook`}
        />

        <SubHeading>Behavior on commit</SubHeading>
        <Table
          head={["Match severity", "Result"]}
          rows={[
            [
              "CRITICAL / HIGH",
              <>
                Commit <B>blocked</B> (exit 1), with file/line and remediation
                steps
              </>,
            ],
            ["MEDIUM", "Commit allowed, with a warning"],
            ["None", "Commit proceeds normally"],
          ]}
        />
        <P>
          CodeJaguar refuses to overwrite a pre-existing pre-commit hook it
          didn&apos;t create, and <Code>--remove</Code> won&apos;t touch a hook it
          didn&apos;t author.
        </P>

        <SubHeading>Blocked-commit example</SubHeading>
        <CodeBlock
          code={`╔════════════════════════════════════════╗
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

To bypass (NOT recommended): git commit --no-verify`}
        />
        <P>
          Detected secret types include OpenAI/Anthropic keys, AWS access keys, GCP
          service account JSON, private keys, JWTs, database connection strings,
          Stripe keys, GitHub tokens, Slack tokens, and high-entropy assignments.
        </P>
      </Section>

      <Section title="Reliability notes" id="reliability-notes">
        <List>
          <Li>
            <B>Token budgets</B> — each provider has an input-token budget below
            its context window; oversized prompts are truncated safely instead of
            erroring.
          </Li>
          <Li>
            <B>Graceful failures</B> — missing providers, bad keys, network errors,
            timeouts, and malformed git state all produce clear, actionable
            messages rather than stack traces.
          </Li>
          <Li>
            <B>Local-only backend</B> — the FastAPI backend binds to{" "}
            <Code>127.0.0.1</Code> and is started automatically on first use.
          </Li>
        </List>
      </Section>
    </>
  );
}
