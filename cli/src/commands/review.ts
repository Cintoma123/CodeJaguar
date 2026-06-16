/**
 * Review command — analyze recent code changes for bugs, quality, and maintainability.
 *
 * The review is written to `review.md` in the project root (not the terminal).
 *
 * Usage:
 *   jaguar review --provider openai                                    # Specify provider
 *   jaguar review --provider openai --model gpt-4o                     # Provider + model (model optional)
 *   jaguar review --file src/auth.ts --provider openai                 # Review a specific file
 *   jaguar review --file src/auth.ts --provider openai --model gpt-4o  # Specific file + provider + model
 */

import { Command } from "commander";
import chalk from "chalk";
import { type Ora } from "ora";
import axios from "axios";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getCredential } from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { getDefaultProvider, resolveBaseUrl, BUILT_IN_PROVIDERS } from "../services/provider.js";
import { collectReviewContext, readFileContent, isGitRepository, hasCommits } from "../services/git.js";
import { loadMemory, loadRules } from "../services/context.js";
import { buildReviewMarkdown, buildConsensusMarkdown } from "../services/output.js";
import {
  listConfiguredProviders,
  dedupeConsensus,
  type ConsensusFinding,
} from "../services/consensus.js";
import type { ReviewFinding } from "../types/review.js";
import { startScan } from "../utils/loader.js";
import { describeRequestError } from "../utils/errors.js";

interface ReviewPayload {
  diff: string;
  files: Array<{ path: string; content: string }>;
  commits: string[];
  memory: Record<string, unknown>;
  rules: string;
}

interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  provider_used: string;
  model_used: string;
}

/**
 * Run a single review against one provider via the backend.
 * Returns null if the provider has no key / missing base URL.
 */
