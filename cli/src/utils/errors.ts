/**
 * Typed error handling for the CLI.
 */

import { isAxiosError } from "axios";

export class JaguarError extends Error {
  constructor(
    message: string,
    public readonly code: string = "UNKNOWN"
  ) {
    super(message);
    this.name = "JaguarError";
  }
}

export class ProviderError extends JaguarError {
  constructor(message: string, provider: string) {
    super(message, "PROVIDER_ERROR");
    this.name = "ProviderError";
    this.message = `[${provider}] ${message}`;
  }
}

export class BackendError extends JaguarError {
  constructor(message: string) {
    super(message, "BACKEND_ERROR");
    this.name = "BackendError";
  }
}

/**
 * Turn any error thrown while calling the local backend into a concise,
 * actionable message. Handles the common network failure modes (backend not
 * reachable, timeout) and surfaces a FastAPI error detail when present.
 */
export function describeRequestError(error: unknown): string {
  if (isAxiosError(error)) {
    // The request was made but no response was received.
    if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET") {
      return "Could not reach the local backend. It may have crashed — try again.";
    }
    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      return "The request timed out. The input may be too large, or the AI provider is slow to respond.";
    }

    const status = error.response?.status;
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (status && detail) {
      return `Backend error (HTTP ${status}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    }
    if (status) {
      return `Backend returned HTTP ${status}.`;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}
