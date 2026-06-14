/**
 * CodeJaguar CLI — Entry point.
 *
 * Local-first AI Code Review and DevSecOps CLI.
 * Runs entirely on the user's machine.
 *
 * Usage:
 *   jaguar review
 *   jaguar security
 *   jaguar architecture
 *   jaguar summary
 *   jaguar key <subcommand>
 *   jaguar protect
 *   jaguar memory <subcommand>
 *   jaguar rules <subcommand>
 */

import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";

import { registerKeyCommand } from "./commands/auth.js";
import { registerReviewCommand } from "./commands/review.js";
import { registerSecurityCommand } from "./commands/security.js";
import { registerArchitectureCommand } from "./commands/architecture.js";
import { registerSummaryCommand } from "./commands/summary.js";
import { registerMemoryCommand } from "./commands/memory.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerProtectCommand } from "./commands/protect.js";
import { runSplash } from "./utils/splash.js";

// Create the main program
const program = new Command();

program
  .name("jaguar")
  .description("CodeJaguar — Local-first AI Code Review & DevSecOps CLI")
  .version("0.1.0");

// Register commands
registerKeyCommand(program);
registerReviewCommand(program);
registerSecurityCommand(program);
registerArchitectureCommand(program);
registerSummaryCommand(program);
registerMemoryCommand(program);
registerRulesCommand(program);
registerProtectCommand(program);

/**
 * Print the figlet banner shown for a bare `jaguar` invocation.
 */
function printBanner(): void {
  console.log(
    chalk.cyan(
      figlet.textSync("CodeJaguar", {
        font: "Standard",
        horizontalLayout: "default",
      })
    )
  );
  console.log(chalk.gray(" AI Code Review & DevSecOps CLI\n"));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isHelpFlag = (a: string | undefined): boolean =>
    a === "--help" || a === "-h" || a === "help";

  // First-run splash: only for bare `jaguar` or `jaguar --help`.
  const isBareOrHelp = args.length === 0 || (args.length === 1 && isHelpFlag(args[0]));

  // Splash plays on every bare `jaguar` / `jaguar --help`, but only in a real
  // terminal — piped/CI runs (`jaguar --help | cat`) get plain help instead.
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (isBareOrHelp && interactive) {
    await runSplash();
    console.clear();
    program.outputHelp();
    return;
  }

  // Non-interactive bare/help, or a non-terminal: show help without animation.
  if (isBareOrHelp) {
    if (args.length === 0) printBanner();
    program.outputHelp();
    return;
  }

  program.parse(process.argv);
}

main();
