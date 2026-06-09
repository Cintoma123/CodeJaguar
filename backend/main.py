"""
CodeJaguar Backend — FastAPI entry point.

Runs on localhost only. Started by the CLI on first command.
"""

import os
import socket
import sys

from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(
    title="CodeJaguar Backend",
    description="Local AI Code Review and DevSecOps backend",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(router)


@app.get("/")
async def root():
    return {"message": "CodeJaguar Backend is running."}


def _find_available_port() -> int:
    """Find a random available port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _save_port(port: int) -> None:
    """Save the port to ~/.jaguar/backend.port for CLI discovery."""
    jaguar_dir = os.path.expanduser("~/.jaguar")
    os.makedirs(jaguar_dir, exist_ok=True)
    port_file = os.path.join(jaguar_dir, "backend.port")
    with open(port_file, "w") as f:
        f.write(str(port))


def _save_pid() -> None:
    """Save the current PID to ~/.jaguar/backend.pid for lifecycle management."""
    jaguar_dir = os.path.expanduser("~/.jaguar")
    os.makedirs(jaguar_dir, exist_ok=True)
    pid_file = os.path.join(jaguar_dir, "backend.pid")
    with open(pid_file, "w") as f:
        f.write(str(os.getpid()))


if __name__ == "__main__":
    import uvicorn

    port = _find_available_port()
    _save_port(port)
    _save_pid()

    print(f"CodeJaguar Backend starting on http://127.0.0.1:{port}")
    print(f"Port saved to ~/.jaguar/backend.port")
    print(f"PID saved to ~/.jaguar/backend.pid")

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )
