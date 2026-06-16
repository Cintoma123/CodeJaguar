/**
 * Security scan command — comprehensive security analysis across source code,
 * dependencies, Docker files, GitHub Actions, environment files, and secrets.
 *
 * Results are written to a scan-specific Markdown file (not the terminal),
 * e.g. security-full-scan.md, security-secrets.md, security-deps.md.
 *
 * Usage:
 *   jaguar security --provider anthropic                              # Full scan
 *   jaguar security --provider anthropic --model claude-sonnet-4-20250514
 *   jaguar security --only secrets --provider anthropic              # Secrets only
 *   jaguar security --only deps --provider openai --model gpt-4o     # Dependencies only
 *   jaguar security --only docker --provider anthropic               # Docker files only
 *   jaguar security --only actions --provider anthropic              # GitHub Actions only
 */

import { Command } from "commander";
import chalk from "chalk";
import axios from "axios";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

import { getCredential } from "../providers/keychain.js";
import { ensureBackend, getBackendPort } from "../services/backend.js";
import { getDefaultProvider, resolveBaseUrl, BUILT_IN_PROVIDERS } from "../services/provider.js";
import { buildSecurityMarkdown } from "../services/output.js";
import { startScan } from "../utils/loader.js";
import { describeRequestError } from "../utils/errors.js";

/**
 * Map a scan mode (from --only, or undefined for a full scan) to a
 * human-readable label and an output filename.
 */
function scanTarget(only?: string): { label: string; filename: string } {
  const labels: Record<string, string> = {
    secrets: "Secrets",
    deps: "Dependencies",
    docker: "Docker",
    actions: "GitHub Actions",
  };
  if (!only) {
    return { label: "Full Scan", filename: "security-full-scan.md" };
  }
  const key = only.toLowerCase();
  const label = labels[key] ?? only;
  return { label, filename: `security-${key}.md` };
}

/**
 * Collect files matching glob-like patterns from the project root.
 */
function collect_files(
  patterns: string[],
  cwd: string,
  max_total_size: number = 200000,
): Array<{ path: string; content: string }> {
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
    .option("--model <name>", "Model to use (e.g. gpt-4o, claude-sonnet-4-20250514, owl-alpha)")
    .option("--only <module>", "Run only a specific scan module (secrets, deps, docker, actions)")
    .action(async (options: { provider?: string; model?: string; only?: string }) => {
      const spinner = startScan("jaguar security", "running 8 security modules...");

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

        // 2b. Resolve base URL — generic (non-built-in) providers require one
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
        await ensureBackend((msg) => {
          spinner.text = msg;
        });
        const port = getBackendPort();

        if (!port) {
          spinner.fail(chalk.red("Failed to start backend."));
          process.exit(1);
        }

        // 6. Call the backend
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
            base_url: baseUrl,
            model: options.model,
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

        // 7. Write results to a scan-specific Markdown file (not the terminal)
        const { label, filename } = scanTarget(options.only);
        const reportPath = join(cwd, filename);
        const markdown = buildSecurityMarkdown(
          result.findings,
          result.stats,
          result.provider_used,
          options.model ?? "",
          label,
          new Date().toISOString()
        );
        writeFileSync(reportPath, markdown, "utf-8");

        const { critical, high, medium, low } = result.stats;
        spinner.succeed(
          chalk.green(
            `Security scan (${label}) complete — ` +
              `${critical} critical, ${high} high, ${medium} medium, ${low} low written to ` +
              chalk.bold(filename)
          )
        );
      } catch (error: unknown) {
        spinner.fail(
          chalk.red(`Security scan failed: ${describeRequestError(error)}`)
        );
        process.exit(1);
      }
    });
}
