/**
 * Review command — analyze recent code changes for bugs, quality, and maintainability.
 *
 * Findings are printed to the terminal. Use `--output md` to also write
 * `review.md`, or `--output json` to also write `review.json`.
 *
 * Usage:
 *   jaguar review --provider openai                                    # Specify provider
 *   jaguar review --provider openai --model gpt-4o                     # Provider + model (model optional)
 *   jaguar review --file src/auth.ts --provider openai                 # Review a specific file
 *   jaguar review --file src/auth.ts --provider openai --model gpt-4o  # Specific file + provider + model
 *   jaguar review --output md                                          # Terminal display + review.md
 *   jaguar review --output json                                        # Terminal display + review.json
 */

import { Command } from "commander";
import chalk from "chalk";
import { type Ora } from "ora";
import axios from "axios";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ensureBackend, getBackendPort } from "../services/backend.js";
import { getDefaultProvider, resolveBaseUrl, BUILT_IN_PROVIDERS, getProviderKey } from "../services/provider.js";
import {
  ciBaseRef,
  printAnnotations,
  writeResultsJson,
  failThresholdMet,
  parseFailOn,
  type CIFinding,
} from "../services/ci.js";
import {
  collectReviewContext,
  readFileContent,
  isGitRepository,
  hasCommits,
  getFileDiff,
} from "../services/git.js";
import { loadMemory, loadRules, loadWatchConfig } from "../services/context.js";
import {
  buildReviewMarkdown,
  buildReviewJson,
  buildConsensusMarkdown,
  buildConsensusJson,
} from "../services/output.js";
import { startWatcher } from "../services/watcher.js";
import {
  filterBySeverity,
  printWatchHeader,
  printChangeDetected,
  printFindings,
  printReviewReport,
  printWaiting,
  printSessionSummary,
  type WatchSessionStats,
} from "../services/watch-output.js";
import {
  listConfiguredProviders,
  dedupeConsensus,
  type ConsensusFinding,
} from "../services/consensus.js";
import type { ReviewFinding } from "../types/review.js";
import { startScan } from "../utils/loader.js";
import { describeRequestError } from "../utils/errors.js";
import { runFixSession } from "../services/fixer.js";

interface ReviewPayload {
  diff: string;
  files: Array<{ path: string; content: string }>;
  commits: string[];
  memory: Record<string, unknown>;
  rules: string;
  /** When true, ask the backend to also produce a per-finding code fix. */
  fix_mode?: boolean;
}

interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  provider_used: string;
  model_used: string;
  /** Set by the backend when the provider call failed (auth, network, etc.). */
  error?: string;
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
  const apiKey = await getProviderKey(provider);
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
 * Write a one-shot review report to disk when `--output` requests it.
 * Returns the filename written, or null when no file output was requested.
 */
function writeReviewFile(
  cwd: string,
  output: string | undefined,
  result: ReviewResult,
  generatedAt: string
): string | null {
  if (output === "md") {
    const markdown = buildReviewMarkdown(
      result.findings,
      result.summary,
      result.provider_used,
      result.model_used,
      generatedAt
    );
    writeFileSync(join(cwd, "review.md"), markdown, "utf-8");
    return "review.md";
  }
  if (output === "json") {
    const json = buildReviewJson(
      result.findings,
      result.summary,
      result.provider_used,
      result.model_used,
      generatedAt
    );
    writeFileSync(join(cwd, "review.json"), json, "utf-8");
    return "review.json";
  }
  return null;
}

/**
 * Print the "saved to <file>" line after a report has been written to disk.
 */
function printSavedLine(filename: string): void {
  console.log(`  ${chalk.gray(`Report saved to ${chalk.bold(filename)}`)}`);
  console.log("");
}

/**
 * Register the review command.
 */
