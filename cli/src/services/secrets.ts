/**
 * Standalone secret scanner — fast, deterministic, no backend required.
 *
 * Used by `jaguar protect` for the pre-commit git hook. Ports the regex
 * registry from the Python backend (app/security/secrets.py) so commits can
 * be scanned instantly without spinning up the FastAPI backend or calling AI.
 */

import { execSync } from "node:child_process";

export interface SecretPattern {
  name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  pattern: RegExp;
}

export interface SecretMatch {
  name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  file: string;
  line: number;
  redacted: string;
}

// Mirrors SECRET_PATTERNS in backend/app/security/secrets.py.
const SECRET_PATTERNS: SecretPattern[] = [
  // CRITICAL
  { name: "OpenAI API Key", severity: "CRITICAL", pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: "Anthropic API Key", severity: "CRITICAL", pattern: /sk-ant-[a-zA-Z0-9-]{20,}/ },
  { name: "AWS Access Key ID", severity: "CRITICAL", pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/ },
  {
    name: "AWS Secret Access Key",
    severity: "CRITICAL",
    pattern: /(?:aws_secret_access_key|aws_secret|secretAccessKey)\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]/i,
  },
  { name: "GCP Service Account JSON", severity: "CRITICAL", pattern: /"type"\s*:\s*"service_account"/ },
  { name: "Azure Connection String", severity: "CRITICAL", pattern: /DefaultEndpointsProtocol=https;AccountName=/ }, // jaguar-ignore-line (pattern definition, not a real secret)
  { name: "Private RSA/EC Key", severity: "CRITICAL", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Stripe Secret Key", severity: "CRITICAL", pattern: /sk_(?:live|test)_[a-zA-Z0-9]{24,}/ },
  { name: "GitHub Personal Access Token", severity: "CRITICAL", pattern: /ghp_[a-zA-Z0-9]{36,}/ },
  { name: "Slack Token", severity: "CRITICAL", pattern: /xox[bprs]-[a-zA-Z0-9-]{10,}/ },
  // HIGH
  { name: "JWT Token", severity: "HIGH", pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/ },
  {
    name: "Database Connection String",
    severity: "HIGH",
    pattern: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^/\s:]+:[^@\s]+@/i,
  },
  {
    name: "Generic Password Assignment",
    severity: "HIGH",
    pattern: /(?:password|passwd|pwd|secret|token|api_key|apikey|access_key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
  // MEDIUM
  {
    name: "High-Entropy String",
    severity: "MEDIUM",
    pattern: /(?:secret|key|token|password)\s*[:=]\s*['"][A-Za-z0-9+/=]{32,}['"]/i,
  },
];

/**
 * Inline allow-list markers. A line containing `jaguar-ignore` (or
 * `jaguar-ignore-line`) is skipped by the scanner — used to silence
 * legitimate false positives such as the pattern definitions in this very
 * file. Mirrors the backend's IGNORE_MARKERS.
 */
const IGNORE_MARKERS = ["jaguar-ignore-line", "jaguar-ignore"];

function hasIgnoreMarker(line: string): boolean {
  return IGNORE_MARKERS.some((marker) => line.includes(marker));
}

/**
 * Scan a single file's content against all secret patterns.
 */
export function scanContent(filePath: string, content: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split("\n");

  for (const { name, severity, pattern } of SECRET_PATTERNS) {
    lines.forEach((line, idx) => {
      const stripped = line.trim();
      // Skip obvious comment lines (basic heuristic, matches the backend).
      if (stripped.startsWith("//") || stripped.startsWith("#") || stripped.startsWith("*")) {
        return;
      }
      // Skip lines explicitly marked as a known-safe false positive.
      if (hasIgnoreMarker(line)) {
        return;
      }
      const m = pattern.exec(line);
      if (m) {
        matches.push({
          name,
          severity,
          file: filePath,
          line: idx + 1,
          redacted: line.replace(pattern, "██████████").trim().slice(0, 120),
        });
      }
    });
  }

  return matches;
}

/**
 * Run a git command and return stdout (empty string on failure).
 */
function git(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 20,
    });
  } catch {
    return "";
  }
}

/**
 * List staged file paths (added/copied/modified, not deletions).
 */
export function getStagedFiles(cwd?: string): string[] {
  const out = git("diff --cached --name-only --diff-filter=ACM", cwd);
  return out.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Scan all staged files (their staged blob contents) for secrets.
 */
export function scanStagedFiles(cwd?: string): SecretMatch[] {
  const results: SecretMatch[] = [];
  for (const file of getStagedFiles(cwd)) {
    // Read the staged version of the blob, not the working-tree copy.
    const content = git(`show :${file}`, cwd);
    if (content) {
      results.push(...scanContent(file, content));
    }
  }
  return results;
}
