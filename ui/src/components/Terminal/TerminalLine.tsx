import type { ReactNode } from "react";

const COLOR_CLASS: Record<string, string> = {
  prompt: "text-jaguar",
  keyword: "text-prompt",
  arg: "text-text-primary",
  path: "text-medium",
  meta: "text-text-secondary",
  header: "text-jaguar",
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
  rec: "text-jaguar",
  done: "text-jaguar",
  command: "text-text-primary",
};

/**
 * Render the "$ jaguar <args>" command line with segment colours:
 * green `$`, purple `jaguar`, off-white args.
 */
function renderCommandLine(text: string): ReactNode {
  // text looks like "$ jaguar review" (possibly partially typed).
  if (!text.startsWith("$")) return text;
  const rest = text.slice(1); // drop the $
  // Split the remainder into the jaguar keyword and the args.
  const match = rest.match(/^(\s*)(jaguar)?(.*)$/);
  if (!match) return text;
  const [, space, keyword, args] = match;
  return (
    <>
      <span className="text-jaguar">$</span>
      {space}
      {keyword && <span className="text-prompt">{keyword}</span>}
      {args && <span className="text-text-primary">{args}</span>}
    </>
  );
}

export function TerminalLine({
  text,
  color,
  showCursor = false,
}: {
  text: string;
  color: string;
  showCursor?: boolean;
}) {
  const cls = COLOR_CLASS[color] ?? "text-text-primary";
  const isCommand = color === "command";

  return (
    <div className={`whitespace-pre-wrap break-words ${cls}`}>
      {isCommand ? renderCommandLine(text) : text || " "}
      {showCursor && (
        <span className="text-jaguar animate-blink ml-0.5 inline-block">▌</span>
      )}
    </div>
  );
}
