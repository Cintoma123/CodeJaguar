/**
 * Logger utility for internal debug logging.
 *
 * Writes to stderr so it doesn't interfere with stdout output.
 * Only logs when JAGUAR_DEBUG env var is set.
 */

export function debugLog(message: string, ...args: unknown[]): void {
  if (process.env["JAGUAR_DEBUG"] === "1") {
    process.stderr.write(`[jaguar:debug] ${message}\n`);
    for (const arg of args) {
      process.stderr.write(`  ${JSON.stringify(arg)}\n`);
    }
  }
}
