/**
 * Report builders and terminal renderers.
 *
 * Two kinds of output live here:
 *  - Markdown/JSON builders that turn backend results into documents
 *    (review.md, review.json, security-*.md, architecture.md, …). These are
 *    written to disk only when the user opts in with `--output`.
 *  - Terminal renderers (renderReviewFindings, renderConsensusFindings) that
 *    print coloured findings straight to the terminal — the default surface for
 *    an interactive `jaguar review`.
 */

import chalk from "chalk";

import type { ReviewFinding, FixOutcome } from "../types/review.js";
import type { SecurityFinding, SecurityStats } from "../types/security.js";
import type { ConsensusFinding } from "./consensus.js";

/** Severity → sort rank, shared by every builder/renderer. Lower = more severe. */
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Sort findings most-severe first (CRITICAL → HIGH → MEDIUM → LOW; unknown last). */
function sortBySeverity<T extends { severity: string }>(findings: T[]): T[] {
  return [...findings].sort((a, b) => {
    const aVal = SEVERITY_ORDER[a.severity.toUpperCase()] ?? 4;
    const bVal = SEVERITY_ORDER[b.severity.toUpperCase()] ?? 4;
    return aVal - bVal;
  });
}

// ── Terminal rendering ──────────────────────────────────
// The grey used for metadata, matching the watch-mode / loader palette.
const grey = chalk.hex("#555250");

/**
 * Colour a `[SEVERITY]` label for terminal output.
 *
 * Distinct from watch mode's `colorSeverity` (watch greys LOW and uses a red
 * background for CRITICAL). Here the scheme is: RED for CRITICAL/HIGH, YELLOW
 * for MEDIUM, BLUE for LOW.
 */
function colorSeverityStd(severity: string): string {
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

/**
 * Render review findings straight to the terminal (the default output surface).
 *
 * Colour scheme: RED for CRITICAL/HIGH, YELLOW for MEDIUM, BLUE for LOW,
 * GREEN for the recommendation line, GREY for the file/line meta.
 */
export function renderReviewFindings(
  findings: ReviewFinding[],
  meta: { providerUsed: string; modelUsed: string }
): void {
  const model = meta.modelUsed ? `${meta.providerUsed}/${meta.modelUsed}` : meta.providerUsed;
  const count = findings.length;

  console.log("");
  console.log(
    `  🐆 ${chalk.bold("Code review")} · ${grey(model)} · ` +
      grey(`${count} issue${count !== 1 ? "s" : ""}`)
  );
  console.log("");

  if (count === 0) {
    console.log(`  ${chalk.green("✓")} ${chalk.green("No issues found. Code looks good!")}`);
    console.log("");
    return;
  }

  for (const f of sortBySeverity(findings)) {
    const location = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`  ${colorSeverityStd(f.severity)} ${chalk.bold(f.category)} · ${grey(location)}`);
    console.log(`    ${f.description}`);
    if (f.recommendation) {
      console.log(`    ${chalk.green("→")} ${chalk.green(f.recommendation)}`);
    }
    console.log("");
  }
}

/**
 * Render consensus findings to the terminal, with the "agreed by" providers
 * shown as a grey sub-line. Same colour scheme as renderReviewFindings.
 */
export function renderConsensusFindings(
  findings: ConsensusFinding[],
  providers: string[],
  minAgree: number
): void {
  console.log("");
  console.log(
    `  🐆 ${chalk.bold("Consensus review")} · ${grey(providers.join(", "))} · ` +
      grey(`${findings.length} agreed (≥${minAgree} of ${providers.length})`)
  );
  console.log("");

  if (findings.length === 0) {
    console.log(
      `  ${chalk.green("✓")} ` +
        grey(`No findings agreed on by at least ${minAgree} of ${providers.length} providers.`)
    );
    console.log("");
    return;
  }

  for (const f of sortBySeverity(findings)) {
    const location = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`  ${colorSeverityStd(f.severity)} ${chalk.bold(f.category)} · ${grey(location)}`);
    console.log(`    ${grey(`Agreed by ${f.agreedBy.join(", ")} (${f.agreedBy.length}/${providers.length})`)}`);
    console.log(`    ${f.description}`);
    if (f.recommendation) {
      console.log(`    ${chalk.green("→")} ${chalk.green(f.recommendation)}`);
    }
    console.log("");
  }
}

/** Heading-suffix badge for a finding's fix outcome (empty for normal reviews). */
function outcomeBadge(outcome: FixOutcome | undefined): string {
  switch (outcome) {
    case "fixed":
      return "  ✓ Fixed";
    case "skipped":
      return "  — Skipped";
    case "failed":
      return "  ✗ Failed";
    default:
      return "";
  }
}

