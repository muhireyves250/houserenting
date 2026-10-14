/** The last account that logged in on this device (name + email only, never a password), for "Welcome back". */
export type RememberedAccount = { name: string; email: string };

const KEY = "sr_last_account";
export const ACCOUNT_EVENT = "sr-account-change";

/** Raw stored value (a stable string) for useSyncExternalStore; parse it with `parseRemembered`. */
export function rememberedSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const tail = local.length > 1 ? local.at(-1) : "";
  return `${local.slice(0, 1)}***${tail}@${domain}`;
}

export function readRemembered(): RememberedAccount | null {
  return parseRemembered(rememberedSnapshot());
}

export function parseRemembered(raw: string): RememberedAccount | null {
  try {
    const value: unknown = JSON.parse(raw || "null");
    const account = value as RememberedAccount | null;
    return account && typeof account.name === "string" && typeof account.email === "string" ? { name: account.name, email: account.email } : null;
  } catch {
    return null;
  }
}

export function rememberAccount(account: RememberedAccount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
    window.dispatchEvent(new Event(ACCOUNT_EVENT));
  } catch {
    // Storage blocked: no "Welcome back" next time, nothing else changes.
  }
}

export function forgetAccount(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(ACCOUNT_EVENT));
  } catch {
    // Nothing stored.
  }
}
