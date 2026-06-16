/**
 * First-run backend setup.
 *
 * The published package bundles the Python backend source but not its
 * dependencies. On first use we create an isolated virtualenv at
 * `~/.jaguar/venv` and install the backend's requirements into it, so
 * `jaguar review` works on a clean machine that only has Python + Node.
 *
 * Subsequent runs are a fast no-op: a marker file records which requirement set
 * is installed, so we only re-install when the bundled requirements change
 * (e.g. after a CLI upgrade) or when the user runs `jaguar setup --force`.
 *
 * The backend itself always runs from this venv — never the system Python —
 * which is why getVenvPython() is the single source of truth for the
 * interpreter that backend.ts spawns.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { debugLog } from "../utils/logger.js";

const JAGUAR_DIR = join(homedir(), ".jaguar");
const VENV_DIR = join(JAGUAR_DIR, "venv");
/** Records the requirements signature currently installed in the venv. */
const DEPS_MARKER = join(VENV_DIR, ".jaguar-deps");

/** Minimum Python the backend supports (kept in sync with pyproject.toml). */
const MIN_PYTHON: readonly [number, number] = [3, 10];

/** Mirrors backend/requirements.txt; used only if that file isn't bundled. */
const FALLBACK_DEPS = [
  "fastapi>=0.136.3",
  "httpx>=0.28.1",
  "keyring>=25.7.0",
  "pydantic>=2.13.4",
  "uvicorn>=0.49.0",
];

const PIP_EXEC_OPTS = {
  stdio: "pipe" as const,
  maxBuffer: 16 * 1024 * 1024, // pip output on failure can be large
};

export type StatusFn = (message: string) => void;

/** Absolute path to the venv's Python interpreter (may not exist yet). */
export function getVenvPython(): string {
  return platform() === "win32"
    ? join(VENV_DIR, "Scripts", "python.exe")
    : join(VENV_DIR, "bin", "python");
}

export function venvPythonExists(): boolean {
  return existsSync(getVenvPython());
}

export interface SystemPython {
  path: string;
  version: [number, number];
}

/**
 * Find a system Python interpreter that satisfies the minimum version. Used
 * only to *create* the venv — the backend always runs from the venv afterwards.
 */
export function findSystemPython(): SystemPython | null {
  const candidates =
    platform() === "win32" ? ["python", "python3", "py"] : ["python3", "python"];
  for (const candidate of candidates) {
    const version = pythonVersion(candidate);
    if (version && atLeast(version, MIN_PYTHON)) {
      return { path: candidate, version };
    }
  }
  return null;
}

function atLeast(v: [number, number], min: readonly [number, number]): boolean {
  return v[0] > min[0] || (v[0] === min[0] && v[1] >= min[1]);
}

function pythonVersion(exe: string): [number, number] | null {
  try {
    const out = execFileSync(
      exe,
      ["-c", "import sys; print('%d.%d' % sys.version_info[:2])"],
      { stdio: ["ignore", "pipe", "ignore"] }
    )
      .toString()
      .trim();
    const m = out.match(/^(\d+)\.(\d+)$/);
    if (!m) return null;
    return [parseInt(m[1]!, 10), parseInt(m[2]!, 10)];
  } catch {
    return null;
  }
}

function requirementsPath(backendDir: string): string {
  return join(backendDir, "requirements.txt");
}

/** Stable signature of the requirement set, so we know when to re-install. */
function depsSignature(backendDir: string): string {
  const reqPath = requirementsPath(backendDir);
  const body = existsSync(reqPath)
    ? readFileSync(reqPath, "utf-8")
    : FALLBACK_DEPS.join("\n");
  // "v1" is a layout/schema tag — bump it if the venv strategy ever changes.
  return "v1:" + createHash("sha256").update(body).digest("hex").slice(0, 16);
}

