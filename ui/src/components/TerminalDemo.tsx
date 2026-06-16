"use client";

import { useRef, useState } from "react";
import { Terminal } from "./Terminal/Terminal";
import { SCRIPTS, COMMAND_ORDER } from "./Terminal/scripts";
import type { CommandKey } from "./Terminal/types";
import { Refresh } from "@/lib/icons";

const LABELS: Record<CommandKey, string> = {
  review: "jaguar review",
  security: "jaguar security",
  architecture: "jaguar architecture",
};

/**
 * Full-width terminal demo (CLAUDE.md §5.5). User-clickable tabs replay each
 * command from scratch (remount via `key`); a replay link re-runs the current
 * tab through the trigger Terminal exposes via onReplayReady.
 */
export function TerminalDemo() {
  const [active, setActive] = useState<CommandKey>("review");
  const replayRef = useRef<(() => void) | null>(null);

  return (
    <section className="bg-surface/40 border-border-dim border-y py-20 lg:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <div className="text-center">
          <p className="text-jaguar mb-3 font-mono text-xs tracking-widest uppercase">
            Live demo
          </p>
          <h2 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
            Watch it work
          </h2>
          <p className="text-text-secondary mx-auto mt-3 max-w-lg text-base leading-7">
            Real command output, streamed character by character. Pick a command
            and watch the review run.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
          {COMMAND_ORDER.map((cmd) => {
            const isActive = cmd === active;
            return (
              <button
                key={cmd}
                type="button"
                onClick={() => setActive(cmd)}
                className={`rounded-full border px-4 py-1.5 font-mono text-[13px] transition-colors ${
                  isActive
                    ? "border-jaguar text-jaguar bg-jaguar/10"
                    : "border-border-dim text-text-secondary hover:border-border-bright hover:text-text-primary"
                }`}
              >
                {LABELS[cmd]}
              </button>
            );
          })}
        </div>

        {/* Terminal */}
        <div className="mt-7">
          <Terminal
            key={active}
            script={SCRIPTS[active]}
            title={`codejaguar — ${LABELS[active]}`}
            minHeight={380}
            onReplayReady={(replay) => {
              replayRef.current = replay;
            }}
          />
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => replayRef.current?.()}
            className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
          >
            <Refresh size={14} />
            replay
          </button>
        </div>
      </div>
    </section>
  );
}
