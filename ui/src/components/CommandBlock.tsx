"use client";

import { useCallback, useRef, useState } from "react";
import { Copy, Check } from "@/lib/icons";

/**
 * Terminal-styled install command with copy-to-clipboard. The leading `$` is
 * green (prompt), the rest off-white, matching the in-terminal colour system.
 */
export function CommandBlock({
  command,
  size = "sm",
  className = "",
}: {
  command: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    });
  }, [command]);

  const pad = size === "lg" ? "px-5 py-4 text-sm sm:text-base" : "px-3.5 py-2.5 text-[13px]";

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy command: ${command}`}
      className={`group bg-surface-raised border-border-dim hover:border-border-bright flex items-center gap-3 rounded-md border font-mono transition-colors ${pad} ${className}`}
    >
      <span className="text-jaguar select-none">$</span>
      <span className="text-text-primary flex-1 text-left whitespace-nowrap">{command}</span>
      <span className="text-text-tertiary group-hover:text-text-secondary shrink-0 transition-colors">
        {copied ? <Check size={16} className="text-jaguar" /> : <Copy size={16} />}
      </span>
    </button>
  );
}
