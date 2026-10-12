import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = ".e2e-mail";

type StoredMail = { to: string; subject: string; text: string; html: string; sentAt: string };

export async function waitForMail(to: string, timeoutMs = 20_000): Promise<StoredMail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await readdir(DIR).catch(() => [] as string[]);
    const mails = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(DIR, f), "utf8")) as StoredMail));
    const mine = mails.filter((m) => m.to === to).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    if (mine.length) return mine[mine.length - 1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms`);
}

export function firstLink(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("No link in email");
  return match[0];
}

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
