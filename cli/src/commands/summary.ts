/**
 * Summary command — generate a GitHub-ready PR summary from git changes.
 *
 * Results are written to `pr-summary.md` in the project root (not the terminal).
 *
 * Usage:
 *   jaguar summary --provider openai
 *   jaguar summary --provider openai --model gpt-4o
 *   jaguar summary --base develop --provider anthropic
 *   jaguar summary --provider openai --copy   # also copy to clipboard
 */

import { Command } from "commander";
import chalk from "chalk";
import axios from "axios";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { platform } from "node:os";

import { getCredential } from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { getDefaultProvider, resolveBaseUrl, BUILT_IN_PROVIDERS } from "../services/provider.js";
import { getFullDiff, getChangedFiles, getRecentCommits, isGitRepository } from "../services/git.js";
import { loadMemory } from "../services/context.js";
import { buildSummaryMarkdown } from "../services/output.js";
import { startScan } from "../utils/loader.js";
import { describeRequestError } from "../utils/errors.js";

/**
 * Copy text to the OS clipboard. Returns true on success.
 */
function copyToClipboard(text: string): boolean {
  try {
    const cmd =
      platform() === "darwin"
        ? "pbcopy"
        : platform() === "win32"
          ? "clip"
          : "xclip -selection clipboard";
    execSync(cmd, { input: text, stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Register the summary command.
 */
export function registerSummaryCommand(program: Command): void {
  program
    .command("summary")
    .description("Generate a GitHub-ready PR summary and write it to pr-summary.md")
    .option("--provider <name>", "AI provider to use (openai, anthropic, etc.)")
    .option("--model <name>", "Model to use (e.g. gpt-4o, claude-sonnet-4-20250514)")
    .option("--base <branch>", "Base branch to compare against", "main")
    .option("--copy", "Also copy the summary to the clipboard")
    .action(async (options: { provider?: string; model?: string; base?: string; copy?: boolean }) => {
      const spinner = startScan("jaguar summary", "generating PR summary...");

      try {
        const cwd = process.cwd();

        // Guard against a malformed/absent git state before doing any work.
        if (!isGitRepository(cwd)) {
          spinner.fail(
            chalk.red("Not a git repository. Run `jaguar summary` from inside a git project.")
          );
          process.exit(1);
        }

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

        // 2. API key
        const apiKey = await getCredential(provider);
        if (!apiKey) {
          spinner.fail(
            chalk.red(
              `No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`
            )
          );
          process.exit(1);
        }

        // 2b. Base URL — generic providers require one
        const baseUrl = await resolveBaseUrl(provider);
        if (!BUILT_IN_PROVIDERS.includes(provider.toLowerCase()) && !baseUrl) {
          spinner.fail(
            chalk.red(
              `No base URL configured for generic provider "${provider}". ` +
                `Run \`jaguar key add ${provider}\` to set one.`
            )
          );
          process.exit(1);
        }

        // 3. Gather git context relative to the base branch
        spinner.text = "Gathering git context...";
        const baseBranch = options.base ?? "main";
        const diff = getFullDiff(baseBranch, cwd);
        const changedFiles = getChangedFiles(`${baseBranch}...HEAD`, cwd);
        const commits = getRecentCommits(30, cwd);
        const memory = loadMemory(cwd);

        if (!diff && commits.length === 0) {
          spinner.fail(
            chalk.red(
              `No changes found against base branch "${baseBranch}". ` +
                "Nothing to summarize."
            )
          );
          process.exit(1);
        }

        // 4. Start backend
        spinner.text = "Connecting to backend...";
        await ensureBackend();
        const port = getBackendPort();
        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        // 5. Call the backend
        spinner.text = `Generating summary with ${provider}...`;
        const response = await axios.post(
          `http://127.0.0.1:${port}/summary`,
          {
            commits,
            diff,
            changed_files: changedFiles,
            base_branch: baseBranch,
            provider,
            base_url: baseUrl,
            model: options.model,
            memory,
          },
          {
            headers: {
              "X-Provider-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 120000,
          }
        );

        const result = response.data as {
          markdown: string;
          provider_used: string;
        };

        spinner.stop();

        // 6. Write pr-summary.md
        const reportPath = join(cwd, "pr-summary.md");
        const markdown = buildSummaryMarkdown(
          result.markdown ?? "",
          result.provider_used,
          options.model ?? "",
          new Date().toISOString()
        );
        writeFileSync(reportPath, markdown, "utf-8");

        let suffix = "";
        if (options.copy) {
          suffix = copyToClipboard(result.markdown ?? "")
            ? " (copied to clipboard)"
            : " (clipboard copy failed)";
        }

        spinner.succeed(
          chalk.green(`PR summary written to ` + chalk.bold("pr-summary.md") + suffix)
        );
      } catch (error: unknown) {
        spinner.fail(chalk.red(`Summary failed: ${describeRequestError(error)}`));
        process.exit(1);
      }
    });
}
