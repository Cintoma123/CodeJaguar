/**
 * Memory command — manage repository memory (.jaguar/memory.json).
 *
 * Repository memory makes reviews context-aware. It is stored as JSON in the
 * project root and can be committed.
 *
 * Subcommands:
 *   jaguar memory init            — Create memory.json from a template
 *   jaguar memory show            — Print current memory
 *   jaguar memory set <key> <val> — Update a single field
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { loadMemory, initMemory } from "../services/context.js";

// Fields that hold a list of values (comma-separated on the CLI).
const ARRAY_FIELDS = new Set(["patterns", "conventions", "services"]);

/**
 * Register the memory command and its subcommands.
 */
export function registerMemoryCommand(program: Command): void {
  const memory = program
    .command("memory")
    .description("Manage repository memory (.jaguar/memory.json)");

  // ── jaguar memory init ───────────────────────────────
  memory
    .command("init")
    .description("Create .jaguar/memory.json from a template")
    .action(() => {
      const cwd = process.cwd();
      const path = join(cwd, ".jaguar", "memory.json");
      if (existsSync(path)) {
        console.log(chalk.yellow("memory.json already exists. Leaving it untouched."));
        return;
      }
      initMemory(cwd);
      console.log(chalk.green("✓ Created .jaguar/memory.json"));
      console.log(chalk.gray("Edit it or use `jaguar memory set <key> <value>`."));
    });

  // ── jaguar memory show ───────────────────────────────
  memory
    .command("show")
    .description("Print the current repository memory")
    .action(() => {
      const mem = loadMemory(process.cwd());
      if (Object.keys(mem).length === 0) {
        console.log(chalk.yellow("No memory configured. Run `jaguar memory init`."));
        return;
      }
      console.log(JSON.stringify(mem, null, 2));
    });

  // ── jaguar memory set ────────────────────────────────
  memory
    .command("set <key> <value>")
    .description("Set a memory field (comma-separated for list fields)")
    .action((key: string, value: string) => {
      const cwd = process.cwd();
      const mem = loadMemory(cwd) as Record<string, unknown>;

      mem[key] = ARRAY_FIELDS.has(key)
        ? value.split(",").map((v) => v.trim()).filter((v) => v.length > 0)
        : value;

      const dir = join(cwd, ".jaguar");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(
        join(dir, "memory.json"),
        JSON.stringify(mem, null, 2),
        "utf-8"
      );
      console.log(chalk.green(`✓ Set ${key}`));
    });
}
