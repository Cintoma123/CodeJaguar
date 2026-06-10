/**
 * Security scan command — comprehensive security analysis across source code,
 * dependencies, Docker files, GitHub Actions, environment files, and secrets.
 *
 * Usage:
 *   jaguar security                        # Full scan
 *   jaguar security --only secrets         # Secrets only
 *   jaguar security --only deps            # Dependencies only
 *   jaguar security --only docker          # Docker files only
 *   jaguar security --only actions         # GitHub Actions only
 *   jaguar security --provider anthropic
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import axios from "axios";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getCredential } from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { renderSecurityResults } from "../services/output.js";

/**
 * Collect files matching glob-like patterns from the project root.
 */
function collect_files(
  patterns: string[],
  cwd: string,
  max_total_size: number = 200000,
): Array<{ path: string; content: string }> {
  const { execSync } = require("node:child_process");
  const results: Array<{ path: string; content: string }> = [];
  let total_size = 0;

  for (const pattern of patterns) {
    try {
      // Use git ls-files for tracked files, fallback to glob
      const output = execSync(
        `git ls-files -- '${pattern}' 2>/dev/null || true`,
        { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
      const files = output.split("\n").filter((f: string) => f.length > 0);
      for (const file of files) {
        if (total_size >= max_total_size) break;
        const full_path = join(cwd, file);
        if (existsSync(full_path)) {
          const content = readFileSync(full_path, "utf-8");
          results.push({ path: file, content });
          total_size += content.length;
        }
      }
    } catch {
      // Fallback: try direct file match
      const full_path = join(cwd, pattern);
      if (existsSync(full_path)) {
        const content = readFileSync(full_path, "utf-8");
        results.push({ path: pattern, content });
      }
    }
  }

  return results;
}

/**
 * Read a single file by pattern (e.g., .gitignore).
 */
function read_file_by_name(name: string, cwd: string): string {
  const full_path = join(cwd, name);
  if (existsSync(full_path)) {
    return readFileSync(full_path, "utf-8");
  }
  return "";
}

/**
 * Register the security command.
 */
export function registerSecurityCommand(program: Command): void {
  program
    .command("security")
    .description("Comprehensive security scan across source, dependencies, and infrastructure")
    .option("--provider <name>", "AI provider to use (openai, anthropic, etc.)")
    .option("--only <module>", "Run only a specific scan module (secrets, deps, docker, actions)")
    .action(async (options: { provider?: string; only?: string }) => {
      const spinner = ora("Preparing security scan...").start();

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

        // 2. Get API key from keychain
        const apiKey = await getCredential(provider);
        if (!apiKey) {
          spinner.fail(
            chalk.red(
              `No API key found for ${provider}. Run \`jaguar key add ${provider}\` first.`
            )
          );
          process.exit(1);
        }

        // 3. Collect files from the project
        spinner.text = "Collecting project files...";
        const cwd = process.cwd();

        const source_files = collect_files(
          ["**/*.ts", "**/*.js", "**/*.py", "**/*.go", "**/*.rs", "**/*.java", "**/*.rb", "**/*.php"],
          cwd,
          100000,
        );

        const dependency_files = collect_files(
          [
            "package.json", "package-lock.json", "bun.lock", "yarn.lock",
            "requirements.txt", "poetry.lock", "pyproject.toml", "Pipfile.lock",
            "Gemfile.lock", "go.mod", "go.sum", "Cargo.toml", "Cargo.lock",
            "composer.json", "composer.lock", "pom.xml", "build.gradle", "build.gradle.kts",
            "*.csproj", "packages.lock.json",
          ],
          cwd,
        );

        const docker_files = collect_files(
          ["Dockerfile", "Dockerfile.*", "**/Dockerfile*"],
          cwd,
        );

        const compose_files = collect_files(
          [
            "docker-compose.yml", "docker-compose.*.yml",
            "compose.yml", "compose.*.yml",
          ],
          cwd,
        );

        const action_files = collect_files(
          [".github/workflows/*.yml", ".github/workflows/*.yaml"],
          cwd,
        );

        const env_files = collect_files(
          [".env", ".env.*", ".env.example", ".env.template", ".env.local", ".env.production"],
          cwd,
        );

        const gitignore = read_file_by_name(".gitignore", cwd);

        // 4. Start backend
        spinner.text = "Connecting to backend...";
        await ensureBackend();
        const port = getBackendPort();

        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        // 5. Call the backend
        spinner.text = `Running security scan with ${provider}...`;
        const scan_modules = options.only ? [options.only] : ["all"];

        const response = await axios.post(
          `http://127.0.0.1:${port}/security`,
          {
            source_files: source_files.map((f) => ({ path: f.path, content: f.content })),
            dependency_files: dependency_files.map((f) => ({ path: f.path, content: f.content })),
            docker_files: docker_files.map((f) => ({ path: f.path, content: f.content })),
            compose_files: compose_files.map((f) => ({ path: f.path, content: f.content })),
            action_files: action_files.map((f) => ({ path: f.path, content: f.content })),
            env_files: env_files.map((f) => ({ path: f.path, content: f.content })),
            gitignore,
            provider,
            scan_modules,
            memory: {},
            rules: "",
          },
          {
            headers: {
              "X-Provider-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 180000, // 3 minute timeout for full security scan
          }
        );

        const result = response.data as {
          findings: Array<{
            severity: string;
            category: string;
            module: string;
            file: string;
            line?: number;
            description: string;
            impact: string;
            recommendation: string;
          }>;
          stats: {
            critical: number;
            high: number;
            medium: number;
            low: number;
          };
          provider_used: string;
        };

        spinner.stop();

        // 6. Render output
        renderSecurityResults(
          result.findings,
          result.stats,
          result.provider_used,
        );
      } catch (error: unknown) {
        spinner.fail(
          chalk.red(
            `Security scan failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exit(1);
      }
    });
}

/**
 * Get the default provider from keychain.
 */
async function getDefaultProvider(): Promise<string | null> {
  const providers = ["openai", "anthropic", "gemini", "deepseek"];
  for (const provider of providers) {
    const key = await getCredential(provider);
    if (key) {
      return provider;
    }
  }
  return null;
}