export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Analyze recent code changes and print findings to the terminal")
    .option("--provider <name>", "AI provider to use (openai, anthropic, etc.)")
    .option("--model <name>", "Model to use (e.g. gpt-4o, claude-sonnet-4-20250514, owl-alpha)")
    .option("--file <path>", "Review a specific file")
    .option("--consensus", "Run across all configured providers and keep agreed findings")
    .option("--watch", "Watch the project and review each file as it changes")
    .option("--fix", "Propose and interactively apply a code fix for each finding")
    .option("--output <format>", "Also save the report to a file: md (review.md) or json (review.json)")
    .option("--ci", "CI mode: diff PR, emit GitHub Actions annotations, write jaguar-results.json")
    .option("--fail-on <severity>", "Exit code 1 when findings meet or exceed severity (critical|high|medium|none)", "high")
    .action(async (options: { provider?: string; model?: string; file?: string; consensus?: boolean; watch?: boolean; fix?: boolean; output?: string; ci?: boolean; failOn?: string }) => {
      // Only md/json file output is supported; anything else is a typo worth
      // failing on up front rather than silently ignoring.
      if (options.output && options.output !== "md" && options.output !== "json") {
        console.error(chalk.red(`Invalid --output format "${options.output}". Use "md" or "json".`));
        process.exit(1);
      }

      // --ci is mutually exclusive with watch/fix/consensus (different lifecycles).
      if (options.ci && (options.watch || options.fix || options.consensus)) {
        console.error(chalk.red("`--ci` cannot be combined with `--watch`, `--fix`, or `--consensus`."));
        process.exit(1);
      }

      // CI mode has its own execution path — branch before the standard spinner.
      if (options.ci) {
        await runCI(options.provider, options.model, options.failOn ?? "high");
        return;
      }

      // Watch mode has its own lifecycle (long-running, streams to the terminal,
      // no review.md) — branch before the one-shot spinner/pipeline below.
      if (options.watch) {
        await runWatch(options.provider, options.model);
        return;
      }

      // --fix and --consensus are mutually exclusive: fixes are applied from a
      // single provider's exact original_code, which consensus dedup discards.
      if (options.fix && options.consensus) {
        console.error(chalk.red("`--fix` cannot be combined with `--consensus`."));
        process.exit(1);
      }

      const spinner = startScan(
        "jaguar review",
        "analysing git diff · " + (options.provider ?? "auto")
      );

      try {
        const cwd = process.cwd();

        // Timestamp captured before any provider work — the fixer treats files
        // modified after this instant as stale (line numbers may have shifted).
        const reviewStartMs = Date.now();
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
          fix_mode: options.fix ?? false,
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
          await runConsensus(spinner, cwd, port, payload, options.model, options.output);
        } else {
          const result = await runStandard(
            spinner,
            cwd,
            port,
            payload,
            options.provider,
            options.model,
            options.output
          );

          // Fix mode: after the review is displayed, walk the user through each
          // proposed fix interactively, then re-render the report (terminal and
          // optional file) with each finding's outcome.
          if (options.fix) {
            const timestamp = new Date(reviewStartMs)
              .toISOString()
              .replace(/[:.]/g, "-");
            const summary = await runFixSession(result.findings, cwd, reviewStartMs, timestamp);

            const parts: string[] = [`${summary.applied} applied`];
            if (summary.skipped) parts.push(`${summary.skipped} skipped`);
            if (summary.failed) parts.push(`${summary.failed} failed`);

            console.log(`\n  ${chalk.gray("─".repeat(45))}`);
            console.log(
              `  ${summary.applied > 0 ? chalk.green("✓") : chalk.gray("•")} ` +
                `${parts.join(" · ")}`
            );
            if (summary.backupDir) {
              console.log(`  ${chalk.gray(`Originals backed up to ${summary.backupDir}`)}`);
              console.log(
                `  ${chalk.gray(`Undo with: jaguar fix --undo ${timestamp}`)}`
              );
            }
            console.log("");

            // runFixSession tagged each finding with its outcome — re-print the
            // report so it reflects what was actually applied.
            const providerLabel =
              result.model_used
                ? `${result.provider_used}/${result.model_used}`
                : result.provider_used;
            printReviewReport(result.findings, result.summary, providerLabel);

            // Only persist an updated report when --output was requested.
            const filename = writeReviewFile(
              cwd,
              options.output,
              result,
              new Date().toISOString()
            );
            if (filename) {
              console.log(
                `  ${chalk.gray(`${filename} updated with fix outcomes`)}`
              );
              console.log("");
            }
          }
        }
      } catch (error: unknown) {
        spinner.fail(chalk.red(`Review failed: ${describeRequestError(error)}`));
        process.exit(1);
      }
    });
}

/**
 * CI mode — diff the PR (base vs HEAD), emit GitHub Actions annotations to
 * stdout, write jaguar-results.json, and exit with code 1 when findings meet
 * or exceed the --fail-on threshold (default high).
 *
 * No ora spinner (GitHub Actions captures stdout), no terminal colours in
 * annotations, no review.md. The contract is annotations + jaguar-results.json.
 */