async function runSingleReview(
  provider: string,
  model: string | undefined,
  port: number,
  payload: ReviewPayload
): Promise<ReviewResult | null> {
  const apiKey = await getCredential(provider);
  if (!apiKey) return null;

  const baseUrl = await resolveBaseUrl(provider);
  if (!BUILT_IN_PROVIDERS.includes(provider.toLowerCase()) && !baseUrl) {
    return null;
  }

  const response = await axios.post(
    `http://127.0.0.1:${port}/review`,
    { ...payload, provider, base_url: baseUrl, model },
    {
      headers: {
        "X-Provider-Key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    }
  );

  return response.data as ReviewResult;
}

/**
 * Register the review command.
 */
export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Analyze recent code changes and write findings to review.md")
    .option("--provider <name>", "AI provider to use (openai, anthropic, etc.)")
    .option("--model <name>", "Model to use (e.g. gpt-4o, claude-sonnet-4-20250514, owl-alpha)")
    .option("--file <path>", "Review a specific file")
    .option("--consensus", "Run across all configured providers and keep agreed findings")
    .action(async (options: { provider?: string; model?: string; file?: string; consensus?: boolean }) => {
      const spinner = startScan(
        "jaguar review",
        "analysing git diff · " + (options.provider ?? "auto")
      );

      try {
        const cwd = process.cwd();

        // Guard against a malformed/absent git state before doing any work.
        if (!isGitRepository(cwd)) {
          spinner.fail(
            chalk.red("Not a git repository. Run `jaguar review` from inside a git project.")
          );
          process.exit(1);
        }
        if (!options.file && !hasCommits(cwd)) {
          spinner.fail(
            chalk.red(
              "This repository has no commits yet. Make a commit (or use `--file <path>`) before reviewing."
            )
          );
          process.exit(1);
        }

        // Gather git context + files (shared by both modes)
        spinner.text = "Gathering git context...";
        const { diff, changedFiles, commits } = collectReviewContext(undefined, cwd);

        spinner.text = "Reading changed files...";
        const files: Array<{ path: string; content: string }> = [];
        const MAX_FILE_CONTENT = 50000;
        const MAX_TOTAL = 200000;

        if (options.file) {
          const content = readFileContent(options.file, MAX_FILE_CONTENT, cwd);
          files.push({ path: options.file, content });
        } else {
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

        const payload: ReviewPayload = {
          diff,
          files,
          commits,
          memory: loadMemory(cwd),
          rules: loadRules(cwd),
        };

        // Nothing to review — avoid a wasted provider round-trip.
        if (!payload.diff && payload.files.length === 0) {
          spinner.fail(
            chalk.red(
              options.file
                ? `No readable content found for "${options.file}".`
                : "No changes detected to review. Edit or stage some files first, or use `--file <path>`."
            )
          );
          process.exit(1);
        }

        // Start backend
        spinner.text = "Connecting to backend...";
        await ensureBackend((msg) => {
          spinner.text = msg;
        });
        const port = getBackendPort();
        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        if (options.consensus) {
          await runConsensus(spinner, cwd, port, payload, options.model);
        } else {
          await runStandard(spinner, cwd, port, payload, options.provider, options.model);
        }
      } catch (error: unknown) {
        spinner.fail(chalk.red(`Review failed: ${describeRequestError(error)}`));
        process.exit(1);
      }
    });
}

/**
 * Standard single-provider review → review.md.
 */
async function runStandard(
  spinner: Ora,
  cwd: string,
  port: number,
  payload: ReviewPayload,
  providerOpt: string | undefined,
  model: string | undefined
): Promise<void> {
  const provider = providerOpt ?? (await getDefaultProvider());
  if (!provider) {
    spinner.fail(
      chalk.red(
        "No provider specified. Run `jaguar key add <provider>` first, or use `--provider <name>`."
      )
    );
    process.exit(1);
  }

  const apiKey = await getCredential(provider);
  if (!apiKey) {
    spinner.fail(
      chalk.red(`No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`)
    );
    process.exit(1);
  }

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

  spinner.text = `Running review with ${provider}...`;
  const result = await runSingleReview(provider, model, port, payload);
  if (!result) {
    spinner.fail(chalk.red(`Could not run review with ${provider}.`));
    process.exit(1);
  }

  spinner.stop();

  const markdown = buildReviewMarkdown(
    result.findings,
    result.summary,
    result.provider_used,
    result.model_used,
    new Date().toISOString()
  );
  writeFileSync(join(cwd, "review.md"), markdown, "utf-8");

  const issueCount = result.findings.length;
  spinner.succeed(
    chalk.green(
      `Review complete — ${issueCount} issue${issueCount !== 1 ? "s" : ""} written to ` +
        chalk.bold("review.md")
    )
  );
}

/**
 * Consensus review across all configured providers → review-consensus.md.
 * Falls back to a standard review if fewer than 2 providers are configured.
 */
async function runConsensus(
  spinner: Ora,
  cwd: string,
  port: number,
  payload: ReviewPayload,
  model: string | undefined
): Promise<void> {
  const MIN_AGREE = 2;
  const providers = await listConfiguredProviders();

  if (providers.length < 2) {
    spinner.warn(
      chalk.yellow(
        `Consensus needs at least 2 configured providers (found ${providers.length}). ` +
          "Falling back to a single-provider review."
      )
    );
    spinner.start("Running review...");
    await runStandard(spinner, cwd, port, payload, providers[0], model);
    return;
  }

  const byProvider: Array<{ provider: string; findings: ReviewFinding[] }> = [];
  const used: string[] = [];

  for (const provider of providers) {
    spinner.text = `Running review with ${provider}...`;
    try {
      const result = await runSingleReview(provider, model, port, payload);
      if (result) {
        byProvider.push({ provider, findings: result.findings });
        used.push(provider);
      }
    } catch {
      // Skip a provider that errors; consensus continues with the rest.
    }
  }

  if (used.length < 2) {
    spinner.fail(
      chalk.red(
        `Only ${used.length} provider(s) returned results. Consensus needs at least 2.`
      )
    );
    process.exit(1);
  }

  spinner.text = "Matching findings across models...";
  const agreed: ConsensusFinding[] = dedupeConsensus(byProvider, MIN_AGREE);

  spinner.stop();

  const markdown = buildConsensusMarkdown(agreed, used, MIN_AGREE, new Date().toISOString());
  writeFileSync(join(cwd, "review-consensus.md"), markdown, "utf-8");

  spinner.succeed(
    chalk.green(
      `Consensus review complete — ${agreed.length} agreed finding${agreed.length !== 1 ? "s" : ""} ` +
        `across ${used.length} providers written to ` +
        chalk.bold("review-consensus.md")
    )
  );
}
