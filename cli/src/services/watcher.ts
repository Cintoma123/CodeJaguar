/**
 * File watcher service for `jaguar review --watch`.
 *
 * Wraps chokidar to watch the project tree and emit one debounced review request
 * per changed file. Watch mode reviews a single file at a time, so this service
 * is deliberately narrow: it filters out noise (node_modules, build output,
 * binaries, oversized files) and hands the caller a clean relative path whenever
 * a real source file settles after editing.
 *
 * chokidar v4 dropped built-in glob support, so `ignored` takes a predicate and
 * we match the user's memory.json `ignore` patterns ourselves (see matchesGlob).
 */

import chokidar, { type FSWatcher } from "chokidar";
import { statSync } from "node:fs";
import { relative, sep } from "node:path";

import { debugLog } from "../utils/logger.js";

/** Directories never worth reviewing — always ignored, before user patterns. */
const ALWAYS_IGNORE_DIRS = ["node_modules", "dist", ".git", ".jaguar"];

/** Files above this size are skipped (generated bundles, lockfiles, assets). */
const MAX_FILE_BYTES = 500 * 1024; // 500KB

/**
 * Common binary / non-source extensions. Watch mode reviews code, so we skip
 * these outright rather than shipping unreadable bytes to a provider.
 */
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "svg",
  "pdf", "zip", "gz", "tar", "rar", "7z",
  "mp3", "mp4", "mov", "avi", "webm", "wav",
  "woff", "woff2", "ttf", "eot", "otf",
  "exe", "dll", "so", "dylib", "bin", "wasm",
  "lock",
]);

export interface WatcherOptions {
  /** Project root to watch. */
  cwd: string;
  /** User ignore patterns from memory.json (relative, glob-ish). */
  ignore: string[];
  /** Debounce window in ms before a settled file is reported. */
  debounceMs: number;
  /** Called with a project-relative path once a change settles. */
  onChange: (relativePath: string) => void;
}

/**
 * Translate a simple glob (`*`, `**`, trailing `/` for a dir prefix) into a
 * RegExp. This is intentionally small — it covers the patterns users actually
 * put in memory.json (`dist/`, `*.test.ts`, `**\/*.snap`) without pulling in a
 * glob dependency. Paths are always compared with forward slashes.
 */
function globToRegExp(pattern: string): RegExp {
  // A trailing slash means "this directory and everything under it".
  const dirPrefix = pattern.endsWith("/");
  const body = dirPrefix ? pattern.slice(0, -1) : pattern;

  let re = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string;
    if (c === "*") {
      if (body[i + 1] === "*") {
        re += ".*"; // ** matches across path segments
        i++;
        if (body[i + 1] === "/") i++; // consume the slash after **
      } else {
        re += "[^/]*"; // * matches within a single segment
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c; // escape regex metachars
    } else {
      re += c;
    }
  }

  // `dist/` matches `dist/anything`; a bare pattern must match the whole path or
  // any path segment (so `*.test.ts` matches `src/a.test.ts`).
  const suffix = dirPrefix ? "(/.*)?$" : "$";
  return new RegExp("(^|/)" + re + suffix);
}

/**
 * Whether a project-relative path (forward-slash form) matches any user pattern.
 */
function matchesGlob(relPath: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(relPath));
}

/** Lowercased extension without the dot, or "" if none. */
function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (dot <= slash) return "";
  return path.slice(dot + 1).toLowerCase();
}

/**
 * Decide whether a changed file is worth reviewing. Returns false for binaries,
 * oversized files, and anything under an always-ignored dir or a user pattern.
 * A stat failure (file deleted mid-flight) is treated as "skip".
 */
function isReviewable(
  absPath: string,
  relPath: string,
  userPatterns: RegExp[]
): boolean {
  const normalized = relPath.split(sep).join("/");

  // Always-ignored directories, matched by path segment.
  const segments = normalized.split("/");
  if (segments.some((s) => ALWAYS_IGNORE_DIRS.includes(s))) return false;

  if (BINARY_EXTENSIONS.has(extensionOf(normalized))) return false;

  if (matchesGlob(normalized, userPatterns)) return false;

  try {
    const stat = statSync(absPath);
    if (!stat.isFile()) return false;
    if (stat.size > MAX_FILE_BYTES) return false;
  } catch {
    return false; // vanished between event and stat
  }

  return true;
}

/**
 * A running file watcher. Call `close()` to stop it (used on Ctrl+C).
 */
export interface Watcher {
  close: () => Promise<void>;
}

/**
 * Start watching `cwd`. Each reviewable file that settles (after the debounce
 * window with no further writes) triggers `onChange` with its relative path.
 *
 * Debounce is per-file: editing two different files in quick succession queues
 * two independent reviews; hammering save on one file collapses to a single
 * review once writes stop.
 */
export function startWatcher(options: WatcherOptions): Watcher {
  const { cwd, ignore, debounceMs, onChange } = options;
  const userPatterns = ignore.map(globToRegExp);

  // Per-file debounce timers, keyed by relative path.
  const timers = new Map<string, NodeJS.Timeout>();

  const watcher: FSWatcher = chokidar.watch(cwd, {
    // chokidar v4: `ignored` is a predicate (path, stats?) => boolean. We only
    // cheaply exclude the always-ignore dirs here to avoid descending into
    // node_modules; full reviewability (size, binary, user globs) is checked
    // when an event fires, where a stat is available.
    ignored: (watchPath: string) => {
      const rel = relative(cwd, watchPath).split(sep).join("/");
      if (!rel || rel.startsWith("..")) return false; // the root itself
      return rel
        .split("/")
        .some((s) => ALWAYS_IGNORE_DIRS.includes(s));
    },
    ignoreInitial: true, // only react to changes made while watching
    persistent: true,
    awaitWriteFinish: {
      // Guard against reviewing a half-written file; pairs with our debounce.
      stabilityThreshold: 200,
      pollInterval: 50,
    },
  });

  const handle = (absPath: string): void => {
    const relPath = relative(cwd, absPath);
    if (!isReviewable(absPath, relPath, userPatterns)) return;

    const normalized = relPath.split(sep).join("/");
    const existing = timers.get(normalized);
    if (existing) clearTimeout(existing);

    timers.set(
      normalized,
      setTimeout(() => {
        timers.delete(normalized);
        debugLog(`Watch: change settled for ${normalized}`);
        onChange(normalized);
      }, debounceMs)
    );
  };

  watcher.on("add", handle);
  watcher.on("change", handle);
  watcher.on("error", (err) => debugLog(`Watch error: ${String(err)}`));

  return {
    close: async () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      await watcher.close();
    },
  };
}