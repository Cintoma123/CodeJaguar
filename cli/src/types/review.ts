/**
 * Type definitions for review results.
 */

export interface ReviewFinding {
  severity: string;
  category: string;
  file: string;
  line?: string; // Line number or range (e.g. "42" or "102-103")
  description: string;
  impact: string;
  recommendation: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  provider_used: string;
  model_used: string;
}
