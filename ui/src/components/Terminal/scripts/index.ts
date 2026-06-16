import type { CommandKey, TerminalScript } from "../types";
import { reviewScript } from "./review";
import { securityScript } from "./security";
import { architectureScript } from "./architecture";

export const SCRIPTS: Record<CommandKey, TerminalScript> = {
  review: reviewScript,
  security: securityScript,
  architecture: architectureScript,
};

export const COMMAND_ORDER: CommandKey[] = ["review", "security", "architecture"];

export { reviewScript, securityScript, architectureScript };
