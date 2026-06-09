/**
 * Type definitions for CodeJaguar CLI providers.
 */

export interface ProviderTestResult {
  success: boolean;
  provider: string;
  model: string;
  latency_ms: number;
  error?: string;
}
