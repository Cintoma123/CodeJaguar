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
