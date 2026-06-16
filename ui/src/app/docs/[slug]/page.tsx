import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "@/components/docs/DocPage";
import { getAllSlugs, DOCS } from "@/lib/docs";
import { getDocContent } from "@/components/docs/registry";

/** Pre-render every doc page at build time. */
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = DOCS.find((d) => d.slug === slug);
  if (!meta) return { title: "Docs · Codejaguar" };
  return {
    title: `${meta.title} · Codejaguar Docs`,
    description: meta.blurb,
  };
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDocContent(slug);
  if (!doc) notFound();
  return <DocPage slug={slug}>{doc}</DocPage>;
}
