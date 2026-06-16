import type { ReactNode } from "react";
import { GettingStarted } from "./pages/GettingStarted";
import { Commands } from "./pages/Commands";
import { Providers } from "./pages/Providers";
import { Advanced } from "./pages/Advanced";

/**
 * Slug → native doc element. This replaces the old Markdown loader: docs are
 * rendered as first-class React UI, so there is no filesystem read and no
 * react-markdown in the bundle. Imported only by the /docs route files (server
 * components), never by the client sidebar — keeps each page out of others' JS.
 *
 * The map holds elements (not component references) so route files render a
 * precomputed node rather than instantiating a component during render.
 */
const REGISTRY: Record<string, ReactNode> = {
  "getting-started": <GettingStarted />,
  commands: <Commands />,
  providers: <Providers />,
  advanced: <Advanced />,
};

export function getDocContent(slug: string): ReactNode | null {
  return REGISTRY[slug] ?? null;
}
