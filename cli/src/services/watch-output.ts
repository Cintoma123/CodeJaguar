/**
 * Terminal renderers for review output.
 *
 * Unlike the markdown builders in output.ts, these print directly to the
 * terminal: `printReviewReport` renders a full one-shot review, and the watch
 * mode helpers print each result in append mode — written below the previous
 * one with a separator, and the screen is never cleared. This gives the "live
 * co-pilot" scroll-back the watch feature is designed around.
 */

import chalk from "chalk";

import type { ReviewFinding, FixOutcome } from "../types/review.js";
import type { WatchSeverity } from "./context.js";

const purple = chalk.hex("#a78bfa");
const grey = chalk.hex("#555250");

/** Numeric rank per severity — higher is more severe. Unknown → LOW. */
const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function rankOf(severity: string): number {
  return SEVERITY_RANK[severity.toLowerCase()] ?? 0;
}

/** Colour a severity label by its level. */
function colorSeverity(severity: string): string {
  const label = `[${severity.toUpperCase()}]`;
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return chalk.red.bold(label);
    case "medium":
      return chalk.yellow.bold(label);
    case "low":
      return chalk.blue.bold(label);
    default:
      return chalk.gray.bold(label);
  }
}

/** Terminal badge for a finding's fix outcome (empty for normal reviews). */
function outcomeBadge(outcome: FixOutcome | undefined): string {
  switch (outcome) {
    case "fixed":
      return `  ${chalk.green.bold("✓ Fixed")}`;
    case "skipped":
      return `  ${chalk.gray("— Skipped")}`;
    case "failed":
      return `  ${chalk.red.bold("✗ Failed")}`;
    default:
      return "";
  }
}

/** Print one finding's lines (severity, meta, description, recommendation). */
function printFinding(f: ReviewFinding): void {
  const location = f.line ? `${f.file}:${f.line}` : f.file;
  console.log(`  ${colorSeverity(f.severity)} ${chalk.bold(f.category)} · ${grey(location)}${outcomeBadge(f.fixOutcome)}`);
  console.log(`    ${f.description}`);
  if (f.recommendation) {
    console.log(`    ${chalk.green("→ " + f.recommendation)}`);
  }
  console.log("");
}

const SEPARATOR = grey("─".repeat(45));

/**
 * Drop findings below the configured severity threshold. With threshold
 * "medium", LOW findings are suppressed to reduce noise while coding.
 */
export function filterBySeverity(
  findings: ReviewFinding[],
  threshold: WatchSeverity
): ReviewFinding[] {
  const min = rankOf(threshold);
  return findings.filter((f) => rankOf(f.severity) >= min);
}

/**
 * Print the one-time header shown when watch mode starts.
 */
export function printWatchHeader(providerLabel: string): void {
  console.log("");
  console.log(`  🐆 ${purple("Watching for changes")} · ${grey(providerLabel)}`);
  console.log(`  ${grey("Press Ctrl+C to stop")}`);
  console.log("");
}

/**
 * Print the "change detected · <file>" banner before a review runs.
 */
export function printChangeDetected(relativePath: string): void {
  console.log(`  ${SEPARATOR}`);
  console.log(`  ${chalk.bold("Change detected")} · ${chalk.cyan(relativePath)}`);
  console.log(`  ${grey("Reviewing…")}`);
  console.log("");
}

/**
 * Print the findings for one reviewed file (already severity-filtered). Prints a
 * green "no issues" line when the filtered list is empty.
 */
export function printFindings(relativePath: string, findings: ReviewFinding[]): void {
  if (findings.length === 0) {
    console.log(`  ${chalk.green("✓")} ${grey("No issues found")} · ${chalk.cyan(relativePath)}`);
    console.log("");
    return;
  }

  // Most severe first.
  const sorted = [...findings].sort((a, b) => rankOf(b.severity) - rankOf(a.severity));
  for (const f of sorted) {
    printFinding(f);
  }
}

/**
 * Print a full one-shot review report to the terminal.
 *
 * Used by `jaguar review` (and its `--fix` / `--consensus` variants) where
 * findings are shown directly in the terminal. Colours: severity badges are
 * red (critical/high), yellow (medium) or blue (low); recommendations are
 * green; file/line meta is grey.
 */
export function printReviewReport(
  findings: ReviewFinding[],
  summary: string,
  providerLabel: string,
  title = "Code Review"
): void {
  console.log("");
  console.log(`  ${purple(title)} · ${grey(providerLabel)}`);
  console.log("");

  if (summary) {
    for (const line of summary.split("\n")) {
      console.log(`  ${line}`);
    }
    console.log("");
  }

  if (findings.length === 0) {
    console.log(`  ${chalk.green("✓")} ${grey("No issues found. Code looks good!")}`);
    console.log("");
    return;
  }

  const sorted = [...findings].sort((a, b) => rankOf(b.severity) - rankOf(a.severity));
  for (const f of sorted) {
    console.log(`  ${SEPARATOR}`);
    printFinding(f);
  }
}

/**
 * Print the "waiting for the next change" footer after a review completes.
 */
export function printWaiting(): void {
  console.log(`  ${SEPARATOR}`);
  console.log(`  ${grey("Watching…")}`);
  console.log("");
}

/** Running totals for the session summary printed on Ctrl+C. */
export interface WatchSessionStats {
  filesReviewed: number;
  totalFindings: number;
  bySeverity: Record<string, number>;
}

/**
 * Print the session summary shown when the user stops watch mode (Ctrl+C).
 */
export function printSessionSummary(stats: WatchSessionStats): void {
  console.log("");
  console.log(`  ${SEPARATOR}`);
  console.log(`  ${purple("Watch session summary")}`);
  console.log(
    `  ${grey(
      `${stats.filesReviewed} file${stats.filesReviewed !== 1 ? "s" : ""} reviewed · ` +
        `${stats.totalFindings} finding${stats.totalFindings !== 1 ? "s" : ""}`
    )}`
  );

  const order: Array<[string, (s: string) => string]> = [
    ["critical", (s) => chalk.red.bold(s)],
    ["high", (s) => chalk.red(s)],
    ["medium", (s) => chalk.yellow(s)],
    ["low", (s) => chalk.gray(s)],
  ];
  const parts: string[] = [];
  for (const [sev, color] of order) {
    const n = stats.bySeverity[sev] ?? 0;
    if (n > 0) parts.push(color(`${n} ${sev}`));
  }
  if (parts.length > 0) {
    console.log(`  ${parts.join(grey(" · "))}`);
  }
  console.log("");
}