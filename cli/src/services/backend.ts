/**
 * Backend lifecycle manager.
 *
 * The backend starts automatically before any command that needs it (via
 * ensureBackend) and survives terminal closure (detached + unref), so it keeps
 * running between commands — the user never starts or restarts it by hand.
 *
 * Port model: the backend self-assigns a free port on startup and writes it to
 * ~/.jaguar/backend.port (and its PID to ~/.jaguar/backend.pid). The CLI only
 * ever reads these — it never picks the port itself.
 *
 * Public surface:
 * - isBackendRunning() — fast health probe; runs before every command
 * - ensureBackend()    — start-if-needed; the single pre-command entry point
 * - waitForBackend()   — poll until healthy, with a bounded timeout
 * - stopBackend()      — SIGTERM the backend (used by `jaguar stop` only)
 * - getBackendPort() / findBackendDir() / healthCheck() — helpers
 */

import { existsSync, readFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawn, execSync } from "node:child_process";
import { get } from "node:http";

import { debugLog } from "../utils/logger.js";
import { ensureSetup, getVenvPython, type StatusFn } from "./setup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JAGUAR_DIR = join(homedir(), ".jaguar");
const PORT_FILE = join(JAGUAR_DIR, "backend.port");
const PID_FILE = join(JAGUAR_DIR, "backend.pid");

/**
 * Get the backend port from the port file.
 */
export function getBackendPort(): number | null {
  if (!existsSync(PORT_FILE)) {
    return null;
  }
  try {
    const port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    return isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

/**
 * Get the backend PID from the PID file.
 */
function getBackendPid(): number | null {
  if (!existsSync(PID_FILE)) {
    return null;
  }
  try {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Check if a process is still running.
 */
function isProcessRunning(pid: number): boolean {
  try {
    // On Windows, tasklist checks if a process exists
    execSync(`tasklist /FI "PID eq ${pid}" /NH`, { stdio: "pipe" });
    const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
      stdio: "pipe",
    })
      .toString()
      .trim();
    return output.includes(String(pid));
  } catch {
    return false;
  }
}

/**
 * GET /health on the given port. Resolves true only on HTTP 200, false on any
 * error (connection refused, non-200, timeout). On a live localhost server this
 * returns in well under 50ms; the 1000ms timeout only bounds the failure case,
 * which keeps the fast path (backend already running) cheap.
 */
export async function healthCheck(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = get(`http://127.0.0.1:${port}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
      res.resume();
    });

    req.on("error", () => {
      resolve(false);
    });

    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Fast "is the backend up?" probe used before every command. Reads the port the
 * backend last wrote and health-checks it. Returns false when no port is known
 * yet (first run) or the server isn't answering.
 */
export async function isBackendRunning(): Promise<boolean> {
  const port = getBackendPort();
  if (!port) return false;
  return healthCheck(port);
}

/**
 * Poll until the backend answers /health, or throw once timeoutMs elapses.
 * Polls every 300ms. Used after spawning the process to wait for readiness.
 */
export async function waitForBackend(timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendRunning()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    "Backend failed to start. Run `jaguar doctor` to diagnose."
  );
}

/**
 * Ensure the backend is running. If not, start it.
 * Returns the port the backend is listening on.
 */
export async function ensureBackend(onStatus?: StatusFn): Promise<number> {
  // Fast path: a healthy backend is already listening — return its port with no
  // output and no extra work. This is the common case on every command.
  const existingPort = getBackendPort();
  if (existingPort && (await healthCheck(existingPort))) {
    debugLog(`Backend already running on port ${existingPort}`);
    return existingPort;
  }
  if (existingPort) {
    debugLog(`Backend on port ${existingPort} is not healthy, restarting...`);
  }

  // Cold start (first run, or a dead/stale process): bring it up.
  return await startBackend(onStatus);
}

/**
 * Start the FastAPI backend as a child process. On first run this also creates
 * the isolated Python venv and installs the backend dependencies (see
 * setup.ts), reporting progress through onStatus when provided.
 */
async function startBackend(onStatus?: StatusFn): Promise<number> {
  if (!existsSync(JAGUAR_DIR)) {
    mkdirSync(JAGUAR_DIR, { recursive: true });
  }

  // Find the backend directory
  // The backend is located relative to the CLI package
  const backendDir = findBackendDir();
  if (!backendDir) {
    throw new Error(
      "Could not find CodeJaguar backend directory. " +
        "Make sure the package is installed correctly."
    );
  }

  debugLog(`Starting backend from ${backendDir}`);

  // First-run bootstrap: create ~/.jaguar/venv and install deps if needed.
  // Fast no-op on every subsequent run.
  await ensureSetup(backendDir, { onStatus });

  const pythonPath = getVenvPython();
  if (!existsSync(pythonPath)) {
    throw new Error(
      "Backend Python environment is missing. Run `jaguar setup` to repair it."
    );
  }

  onStatus?.("Starting backend…");

  // Detached + unref so the backend outlives this CLI invocation and the
  // terminal it was launched from. stdio is ignored — it self-daemonizes.
  // main.py self-assigns a free port and writes ~/.jaguar/backend.{port,pid}.
  const child = spawn(pythonPath, ["main.py"], {
    cwd: backendDir,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  debugLog(`Backend process started with PID ${child.pid}`);

  // Wait for the server to answer /health (throws on timeout with a message
  // that points at `jaguar doctor`).
  await waitForBackend();

  const port = getBackendPort();
  if (!port) {
    throw new Error(
      "Backend started but never reported its port. Run `jaguar doctor` to diagnose."
    );
  }
  debugLog(`Backend started successfully on port ${port}`);
  return port;
}

/**
 * Find the backend directory (bundled at the package root as backend/).
 */
export function findBackendDir(): string | null {
  // Check relative to this file's location
  // cli/src/services/backend.ts -> backend/ is at ../../backend/
  const candidates = [
    join(__dirname, "..", "..", "..", "backend"),
    join(__dirname, "..", "..", "backend"),
  ];

  for (const candidate of candidates) {
    const resolved = join(candidate, "main.py");
    if (existsSync(resolved)) {
      return candidate;
    }
  }

  // Check if running from the installed package
  const pkgDir = join(__dirname, "..", "..", "backend");
  if (existsSync(join(pkgDir, "main.py"))) {
    return pkgDir;
  }

  return null;
}

/**
 * Stop the backend process.
 */
export async function stopBackend(): Promise<void> {
  const pid = getBackendPid();
  if (pid && isProcessRunning(pid)) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" });
      debugLog(`Stopped backend process PID ${pid}`);
    } catch (e) {
      debugLog(`Failed to stop backend process PID ${pid}: ${e}`);
    }
  }

  // Clean up files
  try {
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
    if (existsSync(PORT_FILE)) unlinkSync(PORT_FILE);
  } catch {
    // Ignore cleanup errors
  }
}
