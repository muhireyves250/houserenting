import type { UploadTicket } from "./cloudinary";

/** Sends one image from the browser straight to Cloudinary with a server-signed ticket; returns its https URL. */
export async function uploadImage(ticket: UploadTicket, file: File): Promise<{ url: string; publicId: string; width: number; height: number } | null> {
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", ticket.apiKey);
  body.append("timestamp", String(ticket.timestamp));
  body.append("folder", ticket.folder);
  body.append("signature", ticket.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`, { method: "POST", body }).catch(() => null);
  if (!res?.ok) return null;
  const json = (await res.json()) as { secure_url: string; public_id: string; width: number; height: number };
  return { url: json.secure_url, publicId: json.public_id, width: json.width, height: json.height };
}