async function runCI(
  providerOpt: string | undefined,
  model: string | undefined,
  failOnRaw: string
): Promise<void> {
  const cwd = process.cwd();

  // Parse and validate --fail-on early.
  const failOn = parseFailOn(failOnRaw);
  if (!failOn) {
    console.error(`Invalid --fail-on value "${failOnRaw}". Use: critical, high, medium, or none.`);
    process.exit(1);
  }

  // CI runs headless (no spinner, plain console.log).
  console.log("Running jaguar review in CI mode...");

  if (!isGitRepository(cwd)) {
    console.error("Not a git repository.");
    process.exit(1);
  }

  // Resolve provider.
  const provider = providerOpt ?? (await getDefaultProvider());
  if (!provider) {
    console.error("No provider configured. Set JAGUAR_API_KEY or run `jaguar key add <provider>`.");
    process.exit(1);
  }

  // CI key must come from JAGUAR_API_KEY env var.
  const apiKey = await getProviderKey(provider);
  if (!apiKey) {
    console.error(
      `No API key available. In CI, set the JAGUAR_API_KEY environment variable.`
    );
    process.exit(1);
  }

  const baseUrl = await resolveBaseUrl(provider);
  if (!BUILT_IN_PROVIDERS.includes(provider.toLowerCase()) && !baseUrl) {
    console.error(
      `No base URL configured for generic provider "${provider}". ` +
        `Set JAGUAR_BASE_URL environment variable.`
    );
    process.exit(1);
  }

  // Determine PR base branch: GITHUB_BASE_REF, or fallback to "main".
  const base = ciBaseRef() ?? "main";
  console.log(`Comparing ${base}...HEAD`);

  // Diff the PR.
  const { getFullDiff, getChangedFiles } = await import("../services/git.js");
  const diff = getFullDiff(base, cwd);
  const changedFiles = getChangedFiles(`${base}...HEAD`, cwd);

  if (!diff && changedFiles.length === 0) {
    console.log("No changes detected.");
    // Write empty results and exit 0.
    writeResultsJson(cwd, "review", [], {
      provider,
      model: model ?? "",
      generatedAt: new Date().toISOString(),
    });
    process.exit(0);
  }

  // Read changed files (same limits as standard mode).
  const files: Array<{ path: string; content: string }> = [];
  const MAX_FILE_CONTENT = 50000;
  const MAX_TOTAL = 200000;
  let totalRead = 0;

  for (const file of changedFiles) {
    if (totalRead >= MAX_TOTAL) break;
    const content = readFileContent(file, MAX_FILE_CONTENT, cwd);
    if (content) {
      files.push({ path: file, content });
      totalRead += content.length;
    }
  }

  console.log(`Reviewing ${files.length} changed file(s)...`);

  // Bring up backend.
  try {
    await ensureBackend();
  } catch (error: unknown) {
    console.error(`Failed to start backend: ${describeRequestError(error)}`);
    process.exit(1);
  }

  const port = getBackendPort();
  if (!port) {
    console.error("Backend did not start.");
    process.exit(1);
  }

  // Build payload.
  const payload: ReviewPayload = {
    diff,
    files,
    commits: [],
    memory: loadMemory(cwd),
    rules: loadRules(cwd),
  };

  // Call backend.
  const result = await runSingleReview(provider, model, port, payload);
  if (!result || result.error) {
    console.error(`Review failed: ${result?.error ?? "unknown error"}`);
    process.exit(1);
  }

  const findings = result.findings;
  console.log(`Found ${findings.length} issue(s).`);

  // Convert findings to CI format.
  const ciFindings: CIFinding[] = findings.map((f) => ({
    severity: f.severity,
    category: f.category,
    file: f.file,
    line: f.line ?? null,
    description: f.description,
    recommendation: f.recommendation,
  }));

  // Emit GitHub Actions annotations to stdout.
  printAnnotations(ciFindings);

  // Write jaguar-results.json.
  writeResultsJson(cwd, "review", ciFindings, {
    provider: result.provider_used,
    model: result.model_used,
    generatedAt: new Date().toISOString(),
  });

  console.log("jaguar-results.json written.");

  // Exit with code 1 if findings meet threshold, 0 otherwise.
  const shouldFail = failThresholdMet(ciFindings, failOn);
  process.exit(shouldFail ? 1 : 0);
}

