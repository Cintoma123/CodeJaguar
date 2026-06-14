/**
 * One-time first-run splash screen.
 *
 * Animates a jaguar ASCII drawing, then "types out" the brand name, tagline,
 * and three feature bullets character-by-character (typewriter motion), and
 * waits for the user to press Enter (continue) or S (skip). Pressing S at any
 * point fast-forwards the whole animation. Shown only once — the caller
 * persists a `splash_seen` flag and never invokes this again.
 */

import chalk from "chalk";
import * as readline from "node:readline";

// CodeJaguar brand green.
const GREEN = "#22c55e";

/**
 * Jaguar ASCII art, revealed one line at a time.
 */
export const JAGUAR_ART: string[] = [
  "             ,_         _,",
  "             |\\\\___..___//|",
  "             |           |",
  "            / ,.-'''-.,. \\",
  "           / /  _   _  \\ \\",
  "          | |  (o) (o)  | |",
  "          | |    ___    | |",
  "           \\ \\  \\___/  / /",
  "            \\ '-.___.-' /",
  "         _.-''  \\   /  ''-._",
  "       .'  \\\\    '-'    //  '.",
  "      /     \\\\___...___//     \\",
  "     |  CODE  '-.___.-'  JAGUAR |",
  "      \\__________________________/",
];

const BULLETS: string[] = [
  "› Reviews your git diff for bugs, smells, and performance issues",
  "› Scans for secrets, CVEs, Dockerfile flaws, and GitHub Actions risks",
  "› Runs entirely on your machine. No cloud. No accounts. No telemetry.",
];

const TAGLINE = "AI code review · local-first · your keys · your machine";
const BRAND = "CODEJAGUAR";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Left-pad amount needed to center `plain` in the terminal.
 */
function centerPad(plain: string): number {
  const width = process.stdout.columns || 80;
  return Math.max(0, Math.floor((width - plain.length) / 2));
}

/**
 * Play the splash animation and resolve once the user chooses to continue.
 */
export async function runSplash(): Promise<void> {
  const green = chalk.hex(GREEN);
  const stdin = process.stdin;
  const isTTY = Boolean(stdin.isTTY);

  let skip = false;
  let waitingForFinalKey = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const cleanup = (): void => {
    if (isTTY) {
      try {
        stdin.setRawMode(false);
      } catch {
        // not all TTYs support raw mode
      }
      stdin.pause();
    }
    stdin.removeListener("keypress", onKey);
  };

  const finish = (): void => {
    cleanup();
    resolveDone();
  };

  function onKey(_str: string, key: readline.Key | undefined): void {
    if (!key) return;
    if (key.ctrl && key.name === "c") {
      cleanup();
      process.exit(0);
    }
    if (key.name === "s") {
      skip = true; // fast-forward the remaining animation
      if (waitingForFinalKey) finish();
    } else if (key.name === "return" || key.name === "enter") {
      if (waitingForFinalKey) finish();
    }
  }

  if (isTTY) {
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", onKey);
  }

  // Delays collapse to zero once the user presses S (or in a non-TTY).
  const delay = (ms: number): Promise<void> =>
    skip || !isTTY ? Promise.resolve() : sleep(ms);

  /**
   * "Type" a line one character at a time, then newline. `color` wraps each
   * emitted chunk so colour survives the incremental writes. `indent` spaces
   * are written once up front (used for centering). When skipping, the whole
   * line is written at once.
   */
  const type = async (
    text: string,
    color: (s: string) => string,
    perChar: number,
    indent = 0
  ): Promise<void> => {
    if (indent > 0) process.stdout.write(" ".repeat(indent));
    if (skip || !isTTY) {
      process.stdout.write(color(text) + "\n");
      return;
    }
    for (const ch of text) {
      process.stdout.write(color(ch));
      await sleep(perChar);
    }
    process.stdout.write("\n");
  };

  // 1. Draw the jaguar, line by line.
  for (const line of JAGUAR_ART) {
    console.log(green(line));
    await delay(55);
  }

  // 2. Brand + tagline, typed out.
  console.log();
  await type(BRAND, chalk.bold.hex(GREEN), 45, centerPad(BRAND));
  await type(TAGLINE, chalk.gray, 12, centerPad(TAGLINE));
  console.log();

  // 3. Feature bullets, typed one at a time.
  for (const bullet of BULLETS) {
    await type(bullet, green, 9);
    await delay(450);
  }

  // 4. Prompt.
  await delay(600);
  console.log();
  console.log(
    chalk.gray("Press ") +
      chalk.bold("Enter") +
      chalk.gray(" to get started or ") +
      chalk.bold("S") +
      chalk.gray(" to skip")
  );

  // 5. Resolve immediately if non-interactive or already skipped, else wait.
  if (!isTTY || skip) {
    finish();
    return done;
  }
  waitingForFinalKey = true;
  return done;
}
