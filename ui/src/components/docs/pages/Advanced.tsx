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
        lead="Repository memory, project rules, consensus reviews, and git protection — the features that make CodeJaguar context-aware and safe by default."
      />

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
          <B>Output:</B> <Code>review-consensus.md</Code>
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
$ cat review-consensus.md`}
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
