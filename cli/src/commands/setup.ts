
/**
 * Setup & doctor commands — manage and diagnose the local Python backend.
 *
 *   jaguar setup            — install/repair the backend venv + dependencies
 *   jaguar setup --force    — rebuild the venv from scratch
 *   jaguar doctor           — diagnose Python, the backend env, and services
 *
 * The published package ships the backend source but not its Python deps, so
 * `setup` is the explicit form of the first-run bootstrap that `jaguar review`
 * triggers automatically (see services/setup.ts).
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

import {
  ensureSetup,
  findSystemPython,
  getVenvPython,
  venvPythonExists,
  verifyBackendDeps,
} from "../services/setup.js";
import { findBackendDir, getBackendPort, healthCheck } from "../services/backend.js";

/**
 * Register the `setup` and `doctor` commands.
 */
export function registerSetupCommand(program: Command): void {
  // ── jaguar setup ─────────────────────────────────────
  program
    .command("setup")
    .description("Install or repair the local Python backend environment")
    .option("--force", "Rebuild the environment from scratch")
    .action(async (options: { force?: boolean }) => {
      const backendDir = findBackendDir();
      if (!backendDir) {
        console.log(
          chalk.red(
            "Could not find the bundled backend. Try reinstalling: npm i -g codejaguar-cli"
          )
        );
        process.exit(1);
      }

      const spinner = ora("Preparing backend…").start();
      try {
        await ensureSetup(backendDir, {
          force: options.force,
          onStatus: (msg) => {
            spinner.text = msg;
          },
        });
        spinner.succeed(chalk.green("Backend environment is ready."));
        console.log(chalk.gray(`  Python: ${getVenvPython()}`));
        console.log(
          chalk.gray("  Run a command, e.g. ") + chalk.cyan("jaguar review")
        );
      } catch (error: unknown) {
        spinner.fail(
          chalk.red(error instanceof Error ? error.message : String(error))
        );
        process.exit(1);
      }
    });

  // ── jaguar doctor ────────────────────────────────────
  program
    .command("doctor")
    .description("Diagnose the CodeJaguar setup (Python, backend env, services)")
    .action(async () => {
      console.log(chalk.bold("\nCodeJaguar doctor\n"));
      let ok = true;

      // 1. Bundled backend present?
      const backendDir = findBackendDir();
      if (backendDir) {
        line(true, "Backend source", backendDir);
      } else {
        ok = false;
        line(false, "Backend source", "not found — reinstall the package");
      }

      // 2. A compatible system Python (used to build the venv)?
      const sys = findSystemPython();
      if (sys) {
        line(true, "System Python", `${sys.version.join(".")} (${sys.path})`);
      } else {
        ok = false;
        line(false, "System Python", "3.10+ not found on PATH");
      }

      // 3. Backend virtualenv created?
      if (venvPythonExists()) {
        line(true, "Backend venv", getVenvPython());
      } else {
        ok = false;
        line(false, "Backend venv", "not created — run `jaguar setup`");
      }

      // 4. Dependencies importable inside the venv?
      const depsOk = verifyBackendDeps();
      if (depsOk) {
        line(true, "Dependencies", "fastapi, uvicorn, httpx, keyring, pydantic");
      } else {
        ok = false;
        line(false, "Dependencies", "missing/broken — run `jaguar setup --force`");
      }

      // 5. Is a backend instance currently running?
      const port = getBackendPort();
      const running = port ? await healthCheck(port) : false;
      if (running) {
        line(true, "Backend service", `running on 127.0.0.1:${port}`);
      } else {
        line(true, "Backend service", "not running (starts on demand)");
      }

      console.log(
        "\n" +
          (ok
            ? chalk.green("All good — `jaguar review` is ready to run.")
            : chalk.yellow("Some checks failed. Run `jaguar setup` to fix the environment.")) +
          "\n"
      );
      process.exit(ok ? 0 : 1);
    });
}

function line(pass: boolean, label: string, detail: string): void {
  const mark = pass ? chalk.green("✓") : chalk.red("✗");
  console.log(`  ${mark} ${label.padEnd(16)} ${chalk.gray(detail)}`);
}