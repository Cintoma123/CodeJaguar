/**
 * Credential storage using `conf` — cross-platform, zero native dependencies.
 *
 * Values are encrypted at rest in the OS-appropriate config directory via
 * conf's `encryptionKey`. Note: because the key ships with the app, this is
 * obfuscation against casual disk inspection, NOT protection against an
 * attacker who controls the machine — it is weaker than an OS-native keychain.
 *
 * Keys are stored under the namespace: codejaguar/<provider-name>
 */

import Conf from "conf";

const config = new Conf({
  projectName: "codejaguar",
  encryptionKey: "codejaguar-credential-store-v1",
  defaults: {},
});

/**
 * Store a credential.
 */
export async function storeCredential(
  provider: string,
  apiKey: string
): Promise<void> {
  config.set(`credentials.${provider}`, apiKey);
}

/**
 * Retrieve a credential.
 */
export async function getCredential(
  provider: string
): Promise<string | null> {
  const value = config.get(`credentials.${provider}`);
  return typeof value === "string" ? value : null;
}

/**
 * Delete a credential.
 */
export async function deleteCredential(
  provider: string
): Promise<boolean> {
  if (!config.has(`credentials.${provider}`)) {
    return false;
  }
  config.delete(`credentials.${provider}`);
  return true;
}

/**
 * List all stored provider names (never exposes keys).
 */
export async function listCredentials(): Promise<string[]> {
  const creds = config.get("credentials");
  if (!creds || typeof creds !== "object" || Array.isArray(creds)) {
    return [];
  }
  return Object.keys(creds as Record<string, string>);
}
