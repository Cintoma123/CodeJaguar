/**
 * Type definitions for security scan results.
 */

export interface SecurityFinding {
  severity: string;
  category: string;
  module: string;
  file: string;
  line?: number;
  description: string;
  impact: string;
  recommendation: string;
}

export interface SecurityStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SecurityResult {
  findings: SecurityFinding[];
  stats: SecurityStats;
  provider_used: string;
}
