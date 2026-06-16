import { Reveal } from "./Reveal";
import { StatCounter } from "./StatCounter";

const STATS = [
  { value: 8, suffix: "", label: "Security scan modules" },
  { value: 9, suffix: "+", label: "Dependency ecosystems" },
  { value: 0, suffix: "", label: "Cloud dependencies" },
];

const QUOTES = [
  {
    quote:
      "Finally a review tool that doesn't ship my proprietary code to someone else's servers. It runs on my key, on my machine, and the security scan caught a leaked token before it hit our history.",
    name: "Mara Voss",
    role: "Staff Engineer, fintech",
    initials: "MV",
    color: "text-prompt",
  },
  {
    quote:
      "The architecture command found a circular dependency we'd been ignoring for a year. Consensus mode across two providers cut the noise down to findings I actually act on.",
    name: "Devin Okafor",
    role: "DevSecOps Lead",
    initials: "DO",
    color: "text-low",
  },
];

/**
 * Social proof (CLAUDE.md §5.7). Count-up stats above two developer quotes.
 */
export function SocialProof() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 lg:py-28">
      <div className="grid gap-6 sm:grid-cols-3">
        {STATS.map((s) => (
          <Reveal
            key={s.label}
            className="bg-surface border-border-dim rounded-[10px] border px-6 py-8 text-center"
          >
            <div className="text-text-primary">
              <StatCounter value={s.value} suffix={s.suffix} />
            </div>
            <div className="text-text-secondary mt-2 text-xs">{s.label}</div>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {QUOTES.map((q, i) => (
          <Reveal
            key={q.name}
            delay={i * 80}
            className="bg-surface border-border-dim rounded-[10px] border p-6"
          >
            <p className="text-text-primary text-[13px] leading-6 italic">“{q.quote}”</p>
            <div className="mt-5 flex items-center gap-3">
              <span
                className={`bg-surface-raised border-border-dim flex h-9 w-9 items-center justify-center rounded-full border font-mono text-xs font-semibold ${q.color}`}
              >
                {q.initials}
              </span>
              <div className="leading-tight">
                <div className="text-text-primary text-[13px] font-medium">{q.name}</div>
                <div className="text-text-tertiary text-[11px]">{q.role}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
