/**
 * Consensus service — multi-model review orchestration helpers.
 *
 * Consensus mode runs the same review across every configured provider and
 * keeps only findings that multiple models agree on, reducing false positives.
 * See CLAUDE.md §10.3.
 */

import { listCredentials } from "../providers/keychain.js";
import type { ReviewFinding } from "../types/review.js";

// Suffixes used for keychain metadata entries (not real providers).
const METADATA_SUFFIXES = ["_base_url", "_type"];

/**
 * A finding that survived consensus, annotated with the providers that
 * reported it.
 */
export interface ConsensusFinding extends ReviewFinding {
  agreedBy: string[];
}

/**
 * List provider names that have a stored API key (excludes metadata entries).
 */
export async function listConfiguredProviders(): Promise<string[]> {
  const all = await listCredentials();
  return all.filter(
    (name) => !METADATA_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

/**
 * Normalize a string into a set of significant word tokens for comparison.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3) // drop short/common words
  );
}

/**
 * Jaccard similarity between two token sets (0..1).
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Decide whether two findings describe the same underlying issue.
 *
 * Heuristic (same file required):
 *  - Close line numbers + same category → same issue (strong locus evidence).
 *  - Close line numbers + modest description overlap → same issue.
 *  - Otherwise, a high description similarity alone → same issue.
 */
function isSameFinding(a: ReviewFinding, b: ReviewFinding): boolean {
  if ((a.file || "") !== (b.file || "")) return false;

  const sameCategory =
    (a.category || "").toLowerCase() === (b.category || "").toLowerCase();

  // If both have numeric lines close together, treat as the same locus.
  const al = a.line ? parseInt(String(a.line), 10) : NaN;
  const bl = b.line ? parseInt(String(b.line), 10) : NaN;
  const linesClose = !isNaN(al) && !isNaN(bl) && Math.abs(al - bl) <= 3;

  const descSim = jaccard(tokenize(a.description), tokenize(b.description));

  if (linesClose) {
    return sameCategory || descSim >= 0.25;
  }
  return descSim >= 0.5;
}

/**
 * Merge per-provider findings into consensus findings.
 *
 * @param byProvider  Array of { provider, findings } from each model run.
 * @param minAgree    Minimum number of providers that must report a finding.
 * @returns Findings reported by ≥ minAgree distinct providers, each annotated
 *          with the set of agreeing providers, sorted by agreement then severity.
 */
export function dedupeConsensus(
  byProvider: Array<{ provider: string; findings: ReviewFinding[] }>,
  minAgree = 2
): ConsensusFinding[] {
  // Build clusters of semantically-equivalent findings across providers.
  const clusters: Array<{ rep: ReviewFinding; providers: Set<string> }> = [];

  for (const { provider, findings } of byProvider) {
    for (const finding of findings) {
      const existing = clusters.find((c) => isSameFinding(c.rep, finding));
      if (existing) {
        existing.providers.add(provider);
      } else {
        clusters.push({ rep: finding, providers: new Set([provider]) });
      }
    }
  }

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  return clusters
    .filter((c) => c.providers.size >= minAgree)
    .map((c) => ({ ...c.rep, agreedBy: [...c.providers].sort() }))
    .sort((a, b) => {
      // More agreement first, then more severe.
      if (b.agreedBy.length !== a.agreedBy.length) {
        return b.agreedBy.length - a.agreedBy.length;
      }
      const av = severityOrder[a.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
      const bv = severityOrder[b.severity.toUpperCase() as keyof typeof severityOrder] ?? 4;
      return av - bv;
    });
}
