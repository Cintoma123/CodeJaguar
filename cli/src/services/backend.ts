/**
 * Backend lifecycle manager.
 *
 * Responsible for:
 * - Starting the FastAPI backend if not already running
 * - Health checking the backend
 * - Reading the port from ~/.jaguar/backend.port
 * - PID file management for process tracking
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawn, execSync } from "node:child_process";
import { get } from "node:http";

import { debugLog } from "../utils/logger.js";

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
 * Health check the backend.
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

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ensure the backend is running. If not, start it.
 * Returns the port the backend is listening on.
 */
export async function ensureBackend(): Promise<number> {
  // Check if we already know the port and it's healthy
  const existingPort = getBackendPort();
  if (existingPort) {
    const healthy = await healthCheck(existingPort);
    if (healthy) {
      debugLog(`Backend already running on port ${existingPort}`);
      return existingPort;
    }
    debugLog(`Backend on port ${existingPort} is not healthy, restarting...`);
  }

  // Start the backend
  return await startBackend();
}

/**
 * Start the FastAPI backend as a child process.
 */
async function startBackend(): Promise<number> {
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

  const pythonPath = findPythonPath();
  if (!pythonPath) {
    throw new Error(
      "Could not find Python 3.14. " +
        "Please install Python 3.14+ and ensure it's in your PATH."
    );
  }

  const child = spawn(pythonPath, ["main.py"], {
    cwd: backendDir,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  debugLog(`Backend process started with PID ${child.pid}`);

  // Wait for the backend to start up (poll health check)
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max wait
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const port = getBackendPort();
    if (port) {
      const healthy = await healthCheck(port);
      if (healthy) {
        debugLog(`Backend started successfully on port ${port}`);
        return port;
      }
    }

    attempts++;
  }

  throw new Error("Backend failed to start within 30 seconds.");
}

/**
 * Find the backend directory.
 */
function findBackendDir(): string | null {
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
 * Find the Python 3.14+ executable.
 */
function findPythonPath(): string | null {
  // Try common locations
  const candidates = [
    "python3",
    "python",
    join(homedir(), ".jaguar", "venv", "Scripts", "python.exe"), // Windows venv
    join(homedir(), ".jaguar", "venv", "bin", "python"), // Unix venv
  ];

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: "pipe" });
      return candidate;
    } catch {
      // Try next candidate
    }
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
