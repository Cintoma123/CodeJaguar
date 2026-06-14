/**
 * Rules command — manage project rules (.jaguar/rules.md).
 *
 * Project rules are injected into the system prompt of every AI call so the
 * model enforces project-specific engineering conventions.
 *
 * Subcommands:
 *   jaguar rules init   — Create rules.md from a template
 *   jaguar rules show   — Print current rules
 *   jaguar rules edit   — Open rules.md in $EDITOR
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

import { loadRules, initRules } from "../services/context.js";

/**
 * Register the rules command and its subcommands.
 */
export function registerRulesCommand(program: Command): void {
  const rules = program
    .command("rules")
    .description("Manage project rules (.jaguar/rules.md)");

  // ── jaguar rules init ────────────────────────────────
  rules
    .command("init")
    .description("Create .jaguar/rules.md from a template")
    .action(() => {
      const cwd = process.cwd();
      const path = join(cwd, ".jaguar", "rules.md");
      if (existsSync(path)) {
        console.log(chalk.yellow("rules.md already exists. Leaving it untouched."));
        return;
      }
      initRules(cwd);
      console.log(chalk.green("✓ Created .jaguar/rules.md"));
    });

  // ── jaguar rules show ────────────────────────────────
  rules
    .command("show")
    .description("Print the current project rules")
    .action(() => {
      const content = loadRules(process.cwd());
      if (!content) {
        console.log(chalk.yellow("No rules configured. Run `jaguar rules init`."));
        return;
      }
      console.log(content);
    });

  // ── jaguar rules edit ────────────────────────────────
  rules
    .command("edit")
    .description("Open .jaguar/rules.md in your $EDITOR")
    .action(() => {
      const cwd = process.cwd();
      const path = join(cwd, ".jaguar", "rules.md");
      if (!existsSync(path)) {
        initRules(cwd);
        console.log(chalk.gray("Created .jaguar/rules.md (it didn't exist yet)."));
      }

      const editor =
        process.env.EDITOR ||
        process.env.VISUAL ||
        (platform() === "win32" ? "notepad" : "vi");

      const result = spawnSync(editor, [path], { stdio: "inherit" });
      if (result.error) {
        console.log(
          chalk.red(`Could not open editor "${editor}": ${result.error.message}`)
        );
        console.log(chalk.gray(`Edit the file manually: ${path}`));
        process.exit(1);
      }
    });
}
