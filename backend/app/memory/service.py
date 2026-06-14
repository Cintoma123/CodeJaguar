"""
Memory service — read/write .jaguar/memory.json.

Repository memory makes reviews context-aware by providing the AI with
knowledge of the codebase's intended design. Stored as JSON in the project
root under .jaguar/memory.json (no database).
"""

import json
import os

MEMORY_DIR = ".jaguar"
MEMORY_FILE = "memory.json"

DEFAULT_MEMORY = {
    "framework": "",
    "database": "",
    "architecture": "",
    "testing": "",
    "language": "",
    "patterns": [],
    "conventions": [],
    "services": [],
    "notes": "",
}


def _memory_path(cwd: str) -> str:
    return os.path.join(cwd, MEMORY_DIR, MEMORY_FILE)


def load_memory(cwd: str = ".") -> dict:
    """Load memory.json from the project root; return {} if absent/invalid."""
    path = _memory_path(cwd)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_memory(memory: dict, cwd: str = ".") -> None:
    """Write memory.json to the project root, creating .jaguar/ if needed."""
    os.makedirs(os.path.join(cwd, MEMORY_DIR), exist_ok=True)
    with open(_memory_path(cwd), "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2)


def init_memory(cwd: str = ".") -> dict:
    """Create memory.json with the default template if it doesn't exist."""
    if not load_memory(cwd):
        save_memory(DEFAULT_MEMORY, cwd)
    return load_memory(cwd)


def set_memory_field(key: str, value, cwd: str = ".") -> dict:
    """Set a single field in memory.json and persist it."""
    memory = load_memory(cwd) or dict(DEFAULT_MEMORY)
    memory[key] = value
    save_memory(memory, cwd)
    return memory
