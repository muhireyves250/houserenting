import "server-only";
import { db } from "@/lib/db";
import type { ProfileInput } from "./schemas";

const PROFILE_FIELDS = { name: true, email: true, emailVerified: true, phone: true, locale: true } as const;

export function getProfile(userId: string) {
  return db.user.findUnique({ where: { id: userId }, select: PROFILE_FIELDS });
}

export function updateProfile(userId: string, input: ProfileInput) {
  return db.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone, locale: input.locale },
    select: PROFILE_FIELDS,
  });
}
