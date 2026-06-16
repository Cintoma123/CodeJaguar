import { Hexagon } from "@/lib/icons";
import { GITHUB_URL } from "@/lib/github";

const LINKS = [
  { label: "npm", href: "https://www.npmjs.com/package/codejaguar-cli" },
  { label: "GitHub", href: GITHUB_URL },
  { label: "Docs", href: "/docs" },
  { label: "License", href: `${GITHUB_URL}/blob/main/LICENSE` },
];

/**
 * Footer (CLAUDE.md §5.9). Brand left, links right, dim top border.
 */
export function Footer() {
  return (
    <footer className="border-border-dim border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Hexagon size={18} className="text-jaguar" />
          <span className="font-mono text-sm font-medium">Codejaguar</span>
          <span className="text-text-tertiary ml-1 text-xs">MIT</span>
        </div>
        <div className="flex items-center gap-6">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-text-secondary hover:text-text-primary text-xs transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
