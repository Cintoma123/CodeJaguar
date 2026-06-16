/**
 * Docs registry (client-safe). Each doc is rendered as a native React component
 * (see components/docs/registry.tsx) — this file only holds the order, titles,
 * and metadata used by the sidebar, pager, and page <metadata>. No filesystem,
 * no Markdown, so it's safe to import from client components.
 *
 * Slugs map 1:1 to /docs/<slug> routes; getting-started is also the /docs index.
 */
export type DocMeta = {
  slug: string;
  title: string;
  /** Short description shown on page metadata. */
  blurb: string;
};

export const DOCS: DocMeta[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    blurb: "From a clean machine to your first AI code review in a few minutes.",
  },
  {
    slug: "commands",
    title: "Command Reference",
    blurb: "Every CodeJaguar command and flag, with examples.",
  },
  {
    slug: "providers",
    title: "Providers",
    blurb: "BYOK setup for OpenAI, Anthropic, Gemini, DeepSeek, and any OpenAI-compatible endpoint.",
  },
  {
    slug: "advanced",
    title: "Advanced Features",
    blurb: "Repository memory, project rules, consensus mode, and git protection.",
  },
];

export function getAllSlugs(): string[] {
  return DOCS.map((d) => d.slug);
}
