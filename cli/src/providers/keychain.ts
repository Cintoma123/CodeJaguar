/**
 * OS Keychain service for secure credential storage.
 *
 * Uses each OS's native credential manager — no third-party native addons.
 *
 *   Windows → cmdkey (Windows Credential Manager, DPAPI-encrypted)
 *   macOS   → security (macOS Keychain, AES-256-encrypted)
 *   Linux   → secret-tool (GNOME Keyring / KWallet via Secret Service API)
 *
 * Falls back to file-based storage in ~/.jaguar/credentials.json
 * if the native tool is unavailable or fails.
 *
 * Keys are stored under the namespace: codejaguar/<provider-name>
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

const SERVICE_NAME = "codejaguar";
const CREDENTIALS_DIR = join(homedir(), ".jaguar");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

type OS = "win32" | "darwin" | "linux";

function getOS(): OS {
  return platform() as OS;
}

// ── Fallback file store ──────────────────────────────

function loadCredentialsFile(): Record<string, string> {
  if (!existsSync(CREDENTIALS_FILE)) {
    return {};
  }
  try {
    const data = readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(data) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCredentialsFile(creds: Record<string, string>): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), "utf-8");
}

// ── Windows: cmdkey + PowerShell ─────────────────────

function winStore(target: string, password: string): boolean {
  try {
    // Delete existing entry first (cmdkey fails if target already exists)
    execSync(`cmdkey /delete:"${SERVICE_NAME}/${target}"`, {
      stdio: "pipe",
      timeout: 5000,
    });
  } catch {
    // Ignore — target may not exist yet
  }
  try {
    execSync(
      `cmdkey /generic:"${SERVICE_NAME}/${target}" /user:"${SERVICE_NAME}" /pass:"${password}"`,
      { stdio: "pipe", timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

function winRead(target: string): string | null {
  try {
    // cmdkey /list cannot show passwords — use Win32 CredRead API via PowerShell
    const credTarget = `${SERVICE_NAME}/${target}`;
    const psCommand = [
      "Add-Type -TypeDefinition @'",
      "using System;",
      "using System.Runtime.InteropServices;",
      "[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]",
      "public struct CREDENTIALW {",
      "  public uint Flags;",
      "  public int Type;",
      "  public string TargetName;",
      "  public string Comment;",
      "  public long LastWritten;",
      "  public uint CredentialBlobSize;",
      "  public IntPtr CredentialBlob;",
      "  public uint Persist;",
      "  public uint AttributeCount;",
      "  public IntPtr Attributes;",
      "  public string TargetAlias;",
      "  public string UserName;",
      "}",
      "public static class CredHelper {",
      '  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]',
      "  public static extern bool CredRead(string target, int type, out IntPtr credPtr);",
      '  [DllImport("advapi32.dll")]',
      "  public static extern bool CredFree(IntPtr buffer);",
      "}',",
      "'@;",
      `$p=[IntPtr]::Zero;`,
      `if([CredHelper]::CredRead('${credTarget}',1,[ref]$p)){`,
      "  $c=[Runtime.InteropServices.Marshal]::PtrToStructure($p,[Type][CREDENTIALW]);",
      "  $b=New-Object byte[] $c.CredentialBlobSize;",
      "  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob,$b,0,$c.CredentialBlobSize);",
      "  [CredHelper]::CredFree($p)|Out-Null;",
      "  [Text.Encoding]::Unicode.GetString($b)",
      "} else { '' }",
    ].join(" ");

    const result = execSync(
      `powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`,
      { stdio: "pipe", encoding: "utf-8", timeout: 10000 }
    );
    const value = result.trim();
    return value || null;
  } catch {
    return null;
  }
}

function winDelete(target: string): boolean {
  try {
    execSync(`cmdkey /delete:"${SERVICE_NAME}/${target}"`, {
      stdio: "pipe",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function winList(): string[] {
  try {
    const output = execSync("cmdkey /list", {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 5000,
    });
    const results: string[] = [];
    const prefix = `${SERVICE_NAME}/`;
    for (const line of output.split("\n")) {
      if (line.includes(prefix)) {
        const match = line.match(new RegExp(`${prefix.replace("/", "\\/")}(.+?)(?:\\s|$)`));
        if (match?.[1]) {
          results.push(match[1].trim());
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── macOS: security (Keychain CLI) ───────────────────

function macStore(target: string, password: string): boolean {
  try {
    execSync(
      `security delete-generic-password -a "${SERVICE_NAME}" -s "${SERVICE_NAME}/${target}" 2>/dev/null`,
      { stdio: "pipe", timeout: 5000 }
    );
  } catch {
    // Ignore — may not exist
  }
  try {
    execSync(
      `security add-generic-password -a "${SERVICE_NAME}" -s "${SERVICE_NAME}/${target}" -w "${password}" -U`,
      { stdio: "pipe", timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

function macRead(target: string): string | null {
  try {
    const result = execSync(
      `security find-generic-password -a "${SERVICE_NAME}" -s "${SERVICE_NAME}/${target}" -w 2>/dev/null`,
      { stdio: "pipe", encoding: "utf-8", timeout: 5000 }
    );
    const value = result.trim();
    return value || null;
  } catch {
    return null;
  }
}

function macDelete(target: string): boolean {
  try {
    execSync(
      `security delete-generic-password -a "${SERVICE_NAME}" -s "${SERVICE_NAME}/${target}" 2>/dev/null`,
      { stdio: "pipe", timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

function macList(): string[] {
  try {
    const output = execSync(
      `security dump-keychain 2>/dev/null | grep "svce" | grep "${SERVICE_NAME}/"`,
      { stdio: "pipe", encoding: "utf-8", timeout: 5000, shell: "/bin/bash" }
    );
    const prefix = `${SERVICE_NAME}/`;
    return output
      .split("\n")
      .map((line) => {
        const match = line.match(new RegExp(`${prefix.replace("/", "\\/")}(.+?)["']`));
        return match?.[1]?.trim() ?? "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Linux: secret-tool (Secret Service API) ──────────

function linuxStore(target: string, password: string): boolean {
  try {
    execSync(
      `echo -n ${JSON.stringify(password)} | secret-tool store ` +
        `--label="${SERVICE_NAME} ${target}" ` +
        `service "${SERVICE_NAME}" account "${target}"`,
      { stdio: "pipe", shell: "/bin/bash", timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

function linuxRead(target: string): string | null {
  try {
    const result = execSync(
      `secret-tool lookup service "${SERVICE_NAME}" account "${target}"`,
      { stdio: "pipe", encoding: "utf-8", timeout: 5000 }
    );
    const value = result.trim();
    return value || null;
  } catch {
    return null;
  }
}

function linuxDelete(target: string): boolean {
  try {
    execSync(
      `secret-tool clear service "${SERVICE_NAME}" account "${target}"`,
      { stdio: "pipe", timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

function linuxList(): string[] {
  try {
    const output = execSync(
      `secret-tool search service "${SERVICE_NAME}" 2>/dev/null | grep "^account:"`,
      { stdio: "pipe", encoding: "utf-8", timeout: 5000, shell: "/bin/bash" }
    );
    return output
      .split("\n")
      .map((line) => line.replace("account:", "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Public API (platform-agnostic) ───────────────────

/**
 * Check if a native OS credential tool is available.
 */
