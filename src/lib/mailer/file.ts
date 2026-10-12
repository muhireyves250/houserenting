import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MailMessage, Mailer } from "./types";

export class FileMailer implements Mailer {
  constructor(private readonly dir: string) {}

  async send(message: MailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2));
  }
}
