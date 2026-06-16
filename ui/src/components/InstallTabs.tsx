"use client";

import { useCallback, useRef, useState } from "react";
import { Copy, Check } from "@/lib/icons";

/**
 * Install command with an npm / bun toggle and copy-to-clipboard. CodeJaguar
 * installs with either package manager, so the site shows both rather than
 * implying bun-only. The leading `$` is the green prompt; the command body is
 * off-white, matching the terminal colour system.
 */
const MANAGERS = [
  { id: "npm", command: "npm install -g codejaguar-cli" },
  { id: "bun", command: "bun install -g codejaguar-cli" },
] as const;

type ManagerId = (typeof MANAGERS)[number]["id"];

export function InstallTabs({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const [active, setActive] = useState<ManagerId>("npm");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const command = MANAGERS.find((m) => m.id === active)!.command;

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    });
  }, [command]);

  const pad = size === "lg" ? "px-5 py-4 text-sm sm:text-base" : "px-3.5 py-2.5 text-[13px]";

  return (
    <div className={`bg-surface-raised border-border-dim overflow-hidden rounded-md border ${className}`}>
      {/* Tab row */}
      <div className="border-border-dim flex border-b">
        {MANAGERS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActive(m.id)}
            aria-pressed={active === m.id}
            className={`px-4 py-2 font-mono text-xs transition-colors ${
              active === m.id
                ? "text-jaguar border-jaguar border-b-2"
                : "text-text-tertiary hover:text-text-secondary border-b-2 border-transparent"
            }`}
          >
            {m.id}
          </button>
        ))}
      </div>

      {/* Command row */}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy command: ${command}`}
        className={`group flex w-full items-center gap-3 font-mono transition-colors ${pad}`}
      >
        <span className="text-jaguar select-none">$</span>
        <span className="text-text-primary flex-1 text-left whitespace-nowrap">{command}</span>
        <span className="text-text-tertiary group-hover:text-text-secondary shrink-0 transition-colors">
          {copied ? <Check size={16} className="text-jaguar" /> : <Copy size={16} />}
        </span>
      </button>
    </div>
  );
}
