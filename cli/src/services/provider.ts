/**
 * Shared provider resolution utilities.
 */

import { getCredential, listCredentials } from "../providers/keychain.js";

/**
 * Get the default provider from keychain.
 * Checks built-in providers first (priority order), then any generic provider.
 */
export async function getDefaultProvider(): Promise<string | null> {
  const builtIn = ["openai", "anthropic", "gemini", "deepseek"];
  for (const provider of builtIn) {
    const key = await getCredential(provider);
    if (key) {
      return provider;
    }
  }

  // Fall back to any generic provider with a stored key
  const allProviders = await listCredentials();
  for (const provider of allProviders) {
    if (!builtIn.includes(provider)) {
      return provider;
    }
  }

  return null;
}

/**
 * Built-in provider names that don't require a base_url.
 */
export const BUILT_IN_PROVIDERS = ["openai", "anthropic", "gemini", "deepseek"];

/**
 * Validate that a generic provider has a base_url configured.
 * Returns the base_url or null if missing.
 */
export async function resolveBaseUrl(provider: string): Promise<string | null> {
  if (BUILT_IN_PROVIDERS.includes(provider.toLowerCase())) {
    return null; // Built-in providers don't need a base_url
  }
  return await getCredential(`${provider}_base_url`);
}
