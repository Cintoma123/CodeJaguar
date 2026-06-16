import { Reveal } from "./Reveal";

const PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "groq",
  "mistral",
  "ollama",
  "together",
  "cohere",
  "openrouter",
  "perplexity",
  "+ any openai-compatible",
];

/**
 * Provider section (CLAUDE.md §5.6). Centred copy above a marquee of provider
 * pills that scrolls horizontally and pauses on hover. The list is duplicated
 * so the -50% scroll loops seamlessly.
 */
export function ProviderSection() {
  return (
    <section id="providers" className="mx-auto max-w-6xl px-5 py-20 text-center lg:py-28">
      <Reveal>
        <p className="text-jaguar mb-3 font-mono text-xs tracking-widest uppercase">
          Providers
        </p>
        <h2 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
          Works with any provider. Bring your own key.
        </h2>
      </Reveal>

      <div className="marquee relative mt-10 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee-track flex w-max gap-3">
          {[...PROVIDERS, ...PROVIDERS].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="bg-surface border-border-dim text-text-secondary shrink-0 rounded-full border px-4 py-1.5 font-mono text-[13px]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      <p className="text-text-tertiary mt-8 font-mono text-xs">
        Keys stored in OS keychain. Never in files. Never logged.
      </p>
    </section>
  );
}
