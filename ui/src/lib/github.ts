/**
 * GitHub star-count fetcher (CLAUDE.md §5.1). Public repos return permissive
 * CORS headers, so this works from the browser. Fails silently — the Nav badge
 * falls back to no count if the repo is private, missing, or rate-limited.
 */

export const GITHUB_REPO = "Cintoma123/CodeJaguar";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

export async function fetchStarCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

/** "1234" -> "1.2k" */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
