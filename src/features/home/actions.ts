"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { canStaff } from "@/lib/roles";
import { deleteSection, moveSection, pickableHouses, saveSection, type SectionInput } from "./sections-service";

const refresh = () => revalidatePath("/[locale]", "layout");

export async function saveSectionAction(id: string | null, input: SectionInput) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "notAllowed" as const };
  const r = await saveSection(user, id, input);
  if (r.ok) refresh();
  return r;
}

export async function moveSectionAction(id: string, direction: "up" | "down") {
  const user = await getCurrentUser();
  if (!user || (direction !== "up" && direction !== "down")) return false;
  const ok = await moveSection(user, id, direction);
  if (ok) refresh();
  return ok;
}

export async function deleteSectionAction(id: string) {
  const user = await getCurrentUser();
  if (!user) return false;
  const ok = await deleteSection(user, id);
  if (ok) refresh();
  return ok;
}

/** Live houses to pick for a row (by name or town). */
export async function pickHousesAction(q: string) {
  const user = await getCurrentUser();
  if (!user || !canStaff(user, "listings") || typeof q !== "string") return [];
  return pickableHouses(q);
}
