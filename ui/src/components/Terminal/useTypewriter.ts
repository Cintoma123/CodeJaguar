"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalScript } from "./types";

export type RenderedLine = {
  text: string;
  color: string;
  /** Index into types.ts TermColor — kept as the raw color key. */
  done: boolean;
};

type UseTypewriterOptions = {
  /** Auto-start playback on mount. */
  autoStart?: boolean;
  /** Loop after this many ms idle once finished. 0 disables looping. */
  loopAfter?: number;
  /** Called once a full playback finishes. */
  onFinished?: () => void;
};

const PROMPT_SPEED = 45; // ms/char for the "$ jaguar review" line
const ENTER_PAUSE = 400; // ms after the command, before output streams

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scripted typewriter playback engine (CLAUDE.md §4.4).
 *
 * Returns the lines rendered so far (the last one may be mid-typing), whether
 * the cursor should show, the playing state, and a `replay()` trigger.
 */
export function useTypewriter(
  script: TerminalScript,
  { autoStart = true, loopAfter = 0, onFinished }: UseTypewriterOptions = {}
) {
  const [lines, setLines] = useState<{ text: string; color: string }[]>([]);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  // Single source of truth for every pending timer so we can cancel cleanly.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runId = useRef(0);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const wait = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const id = setTimeout(resolve, ms);
      timers.current.push(id);
    });
  }, []);

  const play = useCallback(async () => {
    const myRun = ++runId.current;
    clearTimers();
    setLines([]);
    setFinished(false);
    setPlaying(true);

    const alive = () => myRun === runId.current;
    const reduced = prefersReducedMotion();

    // Reduced motion: show everything at once, no typing.
    if (reduced) {
      const prompt = { text: `$ ${script.command}`, color: "command" };
      const body = script.lines.map((l) => ({ text: l.text, color: l.color }));
      setLines([prompt, ...body]);
      setPlaying(false);
      setFinished(true);
      onFinishedRef.current?.();
      return;
    }

    // 1. Type the prompt line: "$ jaguar review"
    const prompt = `$ ${script.command}`;
    setLines([{ text: "", color: "command" }]);
    for (let i = 1; i <= prompt.length; i++) {
      if (!alive()) return;
      setLines([{ text: prompt.slice(0, i), color: "command" }]);
      await wait(PROMPT_SPEED);
    }

    // 2. Pause (Enter key + server response)
    await wait(ENTER_PAUSE);
    if (!alive()) return;

    // 3. Stream each scripted line
    for (const line of script.lines) {
      if (!alive()) return;
      if (line.delay) await wait(line.delay);

      // Append an empty slot for this line.
      setLines((prev) => [...prev, { text: "", color: line.color }]);

      if (line.text.length === 0) {
        if (line.pauseAfter) await wait(line.pauseAfter);
        continue;
      }

      const speed = line.speed ?? 22;
      for (let i = 1; i <= line.text.length; i++) {
        if (!alive()) return;
        const partial = line.text.slice(0, i);
        setLines((prev) => {
          const next = [...prev];
          next[next.length - 1] = { text: partial, color: line.color };
          return next;
        });
        await wait(speed);
      }
      if (line.pauseAfter) await wait(line.pauseAfter);
    }

    if (!alive()) return;
    setPlaying(false);
    setFinished(true);
    onFinishedRef.current?.();

    // 4. Optional auto-replay after idle.
    if (loopAfter > 0) {
      await wait(loopAfter);
      if (alive()) play();
    }
  }, [script, clearTimers, wait, loopAfter]);

  const replay = useCallback(() => {
    play();
  }, [play]);

  // Start / restart whenever the script changes.
  useEffect(() => {
    if (autoStart) {
      play();
    }
    return () => {
      runId.current++; // invalidate the in-flight run
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  return { lines, playing, finished, replay };
}
