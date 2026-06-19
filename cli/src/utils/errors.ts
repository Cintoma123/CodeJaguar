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
    const data = error.response?.data as
      | { error?: unknown; detail?: unknown; trace?: unknown }
      | undefined;

    // The backend's global exception handler returns { error, trace } on a 500
    // so the real Python cause is never blank. Prefer that; fall back to
    // FastAPI's { detail } (HTTPException / 422 validation errors).
    const backendError = typeof data?.error === "string" ? data.error : undefined;
    const detail = data?.detail;

    if (status && (backendError || detail)) {
      const reason =
        backendError ??
        (typeof detail === "string" ? detail : JSON.stringify(detail));
      let message = `Backend error (HTTP ${status}): ${reason}`;
      // Surface the full Python traceback only when explicitly debugging, so
      // `JAGUAR_DEBUG=1 jaguar review` shows the root cause inline.
      if (process.env.JAGUAR_DEBUG === "1" && typeof data?.trace === "string") {
        message += `\n\n${data.trace}`;
      }
      return message;
    }
    if (status) {
      return `Backend returned HTTP ${status}.`;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}
