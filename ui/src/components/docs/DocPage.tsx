import Link from "next/link";
import type { ReactNode } from "react";
import { DOCS } from "@/lib/docs";
import { ArrowRight } from "@/lib/icons";

/**
 * Renders one native doc (passed as children) plus a prev/next pager based on
 * DOCS order. The doc body is React UI — no Markdown is parsed at runtime.
 */
export function DocPage({ slug, children }: { slug: string; children: ReactNode }) {
  const idx = DOCS.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? DOCS[idx - 1] : null;
  const next = idx >= 0 && idx < DOCS.length - 1 ? DOCS[idx + 1] : null;

  return (
    <article>
      {children}

      {(prev || next) && (
        <div className="border-border-dim mt-12 flex items-stretch gap-4 border-t pt-8">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="border-border-dim hover:border-border-bright group flex flex-1 flex-col gap-1 rounded-lg border p-4 transition-colors"
            >
              <span className="text-text-tertiary text-xs">← Previous</span>
              <span className="text-text-primary group-hover:text-jaguar text-sm font-medium transition-colors">
                {prev.title}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="border-border-dim hover:border-border-bright group flex flex-1 flex-col items-end gap-1 rounded-lg border p-4 text-right transition-colors"
            >
              <span className="text-text-tertiary flex items-center gap-1 text-xs">
                Next <ArrowRight size={12} />
              </span>
              <span className="text-text-primary group-hover:text-jaguar text-sm font-medium transition-colors">
                {next.title}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      )}
    </article>
  );
}
