"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { DOCS } from "@/lib/docs";

/**
 * Docs sidebar nav. Highlights the active page. The /docs index maps to the
 * getting-started entry so it reads as "selected" on the landing doc page.
 */
export function DocsSidebar() {
  const pathname = usePathname();

  const isActive = (slug: string) =>
    pathname === `/docs/${slug}` ||
    (slug === "getting-started" && pathname === "/docs");

  return (
    <nav className="flex flex-col gap-1">
      <p className="text-text-tertiary mb-2 px-3 font-mono text-[11px] tracking-widest uppercase">
        Documentation
      </p>
      {DOCS.map((d) => {
        const active = isActive(d.slug);
        return (
          <Link
            key={d.slug}
            href={`/docs/${d.slug}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-surface text-jaguar font-medium"
                : "text-text-secondary hover:text-text-primary hover:bg-surface/60"
            }`}
          >
            {d.title}
          </Link>
        );
      })}
    </nav>
  );
}
