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

/** Severity levels a user may set as the watch-mode threshold. */
export type WatchSeverity = "low" | "medium" | "high" | "critical";

/** Watch-mode behaviour, read from the `watch` block of memory.json. */
export interface WatchConfig {
  /** Glob-ish patterns (relative to project root) to skip. */
  ignore: string[];
  /** Debounce window in ms before a saved file is reviewed. */
  debounceMs: number;
  /** Findings below this severity are suppressed in watch output. */
  severityThreshold: WatchSeverity;
}

/** Defaults applied when memory.json has no `watch` block (or is absent). */
export const DEFAULT_WATCH_CONFIG: WatchConfig = {
  ignore: [],
  debounceMs: 800,
  severityThreshold: "low",
};

const VALID_SEVERITIES: WatchSeverity[] = ["low", "medium", "high", "critical"];

/**
 * Load the `watch` block from .jaguar/memory.json, falling back to defaults for
 * any missing or malformed field. Never throws — a bad config degrades to
 * defaults so watch mode always starts.
 */
export function loadWatchConfig(cwd: string): WatchConfig {
  const memory = loadMemory(cwd);
  const raw = memory.watch;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_WATCH_CONFIG };
  }

  const w = raw as Record<string, unknown>;

  const ignore = Array.isArray(w.ignore)
    ? w.ignore.filter((p): p is string => typeof p === "string")
    : DEFAULT_WATCH_CONFIG.ignore;

  const debounceMs =
    typeof w.debounce_ms === "number" && w.debounce_ms >= 0
      ? w.debounce_ms
      : DEFAULT_WATCH_CONFIG.debounceMs;

  const threshold =
    typeof w.severity_threshold === "string" &&
    VALID_SEVERITIES.includes(w.severity_threshold.toLowerCase() as WatchSeverity)
      ? (w.severity_threshold.toLowerCase() as WatchSeverity)
      : DEFAULT_WATCH_CONFIG.severityThreshold;

  return { ignore, debounceMs, severityThreshold: threshold };
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
