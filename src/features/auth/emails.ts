import { createTranslator } from "next-intl";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import type { MailMessage } from "@/lib/mailer/types";

type EmailInput = { to: string; name: string; url: string; locale?: string | null };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Kind = "verify" | "reset" | "existing";

const COPY = {
  verify: { subject: "verifySubject", body: "verifyBody", button: "verifyButton" },
  reset: { subject: "resetSubject", body: "resetBody", button: "resetButton" },
  existing: { subject: "existingSubject", body: "existingBody", button: "existingButton" },
} as const;

function render(kind: Kind, { to, name, url, locale }: EmailInput): MailMessage {
  const lang = toAppLocale(locale);
  const t = createTranslator({ locale: lang, messages: catalogs[lang], namespace: "Emails" });
  const subject = t(COPY[kind].subject);
  const body = t(COPY[kind].body);
  const button = t(COPY[kind].button);
  const greeting = t("greeting", { name });
  const href = escapeHtml(url);

  const html = `<!doctype html>
<html lang="${lang}"><body style="margin:0;background:#f2f2f2;font-family:Inter,Arial,sans-serif;color:#1a1c1e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#0057b8;padding-bottom:24px">Space Rental</td></tr>
<tr><td style="font-size:16px;padding-bottom:8px">${escapeHtml(greeting)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:24px">${escapeHtml(body)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${href}" style="display:inline-block;background:#0057b8;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">${escapeHtml(button)}</a></td></tr>
<tr><td style="font-size:13px;color:#6b7075;padding-bottom:8px">${escapeHtml(t("linkFallback"))}</td></tr>
<tr><td style="font-size:13px;word-break:break-all;padding-bottom:24px"><a href="${href}" style="color:#0057b8">${href}</a></td></tr>
<tr><td style="font-size:13px;color:#6b7075">${escapeHtml(t("ignore"))}</td></tr>
</table>
<p style="font-size:12px;color:#6b7075">${escapeHtml(t("footer"))}</p>
</td></tr></table></body></html>`;

  const text = [greeting, body, url, t("ignore"), t("footer")].join("\n\n");
  return { to, subject, html, text };
}

export function buildVerificationEmail(input: EmailInput): MailMessage {
  return render("verify", input);
}

export function buildPasswordResetEmail(input: EmailInput): MailMessage {
  return render("reset", input);
}

/** Sent when someone signs up with an email that already has an account (no account enumeration in the UI). */
export function buildExistingAccountEmail(input: EmailInput): MailMessage {
  return render("existing", input);
}
