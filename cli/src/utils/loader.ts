/**
 * Jaguar loading spinner.
 *
 * A themed ora spinner shown whenever CodeJaguar is waiting for an AI provider
 * response. The jaguar emoji "runs" left-to-right to signal activity.
 */

import ora, { type Ora } from "ora";
import chalk from "chalk";

const purple = chalk.hex("#a78bfa");
const grey = chalk.hex("#555250");
const trailDim = chalk.hex("#3a3550");

/** Width of the run track (character cells the jaguar sprints across). */
const TRACK_WIDTH = 8;

/** Trailing "speed dashes" that fade out behind the running jaguar. */
const TRAIL = ["»", "›", "·"];

/**
 * Build the running-jaguar frames procedurally so the track stays a fixed width
 * and the motion-trail lines up under the jaguar at every position.
 *
 * Each frame is a `TRACK_WIDTH`-cell lane: the jaguar sits at one cell and a
 * short trail of fading dashes streams out behind it. The jaguar runs from left
 * to right, then the loop restarts — a continuous sprint rather than a bounce.
 */
function buildJaguarFrames(): string[] {
  const frames: string[] = [];
  for (let pos = 0; pos < TRACK_WIDTH; pos++) {
    const cells: string[] = new Array(TRACK_WIDTH).fill(" ");
    // Lay down the fading trail behind the jaguar (immediately to its left).
    for (let t = 0; t < TRAIL.length; t++) {
      const cell = pos - 1 - t;
      if (cell >= 0) {
        const shade = t === 0 ? grey : trailDim;
        cells[cell] = shade(TRAIL[t] as string);
      }
    }
    cells[pos] = "🐆";
    frames.push(cells.join(""));
  }
  return frames;
}

/**
 * Animation frames: the jaguar sprints across the track leaving a speed-trail,
 * then loops. Kept as an exported constant for anything that inspects frames.
 */
export const JAGUAR_FRAMES: string[] = buildJaguarFrames();

/** Frame interval in milliseconds — brisk enough to read as a run. */
export const JAGUAR_INTERVAL = 90;

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
