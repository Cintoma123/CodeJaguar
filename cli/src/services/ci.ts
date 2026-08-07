/**
 * CI integration helpers for `jaguar review --ci` / `jaguar security --ci`.
 *
 * In a GitHub Actions runner there is no OS keychain and no interactive
 * terminal, so CI mode:
 *  - reads the provider key from the JAGUAR_API_KEY env var (never disk),
 *  - diffs the PR base vs head (via GITHUB_BASE_REF),
 *  - prints findings as GitHub Actions workflow-command annotations to stdout
 *    (GitHub renders these inline on the PR diff),
 *  - writes a machine-readable jaguar-results.json for downstream steps, and
 *  - controls the job's pass/fail through an exit code (`--fail-on`).
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** A finding shape common to both review and security findings. */
export interface CIFinding {
  severity: string;
  category: string;
  file: string;
  line?: string | number | null;
  description: string;
  recommendation: string;
}

/** True when running inside a CI environment (GitHub Actions in particular). */
export function isCI(): boolean {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

/**
 * The provider API key for CI runs, taken from JAGUAR_API_KEY. Returns null when
 * unset so callers can fail with a clear "set JAGUAR_API_KEY" message rather than
 * silently falling back to the (absent) keychain.
 */
export function getCIKey(): string | null {
  const key = process.env.JAGUAR_API_KEY;
  return key && key.length > 0 ? key : null;
}

/**
 * The PR's target branch (what the head is being merged into), from
 * GITHUB_BASE_REF. Only set on pull_request events; null otherwise.
 */
export function ciBaseRef(): string | null {
  const ref = process.env.GITHUB_BASE_REF;
  return ref && ref.length > 0 ? ref : null;
}

/** Severity → numeric rank. Higher is more severe. Unknown → LOW (0). */
const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function rankOf(severity: string): number {
  return SEVERITY_RANK[severity.toLowerCase()] ?? 0;
}

/** A `--fail-on` threshold: the minimum severity that makes the job fail. */
export type FailOn = "critical" | "high" | "medium" | "none";

/** Parse/validate a `--fail-on` value; returns null if invalid. */
export function parseFailOn(value: string): FailOn | null {
  const v = value.toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "none") {
    return v;
  }
  return null;
}

/**
 * Whether any finding meets or exceeds the fail-on threshold. `none` never
 * fails; otherwise a finding at rank ≥ rank(failOn) trips it.
 */
export function failThresholdMet(findings: CIFinding[], failOn: FailOn): boolean {
  if (failOn === "none") return false;
  const min = rankOf(failOn);
  return findings.some((f) => rankOf(f.severity) >= min);
}

/**
 * Extract the first integer from a line field ("42" or "102-103" → 42). Returns
 * null when there is no usable line number.
 */
function firstLine(line: string | number | null | undefined): number | null {
  if (line === null || line === undefined) return null;
  const match = String(line).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** GitHub workflow-command level for a severity. */
function annotationLevel(severity: string): "error" | "warning" | "notice" {
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    default:
      return "notice";
  }
}

/**
 * Escape a value for the message portion of a GitHub workflow command.
 * Newlines would prematurely end the annotation, so collapse them.
 */
function escapeMessage(text: string): string {
  return text.replace(/\r?\n/g, " ").trim();
}

/**
 * Print each finding as a GitHub Actions annotation on stdout. GitHub parses
 * these `::error`/`::warning`/`::notice` lines and renders them inline on the PR
 * diff at the referenced file/line.
 */
export function printAnnotations(findings: CIFinding[]): void {
  for (const f of findings) {
    const level = annotationLevel(f.severity);
    const file = f.file.replace(/\\/g, "/");
    const line = firstLine(f.line);
    const props = [`file=${file}`];
    if (line !== null) props.push(`line=${line}`);
    props.push(`title=Codejaguar ${f.severity.toUpperCase()}`);

    const rec = f.recommendation ? ` Recommendation: ${f.recommendation}` : "";
    const message = escapeMessage(`${f.description}${rec}`);
    console.log(`::${level} ${props.join(",")}::${message}`);
  }
}

/** Per-severity counts for the results file. */
function countBySeverity(findings: CIFinding[]): {
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const sev = f.severity.toLowerCase();
    if (sev === "critical") counts.critical += 1;
    else if (sev === "high") counts.high += 1;
    else if (sev === "medium") counts.medium += 1;
    else counts.low += 1;
  }
  return counts;
}

/**
 * Write jaguar-results.json to the project root for downstream CI steps (e.g. a
 * PR-comment poster). `kind` distinguishes a review run from a security run.
 */
export function writeResultsJson(
  cwd: string,
  kind: "review" | "security",
  findings: CIFinding[],
  meta: { provider: string; model: string; generatedAt: string }
): void {
  const payload = {
    tool: "codejaguar",
    kind,
    provider: meta.provider,
    model: meta.model,
    generated_at: meta.generatedAt,
    counts: countBySeverity(findings),
    findings: findings.map((f) => ({
      severity: f.severity.toUpperCase(),
      category: f.category,
      file: f.file.replace(/\\/g, "/"),
      line: firstLine(f.line),
      description: f.description,
      recommendation: f.recommendation,
    })),
  };
  writeFileSync(join(cwd, "jaguar-results.json"), JSON.stringify(payload, null, 2), "utf-8");
}
