/**
 * Fix application engine for `jaguar review --fix`.
 *
 * After a fix-mode review, each finding may carry a concrete code change
 * (original_code → fixed_code). This module walks the user through those changes
 * one at a time: it shows a red/green diff, asks whether to apply, and on "yes"
 * locates the original lines in the file and rewrites them — after backing the
 * original file up to ~/.jaguar/backups/{timestamp}/.
 *
 * Safety is the whole point here, so the matcher is deliberately strict:
 *  - the file must not have changed since the review started (mtime check),
 *  - original_code must be found *exactly* (after line-ending normalization),
 *  - a match that is ambiguous (appears more than once, with no line hint that
 *    disambiguates) is skipped rather than guessed.
 * A fix that fails any check is skipped with a warning — never applied partially.
 */

import chalk from "chalk";
import * as readline from "node:readline";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { homedir } from "node:os";

import type { ReviewFinding } from "../types/review.js";

const BACKUP_ROOT = join(homedir(), ".jaguar", "backups");

/** Result of applying (or attempting to apply) one fix. */
type FixOutcome = "applied" | "skipped" | "failed";

export interface FixSummary {
  applied: number;
  skipped: number;
  failed: number;
  /** Backup directory for this session, or null if nothing was backed up. */
  backupDir: string | null;
}

/**
 * Detect the dominant line ending in a text blob. We preserve whatever the file
 * already uses when writing back, so a fix never silently converts CRLF↔LF.
 */
function detectEol(text: string): "\r\n" | "\n" {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(?<!\r)\n/g) || []).length;
  return crlf > lf ? "\r\n" : "\n";
}

/** Normalize all line endings to LF for content matching. */
function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Find the character offset of `needle` within `haystack`, both LF-normalized.
 *
 * Strategy, in order of preference:
 *  1. If a line hint is given and the needle occurs at exactly that region,
 *     prefer it (handles files where the snippet legitimately repeats).
 *  2. If the needle occurs exactly once anywhere, use that.
 *  3. Otherwise (zero matches, or multiple with no usable hint) return -1 so the
 *     caller skips rather than corrupting the file.
 *
 * `lineHint` is 1-based (matching editor/finding line numbers); undefined when
 * the finding has no line.
 */
function locateMatch(
  haystack: string,
  needle: string,
  lineHint: number | undefined
): number {
  if (!needle) return -1;

  // Collect all occurrences.
  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    offsets.push(idx);
    from = idx + 1;
  }

  if (offsets.length === 0) return -1;
  if (offsets.length === 1) return offsets[0] as number;

  // Multiple matches: disambiguate with the line hint if we have one. Pick the
  // occurrence whose starting line is closest to the hint.
  if (lineHint !== undefined) {
    let best = -1;
    let bestDist = Infinity;
    for (const off of offsets) {
      const startLine = haystack.slice(0, off).split("\n").length; // 1-based
      const dist = Math.abs(startLine - lineHint);
      if (dist < bestDist) {
        bestDist = dist;
        best = off;
      }
    }
    return best;
  }

  // Ambiguous and no hint — refuse.
  return -1;
}

/** Parse the leading integer from a finding's line field ("34" or "34-36"). */
function lineNumberOf(finding: ReviewFinding): number | undefined {
  if (!finding.line) return undefined;
  const m = /^(\d+)/.exec(finding.line);
  return m ? parseInt(m[1] as string, 10) : undefined;
}

/**
 * Render a red/green diff of original vs fixed code (each line prefixed).
 */
function renderDiff(original: string, fixed: string): string {
  const out: string[] = [];
  for (const line of toLf(original).split("\n")) {
    out.push(chalk.red(`  - ${line}`));
  }
  for (const line of toLf(fixed).split("\n")) {
    out.push(chalk.green(`  + ${line}`));
  }
  return out.join("\n");
}

const SEPARATOR = chalk.gray("─".repeat(45));

/** Ask a single-key question; returns the lowercased first char of the answer. */
function askAction(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().charAt(0));
    });
  });
}

/**
 * Colour a severity label consistently with the rest of the CLI.
 */
function severityLabel(severity: string): string {
  const label = `[${severity.toUpperCase()}]`;
  switch (severity.toLowerCase()) {
    case "critical":
      return chalk.bgRed.white.bold(label);
    case "high":
      return chalk.red.bold(label);
    case "medium":
      return chalk.yellow.bold(label);
    default:
      return chalk.gray.bold(label);
  }
}

/** Absolute path for a finding's file, resolved against cwd. */
function resolvePath(cwd: string, file: string): string {
  return isAbsolute(file) ? file : join(cwd, file);
}

/**
 * Back up a file into this session's backup dir, preserving its relative path so
 * `fix --undo` can restore it to the same place. Returns the backup file path.
 */
