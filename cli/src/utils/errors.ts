/**
 * Typed error handling for the CLI.
 */

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
