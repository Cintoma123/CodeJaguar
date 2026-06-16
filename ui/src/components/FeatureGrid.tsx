import { Reveal } from "./Reveal";
import { Code, Shield, Layers, PullRequest, Lock, Consensus } from "@/lib/icons";

const FEATURES = [
  {
    Icon: Code,
    color: "text-prompt",
    bg: "bg-prompt/10",
    title: "Code review",
    desc: "Bugs, smells, and performance issues straight from your git diff.",
  },
  {
    Icon: Shield,
    color: "text-low",
    bg: "bg-low/10",
    title: "Security scan",
    desc: "8 modules — source, secrets, deps, Docker, and GitHub Actions.",
  },
  {
    Icon: Layers,
    color: "text-high",
    bg: "bg-high/10",
    title: "Architecture review",
    desc: "Circular deps, layer violations, and structural drift detection.",
  },
  {
    Icon: PullRequest,
    color: "text-medium",
    bg: "bg-medium/10",
    title: "PR summary",
    desc: "GitHub-ready markdown summaries generated in one command.",
  },
  {
    Icon: Lock,
    color: "text-critical",
    bg: "bg-critical/10",
    title: "Git protection",
    desc: "Pre-commit hook blocks secrets before they reach your history.",
  },
  {
    Icon: Consensus,
    color: "text-jaguar",
    bg: "bg-jaguar/10",
    title: "Consensus mode",
    desc: "Multi-model agreement filter for far fewer false positives.",
  },
];

/**
 * Feature grid (CLAUDE.md §5.4). Dense 3×2 card grid, one card per command
 * surface. Still by design — no hover animation, just a border lift.
 */
export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
      <Reveal>
        <p className="text-jaguar mb-3 font-mono text-xs tracking-widest uppercase">
          What it does
        </p>
        <h2 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
          A senior engineer in your terminal
        </h2>
        <p className="text-text-secondary mt-3 max-w-xl text-base leading-7">
          One CLI, eight commands. Every report is written to a Markdown file in
          your project root — never dumped to stdout.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ Icon, color, bg, title, desc }, i) => (
          <Reveal
            key={title}
            delay={(i % 3) * 60}
            className="bg-surface border-border-dim hover:border-border-bright rounded-[10px] border p-5 transition-colors"
          >
            <div className={`mb-4 inline-flex rounded-md p-2 ${bg}`}>
              <Icon size={20} className={color} />
            </div>
            <h3 className="text-text-primary text-[15px] font-semibold">{title}</h3>
            <p className="text-text-secondary mt-1.5 text-[13px] leading-6">{desc}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