function backupFile(cwd: string, file: string, backupDir: string): void {
  const src = resolvePath(cwd, file);
  // Store under the file's project-relative path (fall back to a flattened name
  // for absolute/outside-cwd paths).
  const relForBackup = isAbsolute(file) ? file.replace(/^[/\\]|:/g, "_") : file;
  const dest = join(backupDir, relForBackup);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

/**
 * Apply the confirmed fix to disk. Assumes the file was already backed up.
 * Returns true on success, false if the match disappeared (shouldn't happen —
 * the caller matched moments earlier — but we re-check to be safe).
 */
function applyFix(
  absPath: string,
  original: string,
  fixed: string,
  lineHint: number | undefined
): boolean {
  const raw = readFileSync(absPath, "utf-8");
  const eol = detectEol(raw);
  const lfContent = toLf(raw);
  const lfNeedle = toLf(original);

  const at = locateMatch(lfContent, lfNeedle, lineHint);
  if (at === -1) return false;

  const replaced =
    lfContent.slice(0, at) + toLf(fixed) + lfContent.slice(at + lfNeedle.length);

  // Restore the file's original EOL convention before writing.
  const finalContent = eol === "\r\n" ? replaced.replace(/\n/g, "\r\n") : replaced;
  writeFileSync(absPath, finalContent, "utf-8");
  return true;
}

/**
 * Walk the user through every finding that has a fix, prompting y/n/s/q.
 *
 * @param findings  All findings from the review (those without a `fix` are shown
 *                  as informational and skipped for application).
 * @param cwd       Project root, used to resolve relative file paths.
 * @param reviewStartMs  Epoch ms when the review began; a file modified after
 *                  this is considered stale and its fix is skipped.
 * @param timestamp Backup folder name (also the token for `fix --undo`).
 */
export async function runFixSession(
  findings: ReviewFinding[],
  cwd: string,
  reviewStartMs: number,
  timestamp: string
): Promise<FixSummary> {
  const summary: FixSummary = { applied: 0, skipped: 0, failed: 0, backupDir: null };
  const backupDir = join(BACKUP_ROOT, timestamp);

  const fixable = findings.filter((f) => f.fix && f.fix.original_code);
  if (fixable.length === 0) {
    console.log(chalk.yellow("\nNo applyable fixes were proposed for these findings.\n"));
    return summary;
  }

  let skipAll = false;

  for (const finding of fixable) {
    const fix = finding.fix!;
    const lineHint = lineNumberOf(finding);
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;

    console.log(`\n  ${SEPARATOR}`);
    console.log(`  ${severityLabel(finding.severity)} ${chalk.bold(finding.category)} · ${chalk.cyan(location)}`);
    console.log(`  ${finding.description}`);
    console.log(`\n  ${chalk.bold("Proposed fix:")}\n`);
    console.log(renderDiff(fix.original_code, fix.fixed_code));
    if (fix.explanation) {
      console.log(`\n  ${chalk.gray(fix.explanation)}`);
    }

    if (skipAll) {
      summary.skipped++;
      finding.fixOutcome = "skipped";
      continue;
    }

    const absPath = resolvePath(cwd, finding.file);

    // Pre-flight checks before we even prompt — no point asking if we can't apply.
    if (!existsSync(absPath)) {
      console.log(chalk.yellow(`\n  ⚠ Skipped · file not found: ${finding.file}`));
      summary.skipped++;
      finding.fixOutcome = "skipped";
      continue;
    }

    // Staleness: if the file changed after the review started, line numbers and
    // content may have shifted — refuse rather than risk a wrong edit.
    const mtimeMs = statSync(absPath).mtimeMs;
    if (mtimeMs > reviewStartMs) {
      console.log(
        chalk.yellow(
          `\n  ⚠ Skipped · ${finding.file} was modified after the review started; ` +
            `re-run \`jaguar review --fix\`.`
        )
      );
      summary.skipped++;
      finding.fixOutcome = "skipped";
      continue;
    }

    // Verify original_code is present & unambiguous before prompting.
    const raw = readFileSync(absPath, "utf-8");
    const matchAt = locateMatch(toLf(raw), toLf(fix.original_code), lineHint);
    if (matchAt === -1) {
      console.log(
        chalk.yellow(
          `\n  ⚠ Skipped · could not locate the original code exactly in ${finding.file} ` +
            `(it may have been reformatted). Not modifying the file.`
        )
      );
      summary.skipped++;
      finding.fixOutcome = "skipped";
      continue;
    }

    const answer = await askAction(
      `\n  ${chalk.bold("Apply this fix?")} (y)es · (n)o · (s)kip all · (q)uit\n  > `
    );

    if (answer === "q") {
      console.log(chalk.gray("\n  Quit — no further fixes applied."));
      break;
    }
    if (answer === "s") {
      skipAll = true;
      summary.skipped++;
      finding.fixOutcome = "skipped";
      continue;
    }
    if (answer !== "y") {
      summary.skipped++;
      finding.fixOutcome = "skipped";
      continue;
    }

    // Apply: back up first, then rewrite.
    try {
      backupFile(cwd, finding.file, backupDir);
      summary.backupDir = backupDir;
      const ok = applyFix(absPath, fix.original_code, fix.fixed_code, lineHint);
      if (ok) {
        console.log(`\n  ${chalk.green("✓")} Fix applied · ${chalk.cyan(location)}`);
        summary.applied++;
        finding.fixOutcome = "fixed";
      } else {
        console.log(chalk.yellow(`\n  ⚠ Skipped · original code vanished before apply.`));
        summary.failed++;
        finding.fixOutcome = "failed";
      }
    } catch (err) {
      console.log(chalk.red(`\n  ✗ Failed to apply fix for ${finding.file}: ${String(err)}`));
      summary.failed++;
      finding.fixOutcome = "failed";
    }
  }

  return summary;
}

/** Marker used by the outcome type; exported for tests. */
export type { FixOutcome };