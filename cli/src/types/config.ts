/**
 * Type definitions for CodeJaguar config.
 */

export interface JaguarConfig {
  default_provider?: string;
  backend_port?: number;
}

export interface FileContent {
  path: string;
  content: string;
}
