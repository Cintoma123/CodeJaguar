import { HeroTerminal } from "./Terminal/HeroTerminal";
import { CommandBlock } from "./CommandBlock";
import { InstallTabs } from "./InstallTabs";
import { Github, ArrowRight } from "@/lib/icons";
import { GITHUB_URL } from "@/lib/github";

/**
 * Hero (CLAUDE.md §5.2). Two-column: copy + install on the left, the live
 * auto-cycling terminal on the right.
 */
export function Hero() {
  return (
    <section
      id="install"
      className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-28 pb-16 lg:grid-cols-[45fr_55fr] lg:gap-10 lg:pt-36 lg:pb-24"
    >
      {/* Left column */}
      <div className="fade-up flex flex-col items-start">
        <span className="border-border-dim text-text-secondary mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <span className="bg-jaguar h-1.5 w-1.5 rounded-full" />
          <span className="font-mono">v1.0.0 · now on npm</span>
        </span>

        <h1 className="font-mono text-[40px] leading-[1.1] font-bold tracking-tight sm:text-[52px]">
          AI code review,
          <br />
          <span className="text-jaguar">running on your machine</span>
        </h1>

        <p className="text-text-secondary mt-5 max-w-md text-base leading-7">
          Code review, security scanning, and architecture analysis from your
          git diff. No cloud, no accounts, no telemetry — bring your own API key.
        </p>

        <div className="mt-7 flex w-full max-w-md flex-col gap-2.5">
          <InstallTabs />
          <CommandBlock command="jaguar review" />
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="/docs"
            className="bg-jaguar hover:bg-jaguar-dim flex items-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-medium text-term-black transition-colors"
          >
            Get started
            <ArrowRight size={16} />
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border-dim hover:border-border-bright text-text-primary flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            <Github size={16} />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Right column — live terminal */}
      <div className="fade-in lg:justify-self-end" style={{ animationDelay: "200ms" }}>
        <HeroTerminal className="w-full lg:max-w-[520px]" />
      </div>
    </section>
  );
}
