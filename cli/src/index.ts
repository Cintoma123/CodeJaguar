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

// ── Placeholder commands (Week 2-3) ─────────────────────

program
  .command("security")
  .description("Comprehensive security scan across source, dependencies, and infrastructure")
  .action(() => {
    console.log(chalk.yellow("⚠ Security command coming in Week 2."));
  });

program
  .command("architecture")
  .description("Analyze repository structure and identify architectural issues")
  .action(() => {
    console.log(chalk.yellow("⚠ Architecture command coming in Week 3."));
  });

program
  .command("summary")
  .description("Generate a GitHub-ready pull request summary")
  .action(() => {
    console.log(chalk.yellow("⚠ Summary command coming in Week 3."));
  });

program
  .command("protect")
  .description("Install local git hooks that scan for secrets before every commit")
  .action(() => {
    console.log(chalk.yellow("⚠ Protect command coming in Week 4."));
  });

program
  .command("memory")
  .description("Manage repository memory (context-aware reviews)")
  .action(() => {
    console.log(chalk.yellow("⚠ Memory command coming in Week 3."));
  });

program
  .command("rules")
  .description("Manage project-specific engineering rules")
  .action(() => {
    console.log(chalk.yellow("⚠ Rules command coming in Week 3."));
  });

// Display banner only when no arguments given (just `jaguar`)
if (process.argv.length <= 2) {
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

// Parse and execute
program.parse(process.argv);
