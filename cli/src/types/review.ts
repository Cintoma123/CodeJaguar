/**
 * Type definitions for review results.
 */

export interface ReviewFinding {
  severity: string;
  category: string;
  file: string;
  line?: number;
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
