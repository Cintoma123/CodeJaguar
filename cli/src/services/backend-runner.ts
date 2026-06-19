/**
 * Detached backend wrapper.
 *
 * This file is launched by startBackend() as its own *Node* process
 * (`node dist/services/backend-runner.js`) with detached:true. Node detaches
 * cleanly on Windows and survives the terminal that ran the jaguar command —
 * `detached` alone on the uvicorn child does not. The runner then owns the
 * uvicorn lifecycle: it picks the port, launches uvicorn, and stays alive so
 * the OS keeps the whole tree (node → uvicorn) running between commands.
 *
 * It writes its OWN pid to ~/.jaguar/backend.pid; stopBackend() reads that pid
 * and `taskkill /t` (Windows) / SIGTERM (Unix) tears down the whole tree.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JAGUAR_DIR = join(homedir(), ".jaguar");
const VENV_DIR = join(JAGUAR_DIR, "venv");
const PORT_FILE = join(JAGUAR_DIR, "backend.port");
const PID_FILE = join(JAGUAR_DIR, "backend.pid");

const debug = process.env.JAGUAR_DEBUG === "1";

/** venv uvicorn executable, cross-platform. */
function getUvicornPath(): string {
  return platform() === "win32"
    ? join(VENV_DIR, "Scripts", "uvicorn.exe")
    : join(VENV_DIR, "bin", "uvicorn");
}

/**
 * Directory that contains main.py (the `main:app` ASGI module), passed to
 * uvicorn as --app-dir. Resolves both layouts: the published package bundles
 * backend at cli/backend, while the dev checkout keeps it at the repo root.
 */
function getBackendAppDir(): string {
  const candidates = [
    join(__dirname, "..", "..", "backend"), // published: cli/backend
    join(__dirname, "..", "..", "..", "backend"), // dev: repo-root/backend
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "main.py"))) return dir;
  }
  // Fall back to the published layout; uvicorn will surface a clear error if
  // main.py is genuinely absent.
  return candidates[0]!;
}

/** Bind to port 0 to let the OS hand us a free port, then release it. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const { port } = addr;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not determine a free port")));
      }
    });
  });
}

async function main(): Promise<void> {
  if (!existsSync(JAGUAR_DIR)) mkdirSync(JAGUAR_DIR, { recursive: true });

  const uvicornPath = getUvicornPath();
  const backendAppDir = getBackendAppDir();
  const port = await findFreePort();

  // Publish the port before launching uvicorn so the CLI can start polling
  // /health immediately; writes our own pid so stopBackend() can kill the tree.
  writeFileSync(PORT_FILE, String(port), "utf-8");
  writeFileSync(PID_FILE, String(process.pid), "utf-8");

  const child = spawn(
    uvicornPath,
    [
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--app-dir",
      backendAppDir,
    ],
    {
      stdio: debug ? "inherit" : "ignore",
      windowsHide: true,
    }
  );

  // If uvicorn dies, there is nothing left to wrap — exit so we don't leave a
  // stale runner (and stale pid file) behind.
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  const shutdown = (): void => {
    try {
      child.kill();
    } catch {
      // already gone
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Keep the Node event loop alive indefinitely so the process (and therefore
  // the detached tree) persists between jaguar commands.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  if (debug) {
    console.error(err);
  }
  process.exit(1);
});