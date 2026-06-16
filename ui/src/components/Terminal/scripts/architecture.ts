import type { TerminalScript } from "../types";

/** jaguar architecture (CLAUDE.md §4.5). */
export const architectureScript: TerminalScript = {
  command: "jaguar architecture",
  lines: [
    { text: "⬡ codejaguar v1.0.0 · deepseek · analysing", color: "header", speed: 18, pauseAfter: 120 },
    { text: "Mapping project structure · 47 files · 6 modules", color: "meta", speed: 18, pauseAfter: 300 },
    { text: "", color: "meta" },
    { text: "● HIGH  Circular dependency detected", color: "high", speed: 22, delay: 150, pauseAfter: 120 },
    { text: "  src/services/auth.ts → src/utils/token.ts → src/services/auth.ts", color: "arg", speed: 22, pauseAfter: 100 },
    { text: "  → Extract token logic to a shared domain module", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "● MEDIUM  Layer violation", color: "medium", speed: 22, delay: 150, pauseAfter: 120 },
    { text: "  Infrastructure module importing from domain layer", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Reverse dependency via interface abstraction", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "● LOW  God module risk", color: "low", speed: 22, delay: 150, pauseAfter: 120 },
    { text: "  src/index.ts handles 6 unrelated responsibilities", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Decompose into focused command handlers", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "✓ Architecture review complete · 3 findings · 1.8s", color: "done", speed: 15, pauseAfter: 200 },
  ],
};
