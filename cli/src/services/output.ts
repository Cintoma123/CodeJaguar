/**
 * Terminal output rendering service.
 *
 * Formats and displays results with colored output,
 * structured finding cards, and styled boxes.
 */

import chalk from "chalk";
import boxen from "boxen";
import table from "text-table";
import type { ReviewFinding } from "../types/review.js";
import type { SecurityFinding, SecurityStats } from "../types/security.js";

/**
 * Get the chalk color for a severity level.
 */
function severityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return chalk.hex("#FF0000").bold;
    case "HIGH":
      return chalk.hex("#FF8C00").bold;
    case "MEDIUM":
      return chalk.hex("#FFD700").bold;
    case "LOW":
      return chalk.hex("#4169E1").bold;
    default:
      return chalk.white;
  }
}

/**
 * Render the header box for a result set.
 */
function renderHeader(title: string, subtitle: string): string {
  return boxen(
    chalk.bold.white(title) + "\n" + chalk.gray(subtitle),
    {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "cyan",
    }
  );
}

/**
 * Render a single review finding card.
 */
function renderReviewFinding(finding: ReviewFinding, index: number): string {
  const color = severityColor(finding.severity);
  const location = finding.line
    ? `${finding.file}:${finding.line}`
    : finding.file;

  const lines = [
    color(`[${finding.severity}]`) +
      " " +
      chalk.bold(finding.category) +
      " — " +
      chalk.cyan(location),
    "",
    "  " + chalk.white(finding.description),
    "  " + chalk.gray("Impact: ") + finding.impact,
    "  " + chalk.gray("Fix: ") + chalk.green(finding.recommendation),
  ];

  return lines.join("\n");
}

/**
 * Render review results to the terminal.
 */
export function renderReviewResults(
  findings: ReviewFinding[],
  summary: string,
  providerUsed: string,
  modelUsed: string
): void {
  const header = renderHeader(
    "🔍 Code Review Results",
    `${findings.length} issue${findings.length !== 1 ? "s" : ""} found · ${providerUsed}/${modelUsed}`
  );

  console.log(header);

  if (findings.length === 0) {
    console.log(chalk.green("✅ No issues found. Code looks good!"));
    if (summary) {
      console.log("\n" + chalk.gray("Summary: ") + summary);
    }
    return;
  }

  // Sort by severity (CRITICAL > HIGH > MEDIUM > LOW)
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...findings].sort((a, b) => {
    const aVal = severityOrder[a.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    const bVal = severityOrder[b.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    return aVal - bVal;
  });

  for (const [i, finding] of sorted.entries()) {
    console.log(renderReviewFinding(finding, i));
    console.log("");
  }

  if (summary) {
    console.log(chalk.bold("Summary: ") + summary);
  }
}

/**
 * Render a security finding card.
 */
function renderSecurityFinding(finding: SecurityFinding): string {
  const color = severityColor(finding.severity);
  const location = finding.line
    ? `${finding.file}:${finding.line}`
    : finding.file;

  const lines = [
    color(`[${finding.severity}]`) +
      " " +
      chalk.bold(finding.category) +
      " — " +
      chalk.cyan(location),
    "",
    "  " + chalk.white(finding.description),
    "  " + chalk.gray("Impact: ") + finding.impact,
    "  " + chalk.gray("Fix: ") + chalk.green(finding.recommendation),
  ];

  if (finding.module) {
    lines.splice(2, 0, "  " + chalk.gray("Module: ") + finding.module);
  }

  return lines.join("\n");
}

/**
 * Render security scan results to the terminal.
 */
export function renderSecurityResults(
  findings: SecurityFinding[],
  stats: SecurityStats,
  providerUsed: string
): void {
  const header = renderHeader(
    "🛡️ Security Scan Results",
    `${stats.critical} critical, ${stats.high} high, ${stats.medium} medium, ${stats.low} low · ${providerUsed}`
  );

  console.log(header);

  if (findings.length === 0) {
    console.log(chalk.green("✅ No security issues found."));
    return;
  }

  // Sort by severity
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...findings].sort((a, b) => {
    const aVal = severityOrder[a.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    const bVal = severityOrder[b.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
    return aVal - bVal;
  });

  for (const finding of sorted) {
    console.log(renderSecurityFinding(finding));
    console.log("");
  }
}
