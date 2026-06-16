import type { ReactNode } from "react";

/**
 * Native doc primitives — the building blocks every doc page composes from.
 * These replace the old react-markdown renderer: instead of parsing Markdown at
 * build time, each doc is authored as JSX using these components, so the docs
 * are first-class React UI styled in lockstep with the rest of the site.
 *
 * All are server components (no client hooks) except CodeBlock, which is its own
 * "use client" file because it copies to clipboard.
 */

/** Page lead: big mono title + supporting paragraph. */
export function DocHeader({ title, lead }: { title: string; lead: ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="text-text-primary font-mono text-[2rem] leading-tight font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-text-secondary mt-3 text-[15px] leading-7">{lead}</p>
    </header>
  );
}

/** A titled section with a top divider. `id` enables in-page anchor links. */
export function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border-dim mt-10 scroll-mt-24 border-t pt-8" id={id}>
      <h2 className="text-text-primary font-mono text-[1.4rem] font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Sub-heading inside a Section. */
export function SubHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="text-text-primary mt-8 scroll-mt-24 font-mono text-[1.1rem] font-semibold"
    >
      {children}
    </h3>
  );
}

/** Body paragraph. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-text-secondary mt-4 text-[15px] leading-7">{children}</p>;
}

/** Emphasised inline text. */
export function B({ children }: { children: ReactNode }) {
  return <strong className="text-text-primary font-semibold">{children}</strong>;
}

/** Inline code token. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="bg-surface-raised border-border-dim text-text-primary rounded-[5px] border px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
}

/** Site-internal or external link, styled jaguar-green. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className="text-jaguar decoration-jaguar/30 hover:decoration-jaguar underline underline-offset-2"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/** Unordered list with jaguar `›` bullets. Pass <Li> children. */
export function List({ children }: { children: ReactNode }) {
  return <ul className="mt-4 flex flex-col gap-2">{children}</ul>;
}

export function Li({ children }: { children: ReactNode }) {
  return (
    <li className="text-text-secondary relative pl-5 text-[15px] leading-7">
      <span className="text-jaguar absolute left-0 select-none">›</span>
      {children}
    </li>
  );
}

/** Ordered list with mono numerals. Pass <OLi> children. */
export function OL({ children }: { children: ReactNode }) {
  return <ol className="mt-4 flex flex-col gap-2">{children}</ol>;
}

export function OLi({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="text-text-secondary relative pl-7 text-[15px] leading-7">
      <span className="text-jaguar absolute left-0 font-mono text-sm select-none">
        {n}.
      </span>
      {children}
    </li>
  );
}

/**
 * Callout / note box. `tone` tints the left rule and icon dot:
 * note (jaguar), warn (high/amber).
 */
export function Callout({
  tone = "note",
  children,
}: {
  tone?: "note" | "warn";
  children: ReactNode;
}) {
  const rule = tone === "warn" ? "border-high" : "border-jaguar";
  return (
    <div
      className={`bg-surface text-text-secondary my-5 rounded-r-lg border-l-[3px] ${rule} px-4 py-3 text-[14px] leading-7`}
    >
      {children}
    </div>
  );
}

type Row = ReactNode[];

/**
 * Bordered table. `head` is the header cells, `rows` a list of cell-arrays.
 * Cells accept any ReactNode so you can embed <Code> etc.
 */
export function Table({ head, rows }: { head: ReactNode[]; rows: Row[] }) {
  return (
    <div className="border-border-dim my-5 overflow-x-auto rounded-[10px] border">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="bg-surface">
            {head.map((h, i) => (
              <th
                key={i}
                className="text-text-primary border-border-dim border-b px-3.5 py-2.5 text-left font-mono text-[0.8rem] font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-border-dim last:border-0 border-b">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="text-text-secondary px-3.5 py-2.5 align-top leading-6"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