/**
 * Build a Markdown report for a review (for saving to review.md).
 *
 * When findings carry a `fixOutcome` (set after a `--fix` session), each heading
 * gets an outcome badge and a fix-summary line is added under the header.
 */
export function buildReviewMarkdown(
  findings: ReviewFinding[],
  summary: string,
  providerUsed: string,
  modelUsed: string,
  generatedAt: string
): string {
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...findings].sort((a, b) => {
    const aVal = severityOrder[a.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    const bVal = severityOrder[b.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    return aVal - bVal;
  });

  const model = modelUsed ? `${providerUsed}/${modelUsed}` : providerUsed;
  const lines: string[] = [
    "# Code Review",
    "",
    `> Generated by CodeJaguar · ${model} · ${findings.length} issue${findings.length !== 1 ? "s" : ""} found · ${generatedAt}`,
    "",
  ];

  // If a fix session ran, summarise what was applied/skipped/failed up top.
  const outcomes = findings.filter((f) => f.fixOutcome);
  if (outcomes.length > 0) {
    const n = (o: FixOutcome): number => outcomes.filter((f) => f.fixOutcome === o).length;
    const parts = [`${n("fixed")} fixed`];
    if (n("skipped")) parts.push(`${n("skipped")} skipped`);
    if (n("failed")) parts.push(`${n("failed")} failed`);
    lines.push(`> **Fix session:** ${parts.join(" · ")}`, "");
  }

  if (summary) {
    lines.push("## Summary", "", summary, "");
  }

  if (sorted.length === 0) {
    lines.push("✅ No issues found. Code looks good!", "");
    return lines.join("\n");
  }

  lines.push("## Findings", "");
  for (const finding of sorted) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(
      `### [${finding.severity.toUpperCase()}] ${finding.category} — \`${location}\`${outcomeBadge(finding.fixOutcome)}`,
      "",
      `**Description:** ${finding.description}`,
      "",
      `**Impact:** ${finding.impact}`,
      "",
      `**Recommendation:** ${finding.recommendation}`,
      ""
    );
  }

  return lines.join("\n");
}

/**
 * Build a JSON report for a review (for saving to review.json).
 */
export function buildReviewJson(
  findings: ReviewFinding[],
  summary: string,
  providerUsed: string,
  modelUsed: string,
  generatedAt: string
): string {
  return JSON.stringify(
    {
      generated_at: generatedAt,
      provider_used: providerUsed,
      model_used: modelUsed,
      summary,
      findings: findings.map((f) => ({
        severity: f.severity.toUpperCase(),
        category: f.category,
        file: f.file,
        line: f.line ?? null,
        description: f.description,
        impact: f.impact,
        recommendation: f.recommendation,
        ...(f.fixOutcome ? { fix_outcome: f.fixOutcome } : {}),
      })),
    },
    null,
    2
  );
}

/**
 * Build a Markdown report for a security scan (for saving to disk).
 */
export function buildSecurityMarkdown(
  findings: SecurityFinding[],
  stats: SecurityStats,
  providerUsed: string,
  modelUsed: string,
  scanLabel: string,
  generatedAt: string
): string {
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...findings].sort((a, b) => {
    const aVal = severityOrder[a.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    const bVal = severityOrder[b.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    return aVal - bVal;
  });

  const model = modelUsed ? `${providerUsed}/${modelUsed}` : providerUsed;
  const lines: string[] = [
    `# Security Scan — ${scanLabel}`,
    "",
    `> Generated by CodeJaguar · ${model} · ${generatedAt}`,
    "",
    `**Summary:** ${stats.critical} critical · ${stats.high} high · ${stats.medium} medium · ${stats.low} low`,
    "",
  ];

  if (sorted.length === 0) {
    lines.push("✅ No security issues found.", "");
    return lines.join("\n");
  }

  lines.push("## Findings", "");
  for (const finding of sorted) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(`### [${finding.severity.toUpperCase()}] ${finding.category} — \`${location}\``, "");
    if (finding.module) {
      lines.push(`**Module:** ${finding.module}`, "");
    }
    lines.push(
      `**Description:** ${finding.description}`,
      "",
      `**Impact:** ${finding.impact}`,
      "",
      `**Recommendation:** ${finding.recommendation}`,
      ""
    );
  }

  return lines.join("\n");
}

