/**
 * Terminal playback types (CLAUDE.md §4.4).
 *
 * The live terminal is a scripted playback UI — not a real emulator. Each
 * command is a list of coloured lines, each typed out character by character.
 */

export type TermColor =
  | "prompt" // green $ symbol
  | "keyword" // purple `jaguar`
  | "arg" // off-white command args
  | "path" // blue file paths
  | "meta" // grey dim/meta text
  | "header" // hex header line
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "rec" // green → recommendation
  | "done"; // green ✓ complete

export type TerminalLine = {
  /** Text to print. Empty string renders a blank gap line. */
  text: string;
  color: TermColor;
  /** ms pause before this line starts printing. */
  delay?: number;
  /** ms per character while typing. */
  speed?: number;
  /** ms pause after the line finishes. */
  pauseAfter?: number;
};

export type TerminalScript = {
  /** e.g. "jaguar review" */
  command: string;
  lines: TerminalLine[];
};

export type CommandKey = "review" | "security" | "architecture";
