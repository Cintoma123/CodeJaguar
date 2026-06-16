import { Reveal } from "./Reveal";
import { InstallTabs } from "./InstallTabs";
import { ArrowRight } from "@/lib/icons";

/**
 * Final CTA (CLAUDE.md §5.8). One last push to install, generous padding.
 */
export function FinalCTA() {
  return (
    <section id="docs" className="mx-auto max-w-3xl px-5 py-24 text-center lg:py-32">
      <Reveal className="flex flex-col items-center">
        <h2 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Start reviewing in 2 minutes.
        </h2>
        <p className="text-text-secondary mt-4 max-w-md text-base leading-7">
          No signup. No config file. No cloud. Just install and go.
        </p>

        <div className="mt-8 w-full max-w-md">
          <InstallTabs size="lg" className="w-full" />
        </div>

        <a
          href="/docs"
          className="bg-jaguar hover:bg-jaguar-dim mt-6 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-medium text-term-black transition-colors"
        >
          Read the docs
          <ArrowRight size={16} />
        </a>
      </Reveal>
    </section>
  );
}