function isNativeKeychainAvailable(): boolean {
  const os = getOS();
  try {
    if (os === "win32") {
      execSync("where cmdkey", { stdio: "pipe", timeout: 3000 });
      return true;
    }
    if (os === "darwin") {
      execSync("which security", { stdio: "pipe", timeout: 3000 });
      return true;
    }
    if (os === "linux") {
      execSync("which secret-tool", { stdio: "pipe", timeout: 3000 });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// Cache the availability check so we only shell out once per process
let _nativeAvailable: boolean | null = null;

function nativeAvailable(): boolean {
  if (_nativeAvailable === null) {
    _nativeAvailable = isNativeKeychainAvailable();
  }
  return _nativeAvailable;
}

/**
 * Store a credential in the OS native credential manager (or file fallback).
 */
export async function storeCredential(
  provider: string,
  apiKey: string
): Promise<void> {
  const os = getOS();

  if (nativeAvailable()) {
    let success = false;

    if (os === "win32") {
      success = winStore(provider, apiKey);
    } else if (os === "darwin") {
      success = macStore(provider, apiKey);
    } else if (os === "linux") {
      success = linuxStore(provider, apiKey);
    }

    if (success) return;
  }

  // Fallback: file-based store
  const creds = loadCredentialsFile();
  creds[provider] = apiKey;
  saveCredentialsFile(creds);
}

/**
 * Retrieve a credential from the OS native credential manager (or file fallback).
 */
export async function getCredential(
  provider: string
): Promise<string | null> {
  const os = getOS();

  if (nativeAvailable()) {
    let value: string | null = null;

    if (os === "win32") {
      value = winRead(provider);
    } else if (os === "darwin") {
      value = macRead(provider);
    } else if (os === "linux") {
      value = linuxRead(provider);
    }

    if (value !== null) return value;
  }

  // Fallback: file-based read
  const creds = loadCredentialsFile();
  return creds[provider] ?? null;
}

/**
 * Delete a credential from the OS native credential manager (or file fallback).
 */
export async function deleteCredential(
  provider: string
): Promise<boolean> {
  const os = getOS();

  if (nativeAvailable()) {
    let success = false;

    if (os === "win32") {
      success = winDelete(provider);
    } else if (os === "darwin") {
      success = macDelete(provider);
    } else if (os === "linux") {
      success = linuxDelete(provider);
    }

    if (success) return true;
  }

  // Fallback: file-based delete
  const creds = loadCredentialsFile();
  if (provider in creds) {
    delete creds[provider];
    saveCredentialsFile(creds);
    return true;
  }
  return false;
}

/**
 * List all stored provider names (never exposes keys).
 */
export async function listCredentials(): Promise<string[]> {
  const os = getOS();

  if (nativeAvailable()) {
    let names: string[] = [];

    if (os === "win32") {
      names = winList();
    } else if (os === "darwin") {
      names = macList();
    } else if (os === "linux") {
      names = linuxList();
    }

    if (names.length > 0) return names;
  }

  // Fallback: file-based list
  const creds = loadCredentialsFile();
  return Object.keys(creds);
}
