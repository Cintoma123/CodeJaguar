import type { TerminalScript } from "../types";

/** jaguar security (CLAUDE.md §4.5). */
export const securityScript: TerminalScript = {
  command: "jaguar security",
  lines: [
    { text: "⬡ codejaguar v1.0.0 · anthropic/claude · scanning", color: "header", speed: 18, pauseAfter: 120 },
    { text: "Running 8 security modules...", color: "meta", speed: 18, pauseAfter: 300 },
    { text: "", color: "meta" },
    { text: "[1/8] Secret scanner         ✓  no secrets found", color: "low", speed: 14, pauseAfter: 60 },
    { text: "[2/8] Dependency scanner     ✗  2 vulnerabilities", color: "critical", speed: 14, pauseAfter: 60 },
    { text: "[3/8] Dockerfile             ✗  1 issue", color: "high", speed: 14, pauseAfter: 60 },
    { text: "[4/8] Docker Compose         ✓  clean", color: "low", speed: 14, pauseAfter: 60 },
    { text: "[5/8] GitHub Actions         ✗  1 issue", color: "high", speed: 14, pauseAfter: 60 },
    { text: "[6/8] Environment files      ✓  clean", color: "low", speed: 14, pauseAfter: 60 },
    { text: "[7/8] .gitignore gaps        ✗  1 gap", color: "high", speed: 14, pauseAfter: 60 },
    { text: "[8/8] Source code            ✓  no issues", color: "low", speed: 14, pauseAfter: 300 },
    { text: "", color: "meta" },
    { text: "● CRITICAL  Dependency · package.json", color: "critical", speed: 22, delay: 120, pauseAfter: 120 },
    { text: "  lodash@4.17.15 → CVE-2021-23337 prototype pollution", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Upgrade to lodash@4.17.21", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "● HIGH  Dockerfile · Dockerfile:8", color: "high", speed: 22, delay: 120, pauseAfter: 120 },
    { text: "  Container runs as root, no USER instruction", color: "arg", speed: 25, pauseAfter: 100 },
    { text: "  → Add USER nonroot before CMD", color: "rec", speed: 20, pauseAfter: 350 },
    { text: "", color: "meta" },
    { text: "✓ Scan complete · 0 critical · 2 high · 1 medium · 2.1s", color: "done", speed: 15, pauseAfter: 200 },
  ],
};
