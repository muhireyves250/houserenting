import "server-only";
import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";

export type UploadTicket = { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string };

/** Cloudinary's request signature: sorted params joined with &, then the secret, SHA-1 in hex. */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(query + secret).digest("hex");
}

function config() {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = getEnv();
  return cloudName && apiKey && secret ? { cloudName, apiKey, secret } : null;
}

export function uploadsEnabled(): boolean {
  return config() !== null;
}

/** Where uploaded images live; photos from anywhere else are refused. */
export function uploadedImagePrefix(): string | null {
  const c = config();
  return c ? `https://res.cloudinary.com/${c.cloudName}/image/upload/` : null;
}

/** A short-lived permission for the browser to upload one image straight to our Cloudinary folder. */
export function uploadTicket(folder: string, now: Date = new Date()): UploadTicket | null {
  const c = config();
  if (!c) return null;
  const timestamp = Math.floor(now.getTime() / 1000);
  return { cloudName: c.cloudName, apiKey: c.apiKey, timestamp, folder, signature: signParams({ folder, timestamp }, c.secret) };
}
