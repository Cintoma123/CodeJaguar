/**
 * Review command — analyze recent code changes for bugs, quality, and maintainability.
 *
 * Usage:
 *   jaguar review                      # Use default provider
 *   jaguar review --provider openai    # Specify provider
 *   jaguar review --since HEAD~3       # Review last 3 commits
 *   jaguar review --file src/auth.ts   # Review a specific file
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";

import { getCredential } from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { collectReviewContext, readFileContent } from "../services/git.js";
import { loadMemory, loadRules } from "../services/context.js";
import { renderReviewResults } from "../services/output.js";

/**
 * Register the review command.
 */
export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Analyze recent code changes for bugs and quality issues")
    .option("--provider <name>", "AI provider to use (openai, anthropic, etc.)")
    .option("--since <ref>", "Review changes since a git ref (e.g. HEAD~3)")
    .option("--file <path>", "Review a specific file")
    .option("--consensus", "Multi-model consensus mode (Week 4)")
    .action(async (options: { provider?: string; since?: string; file?: string; consensus?: boolean }) => {
      const spinner = ora("Preparing review...").start();

      try {
        // 1. Determine provider
        const provider = options.provider ?? (await getDefaultProvider());
        if (!provider) {
          spinner.fail(
            chalk.red(
              "No provider specified. Run `jaguar key add <provider>` first, " +
                "or use `--provider <name>`."
            )
          );
          process.exit(1);
        }

        // 2. Get API key from keychain
        const apiKey = await getCredential(provider);
        if (!apiKey) {
          spinner.fail(
            chalk.red(
              `No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`
            )
          );
          process.exit(1);
        }

        // 3. Gather git context
        spinner.text = "Gathering git context...";
        const cwd = process.cwd();
        const { diff, changedFiles, commits } = collectReviewContext(options.since, cwd);

        // 4. Load file contents (with token budget)
        spinner.text = "Reading changed files...";
        const files: Array<{ path: string; content: string }> = [];
        const MAX_FILE_CONTENT = 50000; // chars per file
        const MAX_TOTAL = 200000; // total chars for all files

        if (options.file) {
          // Single file review
          const content = readFileContent(options.file, MAX_FILE_CONTENT, cwd);
          files.push({ path: options.file, content });
        } else {
          // Review all changed files
          let totalChars = 0;
          for (const filePath of changedFiles.slice(0, 30)) {
            if (totalChars >= MAX_TOTAL) break;
            const content = readFileContent(filePath, MAX_FILE_CONTENT, cwd);
            if (content) {
              files.push({ path: filePath, content });
              totalChars += content.length;
            }
          }
        }

        // 5. Load memory and rules
        const memory = loadMemory(cwd);
        const rules = loadRules(cwd);

        // 6. Start backend
        spinner.text = "Connecting to backend...";
        await ensureBackend();
        const port = getBackendPort();

        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        // 7. Call the backend
        spinner.text = `Running review with ${provider}...`;
        const response = await axios.post(
          `http://127.0.0.1:${port}/review`,
          {
            diff,
            files,
            commits,
            provider,
            memory,
            rules,
          },
          {
            headers: {
              "X-Provider-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 120000, // 2 minute timeout for long reviews
          }
        );

        const result = response.data as {
          findings: Array<{
            severity: string;
            category: string;
            file: string;
            line?: number;
            description: string;
            impact: string;
            recommendation: string;
          }>;
          summary: string;
          provider_used: string;
          model_used: string;
        };

        spinner.stop();

        // 8. Render output
        renderReviewResults(
          result.findings,
          result.summary,
          result.provider_used,
          result.model_used
        );
      } catch (error: unknown) {
        spinner.fail(chalk.red(`Review failed: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}

/**
 * Get the default provider from config.
 */
async function getDefaultProvider(): Promise<string | null> {
  const providers = [
    "openai",
    "anthropic",
    "gemini",
    "deepseek",
  ];

  for (const provider of providers) {
    const key = await getCredential(provider);
    if (key) {
      return provider;
    }
  }

  return null;
}
