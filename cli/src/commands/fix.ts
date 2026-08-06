/**
 * Fix command — restore files from a backup timestamp.
 *
 * Usage:
 *   jaguar fix --undo 2026-07-31T14-30-00-123Z
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";

const BACKUP_ROOT = join(homedir(), ".jaguar", "backups");

/**
 * Register the fix command.
 */
export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description("Restore files from a backup")
    .option("--undo <timestamp>", "Restore all files from a backup timestamp")
    .action(async (options: { undo?: string }) => {
      if (!options.undo) {
        console.error(chalk.red("Usage: jaguar fix --undo <timestamp>"));
        console.error(chalk.gray("  Example: jaguar fix --undo 2026-07-31T14-30-00-123Z"));
        process.exit(1);
      }

      const timestamp = options.undo;
      const backupDir = join(BACKUP_ROOT, timestamp);

      if (!existsSync(backupDir)) {
        console.error(chalk.red(`No backup found for timestamp: ${timestamp}`));
        console.error(chalk.gray(`  Backups are stored in: ${BACKUP_ROOT}`));
        process.exit(1);
      }

      const cwd = process.cwd();
      let restored = 0;
      let failed = 0;

      try {
        // Walk the backup directory and restore every file to its original location
        const restoreRecursive = (dir: string): void => {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const backupPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              restoreRecursive(backupPath);
            } else if (entry.isFile()) {
              // The backup structure mirrors the project: backupDir/path/to/file.ts
              // Compute the relative path from backupDir to get the original location
              const relPath = relative(backupDir, backupPath);
              const targetPath = join(cwd, relPath);

              try {
                const content = readFileSync(backupPath, "utf-8");
                writeFileSync(targetPath, content, "utf-8");
                console.log(`  ${chalk.green("✓")} Restored ${chalk.cyan(relPath)}`);
                restored++;
              } catch (error: unknown) {
                console.error(
                  `  ${chalk.red("✗")} Failed to restore ${relPath}: ${String(error)}`
                );
                failed++;
              }
            }
          }
        };

        console.log(`\n  ${chalk.gray("Restoring from backup:")} ${chalk.cyan(timestamp)}`);
        console.log("");
        restoreRecursive(backupDir);
        console.log("");
        console.log(`  ${chalk.gray("─".repeat(45))}`);
        console.log(
          `  ${chalk.green("✓")} ${restored} file${restored !== 1 ? "s" : ""} restored`
        );
        if (failed > 0) {
          console.log(`  ${chalk.red("✗")} ${failed} file${failed !== 1 ? "s" : ""} failed`);
        }
        console.log("");
      } catch (error: unknown) {
        console.error(chalk.red(`Restore failed: ${String(error)}`));
        process.exit(1);
      }
    });
}