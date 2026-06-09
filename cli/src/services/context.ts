/**
 * Memory and rules loader service.
 *
 * Loads .jaguar/memory.json and .jaguar/rules.md from the project root.
 * These are injected into every AI prompt for context-aware reviews.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const JAGUAR_DIR = ".jaguar";

/**
 * Load memory.json from the project root.
 */
export function loadMemory(cwd: string): Record<string, unknown> {
  const memoryPath = join(cwd, JAGUAR_DIR, "memory.json");
  if (!existsSync(memoryPath)) {
    return {};
  }
  try {
    const content = readFileSync(memoryPath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Load rules.md from the project root.
 */
export function loadRules(cwd: string): string {
  const rulesPath = join(cwd, JAGUAR_DIR, "rules.md");
  if (!existsSync(rulesPath)) {
    return "";
  }
  try {
    return readFileSync(rulesPath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Initialize memory.json with a template.
 */
export function initMemory(cwd: string): void {
  const jaguarDir = join(cwd, JAGUAR_DIR);
  if (!existsSync(jaguarDir)) {
    mkdirSync(jaguarDir, { recursive: true });
  }

  const memoryPath = join(jaguarDir, "memory.json");
  const template = {
    framework: "",
    database: "",
    architecture: "",
    testing: "",
    language: "",
    patterns: [],
    conventions: [],
    services: [],
    notes: "",
  };

  writeFileSync(memoryPath, JSON.stringify(template, null, 2), "utf-8");
}

/**
 * Initialize rules.md with a template.
 */
export function initRules(cwd: string): void {
  const jaguarDir = join(cwd, JAGUAR_DIR);
  if (!existsSync(jaguarDir)) {
    mkdirSync(jaguarDir, { recursive: true });
  }

  const rulesPath = join(jaguarDir, "rules.md");
  const template = `# Project Rules

- Add your project-specific rules here
- These rules will be injected into every AI review prompt
- Example: Always use the Repository Pattern for data access
- Example: All public API endpoints must require authentication
`;

  writeFileSync(rulesPath, template, "utf-8");
}
