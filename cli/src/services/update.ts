/**
 * Update checker.
 *
 * On every command the CLI compares its own version against the latest on the
 * npm registry and prints a one-line "update available" notice when it's behind.
 * This works no matter how a release was published (manual `npm publish` or a
 * GitHub Action) because the source of truth is the registry, not the repo.
 *
 * Cost control: the registry is queried at most once per CHECK_INTERVAL_MS and
 * the result is cached in ~/.jaguar/config.json, so the typical command does no
 * network I/O at all. The one query per interval is bounded by FETCH_TIMEOUT_MS
 * and fails silently (offline, registry down, package unpublished) — an update
 * check must never break or slow a real command.
 *
 * The notice prints to stderr and only in an interactive terminal, so piping a
 * command's stdout (e.g. `jaguar summary | pbcopy`) stays clean.
 */

import { readFileSync } from "node:fs";

import axios from "axios";
import chalk from "chalk";

import { getUpdateCache, setUpdateCache } from "./config.js";
import { debugLog } from "../utils/logger.js";

/** Query npm at most this often. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Hard bound on the registry request so a slow network can't stall a command. */
const FETCH_TIMEOUT_MS = 1500;

interface PackageInfo {
  name: string;
  version: string;
}

let packageInfo: PackageInfo | null = null;

/** Read name/version from the bundled package.json (works from src and dist). */
function readPackageInfo(): PackageInfo {
  if (packageInfo) return packageInfo;
  const url = new URL("../../package.json", import.meta.url);
  const raw = JSON.parse(readFileSync(url, "utf-8")) as Partial<PackageInfo>;
  packageInfo = {
    name: typeof raw.name === "string" ? raw.name : "codejaguar-cli",
    version: typeof raw.version === "string" ? raw.version : "0.0.0",
  };
  return packageInfo;
}

export function getCurrentVersion(): string {
  try {
    return readPackageInfo().version;
  } catch {
    return "0.0.0";
  }
}

export function getPackageName(): string {
  try {
    return readPackageInfo().name;
  } catch {
    return "codejaguar-cli";
  }
}

function parseVersion(v: string): [number, number, number] | null {
  const m = v.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True when `latest` is a strictly higher major.minor.patch than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) {
    if (l[i]! > c[i]!) return true;
    if (l[i]! < c[i]!) return false;
  }
  return false;
}

/** Fetch the latest published version from npm, or null on any failure. */
async function fetchLatestVersion(pkg: string): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`,
      {
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          // Ask for npm's abbreviated metadata — smaller and faster.
          Accept: "application/vnd.npm.install-v1+json, application/json",
        },
      }
    );
    const version = (res.data as { version?: unknown } | undefined)?.version;
    return typeof version === "string" ? version : null;
  } catch (error) {
    debugLog(
      `Update check failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/** Honor the de-facto opt-outs so CI logs and scripts stay quiet. */
function updatesDisabled(): boolean {
  return (
    process.env.JAGUAR_NO_UPDATE_CHECK === "1" ||
    Boolean(process.env.NO_UPDATE_NOTIFIER) ||
    Boolean(process.env.CI)
  );
}

/**
 * Check for a newer published version and print a notice if one exists. Network
 * is touched at most once per CHECK_INTERVAL_MS; otherwise this reads the cache
 * and returns near-instantly. Pass `force: true` to bypass the cache TTL.
 */
export async function checkForUpdates(opts: { force?: boolean } = {}): Promise<void> {
  if (updatesDisabled()) return;

  const current = getCurrentVersion();
  const cache = getUpdateCache();
  let latest = cache.latestVersion ?? null;

  const stale =
    opts.force ||
    !cache.lastCheck ||
    Date.now() - cache.lastCheck > CHECK_INTERVAL_MS;

  if (stale) {
    const fetched = await fetchLatestVersion(getPackageName());
    // Record the attempt even on failure so we don't retry every command.
    setUpdateCache({
      lastCheck: Date.now(),
      latestVersion: fetched ?? latest ?? undefined,
    });
    if (fetched) latest = fetched;
  }

  if (latest && isNewer(latest, current)) {
    printUpdateNotice(current, latest);
  }
}

function printUpdateNotice(current: string, latest: string): void {
  // Interactive terminals only: keep scripted/piped usage noise-free.
  if (!process.stdout.isTTY) return;

  const pkg = getPackageName();
  const notice = [
    "",
    chalk.bold.cyan("🚀 Update available!"),
    "",
    `  Current: ${chalk.gray(current)}`,
    `  Latest : ${chalk.green(latest)}`,
    "",
    "  Run:",
    `  ${chalk.cyan(`npm install -g ${pkg}@latest`)}`,
    "",
  ].join("\n");

  console.error(notice);
}