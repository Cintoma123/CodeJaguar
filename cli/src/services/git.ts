/**
 * Git context extraction service.
 *
 * Extracts git diff, log, changed files, and file tree by shelling out to the
 * system `git` (via execSync).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { debugLog } from "../utils/logger.js";

export interface GitDiffResult {
  diff: string;
  changedFiles: string[];
  commits: string[];
}

/**
 * Run a git command and return stdout.
 */
function git(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Whether `cwd` is inside a git working tree.
 */
export function isGitRepository(cwd?: string): boolean {
  return git("rev-parse --is-inside-work-tree", cwd) === "true";
}

/**
 * Whether the repo has at least one commit (i.e. HEAD resolves).
 * A freshly `git init`-ed repo with no commits has no HEAD, which breaks
 * diff/log commands — callers should detect this and message clearly.
 */
export function hasCommits(cwd?: string): boolean {
  return git("rev-parse --verify HEAD", cwd) !== "";
}

/**
 * Get the git diff (staged + unstaged changes).
 */
export function getDiff(since?: string, cwd?: string): string {
  const range = since ? since : "HEAD";
  return git(`diff ${range}`, cwd);
}

/**
 * Get the full diff from main branch.
 */
export function getFullDiff(baseBranch: string, cwd?: string): string {
  const currentBranch = git("branch --show-current", cwd);
  if (!currentBranch) {
    // Detached HEAD or no commits
    return git("diff HEAD", cwd);
  }
  return git(`diff ${baseBranch}...HEAD`, cwd);
}

/**
 * Get the list of changed files.
 */
export function getChangedFiles(since?: string, cwd?: string): string[] {
  const range = since ? since : "HEAD";
  const output = git(`diff --name-only ${range}`, cwd);
  if (!output) return [];
  return output.split("\n").filter((f) => f.length > 0);
}

/**
 * Get recent commit messages.
 */
export function getRecentCommits(count: number = 10, cwd?: string): string[] {
  const output = git(`log --oneline -${count}`, cwd);
  if (!output) return [];
  return output.split("\n").filter((c) => c.length > 0);
}

/**
 * Get the file tree (directory listing).
 */
export function getFileTree(
  depth: number = 3,
  cwd?: string
): string {
  // Use git ls-files for tracked files, with depth limiting
  const output = git(`ls-files | head -200`, cwd);
  if (!output) {
    // Fallback to dir listing
    try {
      const tree = execSync(`tree -L ${depth} -I "node_modules|.git|dist|__pycache__|.venv" --noreport`, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return tree.trim();
    } catch {
      return "";
    }
  }
  return output;
}

/**
 * Read file content safely (with size limit).
 */
export function readFileContent(
  filePath: string,
  maxSize: number = 50000,
  cwd?: string
): string {
  const fullPath = cwd ? join(cwd, filePath) : filePath;
  if (!existsSync(fullPath)) {
    return "";
  }
  try {
    const content = readFileSync(fullPath, "utf-8");
    if (content.length > maxSize) {
      return content.substring(0, maxSize) + "\n... (truncated)";
    }
    return content;
  } catch {
    return "";
  }
}

/**
 * Collect all context needed for a review command.
 */
export function collectReviewContext(
  since?: string,
  cwd?: string
): GitDiffResult {
  const diff = getDiff(since, cwd);
  const changedFiles = getChangedFiles(since, cwd);
  const commits = getRecentCommits(10, cwd);

  debugLog(`Collected context: ${changedFiles.length} files, ${commits.length} commits`);

  return { diff, changedFiles, commits };
}