/** True when a venv exists and already has exactly this requirement set. */
export function isSetupValid(backendDir: string): boolean {
  if (!venvPythonExists() || !existsSync(DEPS_MARKER)) return false;
  try {
    return readFileSync(DEPS_MARKER, "utf-8").trim() === depsSignature(backendDir);
  } catch {
    return false;
  }
}

export interface EnsureSetupOptions {
  force?: boolean;
  onStatus?: StatusFn;
}

/**
 * Ensure the backend venv exists with its dependencies installed. Fast no-op
 * once set up. Throws a clear, actionable error if Python is missing or the
 * install fails.
 */
export async function ensureSetup(
  backendDir: string,
  opts: EnsureSetupOptions = {}
): Promise<void> {
  const onStatus = opts.onStatus ?? (() => {});
  if (!opts.force && isSetupValid(backendDir)) {
    debugLog("Backend venv already set up.");
    return;
  }
  runSetup(backendDir, onStatus, opts.force ?? false);
}

function runSetup(backendDir: string, onStatus: StatusFn, force: boolean): void {
  const sys = findSystemPython();
  if (!sys) {
    throw new Error(
      `Python ${MIN_PYTHON[0]}.${MIN_PYTHON[1]}+ is required but was not found on your PATH.\n` +
        "Install it from https://www.python.org/downloads/ and run `jaguar setup`."
    );
  }
  debugLog(`Using system Python ${sys.version.join(".")} at ${sys.path}`);

  if (!existsSync(JAGUAR_DIR)) mkdirSync(JAGUAR_DIR, { recursive: true });

  // (Re)create the venv.
  if (force && existsSync(VENV_DIR)) {
    onStatus("Removing existing backend environment…");
    rmSync(VENV_DIR, { recursive: true, force: true });
  }
  if (!venvPythonExists()) {
    onStatus("Setting up the CodeJaguar backend (first run, ~30s)…");
    try {
      execFileSync(sys.path, ["-m", "venv", VENV_DIR], PIP_EXEC_OPTS);
    } catch (e) {
      throw new Error(
        "Failed to create the Python virtual environment.\n" +
          "On Debian/Ubuntu you may need: sudo apt install python3-venv\n" +
          tail(e)
      );
    }
  }

  const venvPython = getVenvPython();
  const reqPath = requirementsPath(backendDir);

  onStatus("Installing backend dependencies…");
  try {
    // Upgrade pip first — old pips trip over modern resolver/metadata.
    execFileSync(
      venvPython,
      ["-m", "pip", "install", "--upgrade", "pip", "--quiet", "--disable-pip-version-check"],
      PIP_EXEC_OPTS
    );
    const installArgs = existsSync(reqPath)
      ? ["-m", "pip", "install", "-r", reqPath, "--quiet", "--disable-pip-version-check"]
      : ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", ...FALLBACK_DEPS];
    execFileSync(venvPython, installArgs, PIP_EXEC_OPTS);
  } catch (e) {
    throw new Error(
      "Failed to install backend dependencies into the virtual environment.\n" + tail(e)
    );
  }

  writeFileSync(DEPS_MARKER, depsSignature(backendDir), "utf-8");
  onStatus("Backend ready.");
  debugLog("Backend venv setup complete.");
}

/** Quick check that the venv python can import the backend's core deps. */
export function verifyBackendDeps(): boolean {
  if (!venvPythonExists()) return false;
  try {
    execFileSync(
      getVenvPython(),
      ["-c", "import fastapi, uvicorn, httpx, keyring, pydantic"],
      { stdio: "pipe" }
    );
    return true;
  } catch {
    return false;
  }
}

/** Last few lines of a failed child process's stderr, for actionable errors. */
function tail(e: unknown): string {
  if (e && typeof e === "object" && "stderr" in e) {
    const stderr = (e as { stderr?: Buffer | string }).stderr;
    if (stderr) {
      return String(stderr).trim().split("\n").slice(-6).join("\n");
    }
  }
  return e instanceof Error ? e.message : String(e);
}