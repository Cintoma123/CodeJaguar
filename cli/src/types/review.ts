/**
 * Type definitions for review results.
 */

/**
 * A concrete, apply-able code change proposed for a finding.
 * Present only when the review was run in fix mode (`--fix`).
 */
export interface Fix {
  original_code: string; // exact lines to replace, as they appear in the file
  fixed_code: string; // replacement lines
  explanation: string; // one sentence on why the fix is correct
}

/** What happened to a finding's fix during a `--fix` session. */
export type FixOutcome = "fixed" | "skipped" | "failed";

export interface ReviewFinding {
  severity: string;
  category: string;
  file: string;
  line?: string; // Line number or range (e.g. "42" or "102-103")
  description: string;
  impact: string;
  recommendation: string;
  fix?: Fix; // populated only in fix mode
  /**
   * Set by the fix session (`--fix`) after the user decides on this finding, so
   * review.md can be re-rendered with the outcome. Absent for normal reviews.
   */
  fixOutcome?: FixOutcome;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  provider_used: string;
  model_used: string;
}
