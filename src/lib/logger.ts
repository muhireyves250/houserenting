import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "space-rental" },
  redact: {
    paths: ["password", "*.password", "newPassword", "*.newPassword", "token", "*.token", "headers.cookie", "headers.authorization"],
    censor: "[redacted]",
  },
});
