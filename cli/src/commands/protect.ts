/**
 * Protect command — install a pre-commit git hook that scans staged files for
 * secrets before every commit (CLAUDE.md §10.4).
 *
 * The hook runs the standalone TS secret scanner (no backend, no AI) so commits
 * stay fast. A CRITICAL or HIGH match blocks the commit.
 *
 * Usage:
 *   jaguar protect            # Install the pre-commit hook
 *   jaguar protect --remove   # Uninstall the hook
 *   jaguar protect --status   # Show hook status
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { scanStagedFiles, type SecretMatch } from "../services/secrets.js";

const HOOK_MARKER = "# CodeJaguar pre-commit hook (do not edit this line)";

/**
 * Resolve the git hooks directory for the current repo, or null if not a repo.
 */
function getHooksDir(cwd: string): string | null {
  try {
    const dir = execSync("git rev-parse --git-path hooks", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return dir ? join(cwd, dir) : null;
  } catch {
    return null;
  }
}

/**
 * Absolute path to the compiled CLI entrypoint (dist/index.js), used so the
 * generated hook can call back into this CLI regardless of PATH.
 */
function cliEntrypoint(): string {
  // This file compiles to dist/commands/protect.js → entry is ../index.js
  return fileURLToPath(new URL("../index.js", import.meta.url));
}

function buildHookScript(): string {
  const entry = cliEntrypoint().replace(/\\/g, "/");
  return `#!/bin/sh
${HOOK_MARKER}
# Scans staged files for secrets. Bypass with: git commit --no-verify
node "${entry}" protect --run-hook
exit $?
`;
}

function isOurHook(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf-8").includes(HOOK_MARKER);
  } catch {
    return false;
  }
}

/**
 * Register the protect command.
 */
export function registerProtectCommand(program: Command): void {
  program
    .command("protect")
    .description("Install a git pre-commit hook that blocks commits containing secrets")
    .option("--remove", "Uninstall the pre-commit hook")
    .option("--status", "Show whether the hook is installed")
    .option("--run-hook", "(internal) Run the staged-file scan; used by the hook")
    .action((options: { remove?: boolean; status?: boolean; runHook?: boolean }) => {
      const cwd = process.cwd();

      // Internal: invoked by the installed hook on every commit.
      if (options.runHook) {
        runHook(cwd);
        return;
      }

      const hooksDir = getHooksDir(cwd);
      if (!hooksDir) {
        console.log(chalk.red("Not a git repository. Run this inside a repo."));
        process.exit(1);
      }
      const hookPath = join(hooksDir, "pre-commit");

      if (options.status) {
        showStatus(hookPath);
        return;
      }

      if (options.remove) {
        removeHook(hookPath);
        return;
      }

      installHook(hookPath);
    });
}

function installHook(hookPath: string): void {
  if (existsSync(hookPath) && !isOurHook(hookPath)) {
    console.log(
      chalk.red(
        "A pre-commit hook already exists and was not created by CodeJaguar."
      )
    );
    console.log(
      chalk.gray(`Refusing to overwrite it. Inspect or remove: ${hookPath}`)
    );
    process.exit(1);
  }

  writeFileSync(hookPath, buildHookScript(), "utf-8");
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    // chmod may be a no-op on Windows; the sh hook still runs via Git Bash.
  }

  console.log(chalk.green("✓ Installed CodeJaguar pre-commit hook."));
  console.log(
    chalk.gray("Commits will now be scanned for secrets. Bypass with `git commit --no-verify`.")
  );
}

function removeHook(hookPath: string): void {
  if (!existsSync(hookPath)) {
    console.log(chalk.yellow("No pre-commit hook installed. Nothing to remove."));
    return;
  }
  if (!isOurHook(hookPath)) {
    console.log(
      chalk.red("The pre-commit hook was not created by CodeJaguar; leaving it untouched.")
    );
    process.exit(1);
  }
  unlinkSync(hookPath);
  console.log(chalk.green("✓ Removed CodeJaguar pre-commit hook."));
}

function showStatus(hookPath: string): void {
  if (isOurHook(hookPath)) {
    console.log(chalk.green("✓ CodeJaguar pre-commit hook is installed."));
    console.log(chalk.gray(hookPath));
  } else if (existsSync(hookPath)) {
    console.log(chalk.yellow("A pre-commit hook exists but was not created by CodeJaguar."));
    console.log(chalk.gray(hookPath));
  } else {
    console.log(chalk.gray("No pre-commit hook installed. Run `jaguar protect` to install."));
  }
}

/**
 * The actual scan run on every commit. Blocks (exit 1) on CRITICAL/HIGH secrets.
 */
function runHook(cwd: string): void {
  const matches = scanStagedFiles(cwd);
  const blocking = matches.filter(
    (m) => m.severity === "CRITICAL" || m.severity === "HIGH"
  );
  const warnings = matches.filter((m) => m.severity === "MEDIUM");

  if (blocking.length === 0) {
    if (warnings.length > 0) {
      console.log(
        chalk.yellow(`⚠ ${warnings.length} possible secret(s) flagged (MEDIUM) — commit allowed.`)
      );
      for (const w of warnings) {
        console.log(chalk.gray(`  ${w.file}:${w.line} — ${w.name}`));
      }
    }
    process.exit(0);
  }

  printBlockedBanner(blocking);
  process.exit(1);
}

function printBlockedBanner(findings: SecretMatch[]): void {
  console.log(
    chalk.red(
      "\n╔════════════════════════════════════════╗\n" +
        "║        COMMIT BLOCKED — CodeJaguar     ║\n" +
        "╠════════════════════════════════════════╣\n" +
        "║  Secret(s) detected in staged files.   ║\n" +
        "║  The commit has been prevented.        ║\n" +
        "╚════════════════════════════════════════╝\n"
    )
  );

  for (const f of findings) {
    console.log(
      chalk.bold(`  [${f.severity}] ${f.name}`) +
        chalk.cyan(`  ${f.file}:${f.line}`)
    );
    console.log(chalk.gray(`    ${f.redacted}`));
  }

  console.log(
    "\n" +
      chalk.bold("Action required:") +
      "\n  1. Remove the secret from the file" +
      "\n  2. Add the file to .gitignore if needed" +
      "\n  3. Rotate the exposed key immediately" +
      "\n\n" +
      chalk.gray("To bypass (NOT recommended): git commit --no-verify\n")
  );
}