/**
 * Watch mode — review each file as it changes, streaming findings to the
 * terminal until the user presses Ctrl+C.
 *
 * Unlike the one-shot review, this:
 *  - resolves the provider once up front (not per change),
 *  - reviews a single-file diff per change (never the whole tree),
 *  - prints inline in append mode (no review.md, no screen clear),
 *  - suppresses findings below the configured severity threshold, and
 *  - prints a session summary on exit.
 */
async function runWatch(
  providerOpt: string | undefined,
  model: string | undefined
): Promise<void> {
  const cwd = process.cwd();

  if (!isGitRepository(cwd)) {
    console.error(
      chalk.red("Not a git repository. Run `jaguar review --watch` from inside a git project.")
    );
    process.exit(1);
  }

  // Resolve the provider once — the same validation runStandard does, but we
  // only pay it at startup rather than on every keystroke-triggered review.
  const provider = providerOpt ?? (await getDefaultProvider());
  if (!provider) {
    console.error(
      chalk.red(
        "No provider specified. Run `jaguar key add <provider>` first, or use `--provider <name>`."
      )
    );
    process.exit(1);
  }

  const apiKey = await getProviderKey(provider);
  if (!apiKey) {
    console.error(
      chalk.red(`No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`)
    );
    process.exit(1);
  }

  const baseUrl = await resolveBaseUrl(provider);
  if (!BUILT_IN_PROVIDERS.includes(provider.toLowerCase()) && !baseUrl) {
    console.error(
      chalk.red(
        `No base URL configured for generic provider "${provider}". ` +
          `Run \`jaguar key add ${provider}\` to set one.`
      )
    );
    process.exit(1);
  }

  const watchConfig = loadWatchConfig(cwd);

  // Bring the backend up before watching so the first change reviews instantly.
  const bootSpinner = startScan("jaguar review --watch", "starting backend");
  try {
    await ensureBackend((msg) => {
      bootSpinner.text = msg;
    });
  } catch (error: unknown) {
    bootSpinner.fail(chalk.red(`Failed to start backend: ${describeRequestError(error)}`));
    process.exit(1);
  }
  const port = getBackendPort();
  if (!port) {
    bootSpinner.fail(chalk.red("Failed to start backend."));
    process.exit(1);
  }
  bootSpinner.stop();

  const providerLabel = model ? `${provider}/${model}` : provider;
  printWatchHeader(providerLabel);

  // Session totals for the Ctrl+C summary.
  const stats: WatchSessionStats = { filesReviewed: 0, totalFindings: 0, bySeverity: {} };

  // Serialize reviews: two files changing at once must not interleave their
  // output. Each change appends to this promise chain.
  let queue: Promise<void> = Promise.resolve();

  const reviewOne = async (relativePath: string): Promise<void> => {
    printChangeDetected(relativePath);

    const diff = getFileDiff(relativePath, cwd);
    const content = readFileContent(relativePath, 50000, cwd);

    // Nothing readable (deleted, or an unreadable/binary slip-through): skip
    // quietly rather than shipping an empty request.
    if (!diff && !content) {
      printFindings(relativePath, []);
      printWaiting();
      return;
    }

    const payload: ReviewPayload = {
      diff,
      files: content ? [{ path: relativePath, content }] : [],
      commits: [],
      memory: loadMemory(cwd),
      rules: loadRules(cwd),
    };

    try {
      const result = await runSingleReview(provider, model, port, payload);
      if (!result) {
        console.log(`  ${chalk.red("✗")} Could not run review with ${provider}.`);
        console.log("");
        printWaiting();
        return;
      }

      // Provider call failed (auth/network) — show it instead of "no issues".
      if (result.error) {
        console.log(`  ${chalk.red("✗")} Review failed: ${result.error}`);
        console.log("");
        printWaiting();
        return;
      }

      const shown = filterBySeverity(result.findings, watchConfig.severityThreshold);
      printFindings(relativePath, shown);

      // Tally the shown findings (post-threshold) for the summary.
      stats.filesReviewed += 1;
      stats.totalFindings += shown.length;
      for (const f of shown) {
        const key = f.severity.toLowerCase();
        stats.bySeverity[key] = (stats.bySeverity[key] ?? 0) + 1;
      }
    } catch (error: unknown) {
      console.log(`  ${chalk.red("✗")} Review failed: ${describeRequestError(error)}`);
      console.log("");
    }

    printWaiting();
  };

  const watcher = startWatcher({
    cwd,
    ignore: watchConfig.ignore,
    debounceMs: watchConfig.debounceMs,
    onChange: (relativePath) => {
      queue = queue.then(() => reviewOne(relativePath));
    },
  });

  // Graceful shutdown: stop the watcher, let the in-flight review drain, print
  // the session summary, then exit. Guard against double-fire (Ctrl+C twice).
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await watcher.close();
    await queue; // let any in-flight review finish before summarizing
    printSessionSummary(stats);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  // Keep the process alive indefinitely; SIGINT is the only exit.
  await new Promise<void>(() => {});
}

