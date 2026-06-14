/**
 * Architecture command — analyze repository structure for architectural issues.
 *
 * Results are written to `architecture.md` in the project root (not the terminal).
 *
 * Usage:
 *   jaguar architecture --provider anthropic
 *   jaguar architecture --provider anthropic --model claude-sonnet-4-20250514
 *   jaguar architecture --provider openai --depth 5
 */

import { Command } from "commander";
import chalk from "chalk";
import axios from "axios";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getCredential } from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { getDefaultProvider, resolveBaseUrl, BUILT_IN_PROVIDERS } from "../services/provider.js";
import { getFileTree } from "../services/git.js";
import { loadMemory, loadRules } from "../services/context.js";
import { buildArchitectureMarkdown, type ArchitectureFinding } from "../services/output.js";
import { startScan } from "../utils/loader.js";
import { describeRequestError } from "../utils/errors.js";

// Common config files worth feeding to the architecture analysis.
const CONFIG_FILES = [
  "tsconfig.json",
  "package.json",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "requirements.txt",
];

/**
 * Register the architecture command.
 */
export function registerArchitectureCommand(program: Command): void {
  program
    .command("architecture")
    .description("Analyze repository structure and write findings to architecture.md")
    .option("--provider <name>", "AI provider to use (openai, anthropic, etc.)")
    .option("--model <name>", "Model to use (e.g. gpt-4o, claude-sonnet-4-20250514)")
    .option("--depth <n>", "Directory tree depth", "3")
    .action(async (options: { provider?: string; model?: string; depth?: string }) => {
      const spinner = startScan("jaguar architecture", "mapping project structure");

      try {
        // 1. Determine provider
        const provider = options.provider ?? (await getDefaultProvider());
        if (!provider) {
          spinner.fail(
            chalk.red(
              "No provider specified. Run `jaguar key add <provider>` first, " +
                "or use `--provider <name>`."
            )
          );
          process.exit(1);
        }

        // 2. API key
        const apiKey = await getCredential(provider);
        if (!apiKey) {
          spinner.fail(
            chalk.red(
              `No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`
            )
          );
          process.exit(1);
        }

        // 2b. Base URL — generic providers require one
        const baseUrl = await resolveBaseUrl(provider);
        if (!BUILT_IN_PROVIDERS.includes(provider.toLowerCase()) && !baseUrl) {
          spinner.fail(
            chalk.red(
              `No base URL configured for generic provider "${provider}". ` +
                `Run \`jaguar key add ${provider}\` to set one.`
            )
          );
          process.exit(1);
        }

        // 3. Gather repository structure
        spinner.text = "Gathering repository structure...";
        const cwd = process.cwd();
        const depth = parseInt(options.depth ?? "3", 10) || 3;
        const tree = getFileTree(depth, cwd);

        const config_files: Array<{ path: string; content: string }> = [];
        for (const name of CONFIG_FILES) {
          const full = join(cwd, name);
          if (existsSync(full)) {
            try {
              config_files.push({ path: name, content: readFileSync(full, "utf-8").slice(0, 8000) });
            } catch {
              // skip unreadable files
            }
          }
        }

        const memory = loadMemory(cwd);
        const rules = loadRules(cwd);

        // 4. Start backend
        spinner.text = "Connecting to backend...";
        await ensureBackend();
        const port = getBackendPort();
        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        // 5. Call the backend
        spinner.text = `Running architecture review with ${provider}...`;
        const response = await axios.post(
          `http://127.0.0.1:${port}/architecture`,
          {
            tree,
            import_graph: {},
            config_files,
            provider,
            base_url: baseUrl,
            model: options.model,
            memory,
            rules,
          },
          {
            headers: {
              "X-Provider-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 120000,
          }
        );

        const result = response.data as {
          findings: ArchitectureFinding[];
          improvements: string[];
          recommendations: string;
          provider_used: string;
        };

        spinner.stop();

        // 6. Write architecture.md
        const reportPath = join(cwd, "architecture.md");
        const markdown = buildArchitectureMarkdown(
          result.findings ?? [],
          result.improvements ?? [],
          result.recommendations ?? "",
          result.provider_used,
          options.model ?? "",
          new Date().toISOString()
        );
        writeFileSync(reportPath, markdown, "utf-8");

        const count = (result.findings ?? []).length;
        spinner.succeed(
          chalk.green(
            `Architecture review complete — ${count} finding${count !== 1 ? "s" : ""} written to ` +
              chalk.bold("architecture.md")
          )
        );
      } catch (error: unknown) {
        spinner.fail(
          chalk.red(`Architecture review failed: ${describeRequestError(error)}`)
        );
        process.exit(1);
      }
    });
}