/** A single architecture finding (mirrors the backend ArchitectureFinding). */
export interface ArchitectureFinding {
  severity: string;
  category: string;
  file?: string;
  description: string;
  recommendation: string;
}

/**
 * Build a Markdown report for an architecture review (for saving to disk).
 */
export function buildArchitectureMarkdown(
  findings: ArchitectureFinding[],
  improvements: string[],
  recommendations: string,
  providerUsed: string,
  modelUsed: string,
  generatedAt: string
): string {
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...findings].sort((a, b) => {
    const aVal = severityOrder[a.severity.toUpperCase() as keyof typeof severityOrder] ?? 3;
    const bVal = severityOrder[b.severity.toUpperCase() as keyof typeof severityOrder] ?? 3;
    return aVal - bVal;
  });

  const model = modelUsed ? `${providerUsed}/${modelUsed}` : providerUsed;
  const lines: string[] = [
    "# Architecture Review",
    "",
    `> Generated by CodeJaguar · ${model} · ${findings.length} finding${findings.length !== 1 ? "s" : ""} · ${generatedAt}`,
    "",
  ];

  if (sorted.length > 0) {
    lines.push("## Findings", "");
    for (const finding of sorted) {
      const where = finding.file ? ` — \`${finding.file}\`` : "";
      lines.push(
        `### [${finding.severity.toUpperCase()}] ${finding.category}${where}`,
        "",
        `**Description:** ${finding.description}`,
        "",
        `**Recommendation:** ${finding.recommendation}`,
        ""
      );
    }
  } else {
    lines.push("✅ No architectural issues found.", "");
  }

  if (improvements.length > 0) {
    lines.push("## Improvements", "");
    for (const imp of improvements) {
      lines.push(`- ${imp}`);
    }
    lines.push("");
  }

  if (recommendations) {
    lines.push("## Recommendations", "", recommendations, "");
  }

  return lines.join("\n");
}

/**
 * Build a Markdown document for a PR summary (for saving to disk).
 *
 * The backend already returns GitHub-ready Markdown; this just prepends a
 * provenance header comment.
 */
export function buildSummaryMarkdown(
  markdown: string,
  providerUsed: string,
  modelUsed: string,
  generatedAt: string
): string {
  const model = modelUsed ? `${providerUsed}/${modelUsed}` : providerUsed;
  return (
    `<!-- Generated by CodeJaguar · ${model} · ${generatedAt} -->\n\n` +
    markdown.trim() +
    "\n"
  );
}

/**
 * Build a Markdown report for a consensus review (for saving to disk).
 *
 * Shows only findings agreed on by multiple providers, annotated with which
 * models agreed on each.
 */
export function buildConsensusMarkdown(
  findings: ConsensusFinding[],
  providers: string[],
  minAgree: number,
  generatedAt: string
): string {
  const lines: string[] = [
    "# Code Review — Consensus",
    "",
    `> Generated by CodeJaguar · ${providers.join(", ")} · ` +
      `${findings.length} agreed finding${findings.length !== 1 ? "s" : ""} ` +
      `(≥${minAgree} of ${providers.length} models) · ${generatedAt}`,
    "",
  ];

  if (findings.length === 0) {
    lines.push(
      `✅ No findings were agreed on by at least ${minAgree} of the ${providers.length} providers.`,
      ""
    );
    return lines.join("\n");
  }

  lines.push("## Agreed Findings", "");
  for (const finding of findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(
      `### [${finding.severity.toUpperCase()}] ${finding.category} — \`${location}\``,
      "",
      `**Agreed by:** ${finding.agreedBy.join(", ")} (${finding.agreedBy.length}/${providers.length})`,
      "",
      `**Description:** ${finding.description}`,
      "",
      `**Impact:** ${finding.impact}`,
      "",
      `**Recommendation:** ${finding.recommendation}`,
      ""
    );
  }

  return lines.join("\n");
}

/**
 * Build a JSON report for a consensus review (for saving to review-consensus.json).
 */
export function buildConsensusJson(
  findings: ConsensusFinding[],
  providers: string[],
  minAgree: number,
  generatedAt: string
): string {
  return JSON.stringify(
    {
      generated_at: generatedAt,
      providers,
      min_agree: minAgree,
      agreed_findings: findings.map((f) => ({
        severity: f.severity.toUpperCase(),
        category: f.category,
        file: f.file,
        line: f.line ?? null,
        description: f.description,
        impact: f.impact,
        recommendation: f.recommendation,
        agreed_by: f.agreedBy,
      })),
    },
    null,
    2
  );
}
