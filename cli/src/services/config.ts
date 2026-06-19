/**
 * CLI preferences store.
 *
 * Non-secret CLI configuration (e.g. the first-run splash flag, default
 * provider). Uses the `conf` package pointed at ~/.jaguar/config.json so it
 * lives alongside the backend port/pid files and never touches the encrypted
 * credentials store (which `keychain.ts` keeps in the OS config directory).
 */

import Conf from "conf";
import { homedir } from "node:os";
import { join } from "node:path";

const store = new Conf({
  cwd: join(homedir(), ".jaguar"),
  configName: "config",
  projectName: "codejaguar",
});

/**
 * Whether the one-time splash screen has already been shown.
 */
export function hasSeenSplash(): boolean {
  return store.get("splash_seen") === true;
}

/**
 * Record that the splash screen has been shown so it never shows again.
 */
export function markSplashSeen(): void {
  store.set("splash_seen", true);
}

export interface UpdateCache {
  /** Epoch ms of the last npm registry query (success or failure). */
  lastCheck?: number;
  /** Latest version reported by npm at the last successful query. */
  latestVersion?: string;
}

/**
 * Read the cached update-check state. The checker only hits the network when
 * this is stale, so most commands pay zero network cost.
 */
export function getUpdateCache(): UpdateCache {
  return {
    lastCheck: store.get("update_last_check") as number | undefined,
    latestVersion: store.get("update_latest_version") as string | undefined,
  };
}

/**
 * Persist the update-check state. lastCheck is recorded even on a failed query
 * so a flaky network doesn't make every command retry.
 */
export function setUpdateCache(cache: UpdateCache): void {
  if (cache.lastCheck !== undefined) store.set("update_last_check", cache.lastCheck);
  if (cache.latestVersion !== undefined) {
    store.set("update_latest_version", cache.latestVersion);
  }
}
