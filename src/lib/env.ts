import { z } from "zod";

/** Accepts what people paste into hosting dashboards: trims spaces and quotes, adds https://, drops a trailing slash. */
const siteUrl = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  let url = value.trim().replace(/^["']|["']$/g, "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}, z.url());

const schema = z
  .object({
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: siteUrl,
    MAIL_DRIVER: z.enum(["resend", "file", "memory"]).default("file"),
    MAIL_FROM: z.string().min(3).default("Space Rental <no-reply@spacerental.rw>"),
    MAIL_OUTBOX_DIR: z.string().min(1).default(".mail-outbox"),
    RESEND_API_KEY: z.string().optional(),
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY is required when MAIL_DRIVER=resend" });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return schema.parse(source);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