/**
 * Standard single-provider review → findings printed to the terminal, with an
 * optional report file written only when `--output` is set.
 * Returns the full result so the caller can drive fix mode (`--fix`) and
 * re-render the report with each finding's outcome.
 */
async function runStandard(
  spinner: Ora,
  cwd: string,
  port: number,
  payload: ReviewPayload,
  providerOpt: string | undefined,
  model: string | undefined,
  output: string | undefined
): Promise<ReviewResult> {
  const provider = providerOpt ?? (await getDefaultProvider());
  if (!provider) {
    spinner.fail(
      chalk.red(
        "No provider specified. Run `jaguar key add <provider>` first, or use `--provider <name>`."
      )
    );
    process.exit(1);
  }

  const apiKey = await getProviderKey(provider);
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

  // The backend returns HTTP 200 even when the provider call failed, signalling
  // the failure via `error`. Surface it and exit rather than printing a report
  // that says "0 issues" when nothing was actually reviewed.
  if (result.error) {
    spinner.fail(chalk.red(`Review failed (${provider}): ${result.error}`));
    process.exit(1);
  }

  const issueCount = result.findings.length;
  spinner.succeed(
    chalk.green(
      `Review complete — ${issueCount} issue${issueCount !== 1 ? "s" : ""} found`
    )
  );

  // Findings go to the terminal by default.
  const providerLabel =
    result.model_used
      ? `${result.provider_used}/${result.model_used}`
      : result.provider_used;
  printReviewReport(result.findings, result.summary, providerLabel);

  // A report file is written only when --output explicitly asks for one.
  const filename = writeReviewFile(cwd, output, result, new Date().toISOString());
  if (filename) {
    printSavedLine(filename);
  }

  return result;
}

/**
 * Consensus review across all configured providers → agreed findings printed to
 * the terminal, with an optional report file written only when `--output` is set.
 * Falls back to a standard review if fewer than 2 providers are configured.
 */
async function runConsensus(
  spinner: Ora,
  cwd: string,
  port: number,
  payload: ReviewPayload,
  model: string | undefined,
  output: string | undefined
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
    await runStandard(spinner, cwd, port, payload, providers[0], model, output);
    return;
  }

  const byProvider: Array<{ provider: string; findings: ReviewFinding[] }> = [];
  const used: string[] = [];

  for (const provider of providers) {
    spinner.text = `Running review with ${provider}...`;
    try {
      const result = await runSingleReview(provider, model, port, payload);
      // Skip a provider that errored (auth/network) — consensus needs real
      // findings, and an error result carries none.
      if (result && !result.error) {
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

  spinner.succeed(
    chalk.green(
      `Consensus review complete — ${agreed.length} agreed finding${agreed.length !== 1 ? "s" : ""} ` +
        `across ${used.length} providers`
    )
  );

  // Agreed findings go to the terminal by default.
  printReviewReport(
    agreed,
    "",
    `${used.join(", ")} · ≥${MIN_AGREE} models agree`,
    "Consensus Review"
  );

  // A report file is written only when --output explicitly asks for one.
  if (output === "md") {
    const markdown = buildConsensusMarkdown(agreed, used, MIN_AGREE, new Date().toISOString());
    writeFileSync(join(cwd, "review-consensus.md"), markdown, "utf-8");
    printSavedLine("review-consensus.md");
  } else if (output === "json") {
    const json = buildConsensusJson(agreed, used, MIN_AGREE, new Date().toISOString());
    writeFileSync(join(cwd, "review-consensus.json"), json, "utf-8");
    printSavedLine("review-consensus.json");
  }
}
