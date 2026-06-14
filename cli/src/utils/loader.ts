/**
 * Jaguar loading spinner.
 *
 * A themed ora spinner shown whenever CodeJaguar is waiting for an AI provider
 * response. The jaguar emoji "runs" left-to-right to signal activity.
 */

import ora, { type Ora } from "ora";
import chalk from "chalk";

/**
 * Four animation frames: the jaguar shifts position to simulate running.
 */
export const JAGUAR_FRAMES: string[] = ["🐆    ", " 🐆   ", "  🐆  ", " 🐆   "];

/** Frame interval in milliseconds. */
export const JAGUAR_INTERVAL = 120;

const purple = chalk.hex("#a78bfa");
const grey = chalk.hex("#555250");

/**
 * Create an ora spinner that uses the running-jaguar frames.
 */
export function jaguarSpinner(text: string): Ora {
  return ora({
    text,
    spinner: { interval: JAGUAR_INTERVAL, frames: JAGUAR_FRAMES },
  });
}

/**
 * Format a scan status line: a purple command and a grey detail, separated by
 * a bullet — e.g. `jaguar review  ● analysing git diff · openai`.
 */
export function scanText(command: string, detail: string): string {
  return `${purple(command)}  ● ${grey(detail)}`;
}

/**
 * Start and return a jaguar spinner showing `{command}  ● {detail}`.
 */
export function startScan(command: string, detail: string): Ora {
  return jaguarSpinner(scanText(command, detail)).start();
}
