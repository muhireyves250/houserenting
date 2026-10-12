import { getEnv } from "@/lib/env";
import { FileMailer } from "./file";
import { MemoryMailer } from "./memory";
import { ResendMailer } from "./resend";
import type { Mailer } from "./types";

export type { MailMessage, Mailer } from "./types";
export { FileMailer, MemoryMailer, ResendMailer };

let instance: Mailer | undefined;

export function getMailer(): Mailer {
  if (instance) return instance;
  const env = getEnv();
  if (env.MAIL_DRIVER === "resend") instance = new ResendMailer(env.RESEND_API_KEY!, env.MAIL_FROM);
  else if (env.MAIL_DRIVER === "memory") instance = new MemoryMailer();
  else instance = new FileMailer(env.MAIL_OUTBOX_DIR);
  return instance;
}

export function setMailerForTests(mailer: Mailer | undefined): void {
  instance = mailer;
}
