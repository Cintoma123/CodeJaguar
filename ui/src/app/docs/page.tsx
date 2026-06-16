import type { Metadata } from "next";
import { DocPage } from "@/components/docs/DocPage";
import { getDocContent } from "@/components/docs/registry";

export const metadata: Metadata = {
  title: "Docs — Getting Started · Codejaguar",
  description:
    "Install CodeJaguar and run your first local-first AI code review in a few minutes.",
};

/**
 * The /docs index serves the Getting Started guide directly, so landing on the
 * docs takes you straight into setup rather than a link list.
 */
export default function DocsIndex() {
  const doc = getDocContent("getting-started");
  if (!doc) return null;
  return <DocPage slug="getting-started">{doc}</DocPage>;
}
