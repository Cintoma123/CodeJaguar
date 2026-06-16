/**
 * Key command — BYOK credential management.
 *
 * Subcommands:
 *   jaguar key add <provider>   — Store an API key
 *   jaguar key list             — List configured providers
 *   jaguar key test <provider>  — Test provider connectivity
 *   jaguar key remove <provider> — Remove a stored key
 */

import { Command } from "commander";
import chalk from "chalk";
import axios from "axios";
import * as readline from "node:readline";

import {
  storeCredential,
  getCredential,
  deleteCredential,
  listCredentials,
} from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { jaguarSpinner } from "../utils/loader.js";

/**
 * Create a readline-based hidden input prompt.
 * Does not echo characters to the terminal.
 */
function hiddenPrompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    // Override the question method to suppress echo
    process.stderr.write(question);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding("utf-8");

    let password = "";

    const onData = (char: string) => {
      if (char === "\n" || char === "\r") {
        cleanup();
        resolve(password);
      } else if (char === "\u0003") {
        // Ctrl+C
        cleanup();
        process.exit(1);
      } else if (char === "\u007F" || char === "\b") {
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += char;
      }
    };

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) {
        stdin.setRawMode(wasRaw ?? false);
      }
      stdin.pause();
      rl.close();
      process.stderr.write("\n");
    };

    stdin.on("data", onData);
  });
}

/**
 * Create a regular readline prompt (with echo).
 */
function normalPrompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Register the key command and its subcommands.
 */
export function registerKeyCommand(program: Command): void {
  const key = program
    .command("key")
    .description("Manage API provider credentials (stored in OS keychain)");

  // ── jaguar key add ───────────────────────────────
  key
    .command("add [provider]")
    .description("Store an API key for a provider")
    .action(async (provider?: string) => {
      if (!provider || provider.trim().length === 0) {
        console.log(chalk.red("✗ Missing provider name.\n"));
        console.log(chalk.bold("Usage:"));
        console.log(`  ${chalk.cyan("jaguar key add [provider]")}\n`);
        console.log(chalk.bold("Built-in providers:"));
        console.log(
          chalk.gray("  openai, anthropic, gemini, deepseek\n")
        );
        console.log(chalk.bold("Generic provider (custom base URL):"));
        console.log(
          chalk.gray(
            "  Use any other name — you'll be prompted for a base URL.\n"
          )
        );
        console.log(chalk.bold("Examples:"));
        console.log(`  ${chalk.cyan("jaguar key add openai")}`);
        console.log(
          `  ${chalk.cyan("jaguar key add groq")}   ${chalk.gray("# generic, prompts for base URL")}`
        );
        process.exit(1);
      }

      const spinner = jaguarSpinner(`Setting up ${provider}...`).start();

      try {
        // Check if already exists
        const existing = await getCredential(provider);
        if (existing) {
          spinner.warn(
            chalk.yellow(
              `${provider} already has a stored key. Overwriting.`
            )
          );
        }

        // Prompt for API key (hidden input)
        spinner.stop();
        const apiKey = await hiddenPrompt(
          `Enter your ${provider} API key: `
        );

        if (!apiKey || apiKey.trim().length === 0) {
          console.log(chalk.red("✗ No API key provided. Aborting."));
          process.exit(1);
        }

        // Optionally prompt for custom base URL (for generic providers)
        let baseUrl: string | null = null;
        const builtInProviders = ["openai", "anthropic", "gemini", "deepseek"];
        if (!builtInProviders.includes(provider.toLowerCase())) {
          const urlInput = await normalPrompt(
            `Enter base URL for ${provider} (or press Enter to skip): `
          );
          if (urlInput && urlInput.trim().length > 0) {
            baseUrl = urlInput.trim();
          }
        }

        // Store the key
        await storeCredential(provider, apiKey.trim());

        // Also store base URL if provided
        if (baseUrl) {
          await storeCredential(`${provider}_base_url`, baseUrl);
        }

        // Store provider type metadata
        if (!builtInProviders.includes(provider.toLowerCase())) {
          await storeCredential(`${provider}_type`, "generic");
        }

        console.log(
          chalk.green(`✓ ${provider} key stored securely in OS keychain`)
        );
      } catch (error) {
        spinner.fail(chalk.red(`Failed to store ${provider} key: ${error}`));
        process.exit(1);
      }
    });

  // ── jaguar key list ──────────────────────────────
  key
    .command("list")
    .description("List all configured providers (names only)")
    .action(async () => {
      try {
        const providers = await listCredentials();

        if (providers.length === 0) {
          console.log(chalk.yellow("No providers configured."));
          console.log(
            chalk.gray("Run `jaguar key add <provider>` to get started.")
          );
          return;
        }

        console.log(chalk.bold("\nConfigured Providers:\n"));
        for (const provider of providers) {
          // Skip metadata keys
          if (provider.includes("_base_url") || provider.includes("_type")) {
            continue;
          }
          console.log(`  ${chalk.cyan("•")} ${provider}`);
        }
        console.log("");
      } catch (error) {
        console.log(chalk.red(`Failed to list providers: ${error}`));
        process.exit(1);
      }
    });

  // ── jaguar key test ──────────────────────────────
  key
    .command("test <provider>")
    .description("Test provider connectivity and API key validity")
    .action(async (provider: string) => {
      const spinner = jaguarSpinner(`Testing ${provider} connection...`).start();

      try {
        // Get the API key
        const apiKey = await getCredential(provider);
        if (!apiKey) {
          spinner.fail(
            chalk.red(
              `No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`
            )
          );
          process.exit(1);
        }

        // Ensure backend is running
        spinner.text = "Starting backend...";
        await ensureBackend((msg) => {
          spinner.text = msg;
        });
        const port = getBackendPort();

        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        // Get base URL if stored
        const baseUrl = await getCredential(`${provider}_base_url`);

        // Call the backend test endpoint
        spinner.text = `Testing ${provider} API key...`;
        const response = await axios.post(
          `http://127.0.0.1:${port}/providers/test`,
          {
            provider,
            base_url: baseUrl,
          },
          {
            headers: {
              "X-Provider-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        const result = response.data as {
          success: boolean;
          model: string;
          latency_ms: number;
          error?: string;
        };

        if (result.success) {
          spinner.succeed(
            chalk.green(
              `✓ ${provider} connection successful (${result.model}, ${result.latency_ms}ms)`
            )
          );
        } else {
          spinner.fail(
            chalk.red(
              `✗ ${provider} authentication failed: ${result.error ?? "Unknown error"}`
            )
          );
          process.exit(1);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        spinner.fail(chalk.red(`✗ ${provider} test failed: ${message}`));
        process.exit(1);
      }
    });

  // ── jaguar key remove ────────────────────────────
  key
    .command("remove <provider>")
    .description("Remove a stored provider API key")
    .action(async (provider: string) => {
      try {
        const existing = await getCredential(provider);
        if (!existing) {
          console.log(
            chalk.yellow(`No API key found for ${provider}. Nothing to remove.`)
          );
          return;
        }

        await deleteCredential(provider);
        // Also clean up metadata
        await deleteCredential(`${provider}_base_url`);
        await deleteCredential(`${provider}_type`);

        console.log(
          chalk.green(`✓ ${provider} API key removed from keychain`)
        );
      } catch (error) {
        console.log(chalk.red(`Failed to remove ${provider}: ${error}`));
        process.exit(1);
      }
    });
}
