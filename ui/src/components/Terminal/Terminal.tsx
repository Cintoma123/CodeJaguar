"use client";

import { useEffect, useRef } from "react";
import { useTypewriter } from "./useTypewriter";
import { TerminalLine } from "./TerminalLine";
import type { TerminalScript } from "./types";

type TerminalProps = {
  script: TerminalScript;
  /** Title-bar label; defaults to the command. */
  title?: string;
  /** Loop playback after this idle delay (ms). 0 = play once. */
  loopAfter?: number;
  /** Min content height. */
  minHeight?: number;
  /** Expose the replay trigger to a parent (e.g. demo replay button). */
  onReplayReady?: (replay: () => void) => void;
  /** Called once a full playback finishes (e.g. hero command cycling). */
  onFinished?: () => void;
  className?: string;
};

/**
 * Live terminal window (CLAUDE.md §4.2). A scripted playback UI — title bar
 * with traffic-light dots, then a streaming content area with a blinking
 * cursor on the last line.
 */
export function Terminal({
  script,
  title,
  loopAfter = 0,
  minHeight = 360,
  onReplayReady,
  onFinished,
  className = "",
}: TerminalProps) {
  const { lines, finished, replay } = useTypewriter(script, {
    loopAfter,
    onFinished,
  });
  const contentRef = useRef<HTMLDivElement>(null);

  // Hand the replay trigger up to the parent once.
  useEffect(() => {
    onReplayReady?.(replay);
  }, [onReplayReady, replay]);

  // Keep the latest line in view as output streams.
  useEffect(() => {
    const el = contentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const lastIndex = lines.length - 1;

  return (
    <div
      className={`bg-term-black border-border-dim overflow-hidden rounded-lg border shadow-2xl ${className}`}
    >
      {/* Title bar */}
      <div className="border-border-dim bg-surface flex items-center gap-2 border-b px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
        </span>
        <span className="text-text-secondary flex-1 text-center font-mono text-xs">
          {title ?? `codejaguar — ${script.command}`}
        </span>
        <span className="w-12" />
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="term-scroll overflow-y-auto px-4 py-4 font-mono text-[13px] leading-6 sm:text-sm"
        style={{ minHeight, maxHeight: minHeight + 120 }}
      >
        {lines.map((line, i) => (
          <TerminalLine
            key={i}
            text={line.text}
            color={line.color}
            showCursor={i === lastIndex && (finished || i > 0)}
          />
        ))}
      </div>
    </div>
  );
}
