"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { toggleFavorite } from "./service";

export type ToggleFavoriteResult = { saved: boolean } | { error: "auth" | "failed" };

export async function toggleFavoriteAction(listingId: string): Promise<ToggleFavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  if (typeof listingId !== "string" || listingId.length === 0 || listingId.length > 64) return { error: "failed" };
  try {
    const saved = await toggleFavorite(user.id, listingId);
    revalidatePath("/[locale]/favorites", "page");
    return { saved };
  } catch (err) {
    logger.error({ err, listingId }, "toggle favorite failed");
    return { error: "failed" };
  }
}
