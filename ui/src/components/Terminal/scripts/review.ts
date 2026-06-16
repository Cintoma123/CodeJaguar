import type { TerminalScript } from "../types";

/** jaguar review (CLAUDE.md §4.5). */
export const reviewScript: TerminalScript = {
  command: "jaguar review",
  lines: [
    { text: "⬡ codejaguar v1.0.0 · openai/gpt-4o · 3 findings", color: "header", speed: 18, pauseAfter: 120 },
    { text: "Analyzing git diff HEAD~1 · 4 files changed", color: "meta", speed: 18, pauseAfter: 300 },
    { text: "", color: "meta" },
    { text: "● HIGH   Performance · src/users/service.ts:47", color: "high", speed: 22, delay: 150, pauseAfter: 120 },
    { text: "  N+1 query pattern detected inside loop", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Batch with whereIn() outside the loop", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "● MEDIUM  Code smell · src/auth/middleware.ts:23", color: "medium", speed: 22, delay: 150, pauseAfter: 120 },
    { text: "  Magic number 86400 used without named constant", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Extract to SESSION_TTL_SECONDS = 86400", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "● LOW    Refactoring · src/utils/format.ts:12", color: "low", speed: 22, delay: 150, pauseAfter: 120 },
    { text: "  Function handles 3 unrelated concerns", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Split into formatDate(), formatCurrency()", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "✓ Review complete · 3 findings · 1.4s", color: "done", speed: 15, pauseAfter: 200 },
  ],
};
