"use client";

import { useEffect, useState } from "react";
import { Hexagon, Github, Star, ArrowRight } from "@/lib/icons";
import { GITHUB_URL, fetchStarCount, formatStars } from "@/lib/github";

const LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Commands", href: "/docs/commands" },
  { label: "Providers", href: "/docs/providers" },
  { label: "GitHub", href: GITHUB_URL },
];

/**
 * Top nav (CLAUDE.md §5.1). Fixed, solid background (no blur), gains a bottom
 * border on scroll. Live GitHub star count with graceful fallback.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchStarCount(ctrl.signal).then(setStars);
    return () => ctrl.abort();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-term-black transition-colors ${
        scrolled ? "border-border-dim border-b" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a href="#" className="flex items-center gap-2">
          <Hexagon size={20} className="text-jaguar" />
          <span className="font-mono text-[15px] font-medium tracking-tight">Codejaguar</span>
        </a>

        <div className="text-text-secondary hidden items-center gap-7 text-sm md:flex">
          {LINKS.slice(0, 3).map((l) => (
            <a key={l.label} href={l.href} className="hover:text-text-primary transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary border-border-dim hover:border-border-bright hover:text-text-primary hidden items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors sm:flex"
          >
            <Github size={15} />
            <span className="flex items-center gap-1">
              <Star size={13} className="text-high" />
              {stars !== null ? formatStars(stars) : "Star"}
            </span>
          </a>
          <a
            href="#install"
            className="bg-jaguar hover:bg-jaguar-dim flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium text-term-black transition-colors"
          >
            Get started
            <ArrowRight size={14} />
          </a>
        </div>
      </nav>
    </header>
  );
}
