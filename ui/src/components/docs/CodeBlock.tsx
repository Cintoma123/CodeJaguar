"use client";

import { useCallback, useRef, useState } from "react";
import { Copy, Check } from "@/lib/icons";

/**
 * Multi-line, copyable code block for the native docs. Renders a terminal-style
 * panel with a copy button in the corner. `lang` is a display-only label (e.g.
 * "bash", "json"); set `prompt` to colour leading `$` lines as shell prompts.
 */
export function CodeBlock({
  code,
  lang,
  prompt = false,
}: {
  code: string;
  lang?: string;
  prompt?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    });
  }, [code]);

  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <div className="group bg-surface-raised border-border-dim relative my-5 overflow-hidden rounded-[10px] border">
      {lang && (
        <span className="text-text-tertiary border-border-dim bg-surface block border-b px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase">
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="text-text-tertiary hover:text-text-secondary absolute top-2.5 right-2.5 z-10 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={lang ? { top: "calc(0.625rem + 33px)" } : undefined}
      >
        {copied ? <Check size={15} className="text-jaguar" /> : <Copy size={15} />}
      </button>
      <pre className="term-scroll overflow-x-auto px-4 py-3.5 text-[13px] leading-relaxed">
        <code className="font-mono">
          {lines.map((line, i) => {
            const isPrompt = prompt && line.startsWith("$");
            const isComment = line.trimStart().startsWith("#");
            return (
              <span key={i} className="block">
                {isPrompt ? (
                  <>
                    <span className="text-jaguar select-none">$</span>
                    <span className="text-text-primary">{line.slice(1)}</span>
                  </>
                ) : (
                  <span className={isComment ? "text-text-tertiary" : "text-text-primary"}>
                    {line || " "}
                  </span>
                )}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
