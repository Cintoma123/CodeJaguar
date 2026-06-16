"use client";

import { useCallback, useRef, useState } from "react";
import { Terminal } from "./Terminal";
import { SCRIPTS, COMMAND_ORDER } from "./scripts";
import type { CommandKey } from "./types";

/**
 * Hero variant (CLAUDE.md §4.6): compact, auto-starts `jaguar review`, and
 * cycles through all three commands. Each finished playback advances to the
 * next command after a short idle. Remounting via `key` restarts playback.
 */
export function HeroTerminal({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const current: CommandKey = COMMAND_ORDER[index];
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinished = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setIndex((i) => (i + 1) % COMMAND_ORDER.length);
    }, 4500);
  }, []);

  return (
    <Terminal
      key={current}
      script={SCRIPTS[current]}
      title={`codejaguar — ${SCRIPTS[current].command}`}
      minHeight={300}
      onFinished={handleFinished}
      className={className}
    />
  );
}
