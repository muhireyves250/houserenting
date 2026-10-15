import "server-only";
import { cache } from "react";
import { audit } from "@/features/audit/service";
import type { FeeConfig } from "@/features/bookings/money";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { settingsInput, toBps, type SettingsInput } from "./validation";

export type CancellationPolicy = { en: string | null; fr: string | null; rw: string | null };

export type PlatformSettings = FeeConfig & {
  holdMinutes: number | null;
  monthlyDepositPercent: number | null;
  cancellationPolicy: CancellationPolicy;
  updatedAt: Date | null;
};

const EMPTY_POLICY: CancellationPolicy = { en: null, fr: null, rw: null };

async function load(): Promise<PlatformSettings> {
  const row = await db.platformConfig.findUnique({ where: { id: 1 } });
  return {
    commissionBps: row?.commissionBps ?? null,
    guestFeeBps: row?.guestFeeBps ?? null,
    holdMinutes: row?.holdMinutes ?? null,
    monthlyDepositPercent: row?.monthlyDepositPercent ?? null,
    cancellationPolicy: { ...EMPTY_POLICY, ...((row?.cancellationPolicy as Partial<CancellationPolicy> | null) ?? {}) },
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Current settings (read once per request in pages). */
export const getSettings = cache(load);

/** Settings read straight from the database, for decisions that must not use a cached copy (booking). */
export const readSettings = load;

export function holdMinutesFrom(settings: Pick<PlatformSettings, "holdMinutes">): number {
  return settings.holdMinutes ?? getEnv().BOOKING_HOLD_MINUTES;
}

/** Cancellation terms in the reader's language, falling back to English; null when none are published. */
export function policyText(policy: Partial<CancellationPolicy> | null | undefined, locale: string): string | null {
  if (!policy) return null;
  return policy[locale as keyof CancellationPolicy] ?? policy.en ?? policy.fr ?? policy.rw ?? null;
}

export type UpdateResult = { ok: true } | { ok: false; errors: Record<string, string> };

export async function updateSettings(adminId: string, raw: SettingsInput): Promise<UpdateResult> {
  const parsed = settingsInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  const v = parsed.data;
  const next = {
    commissionBps: toBps(v.commissionPercent),
    guestFeeBps: toBps(v.guestFeePercent),
    holdMinutes: v.holdMinutes,
    monthlyDepositPercent: v.monthlyDepositPercent,
    cancellationPolicy: v.cancellationPolicy,
  };
  await db.$transaction(async (tx) => {
    const before = await tx.platformConfig.findUnique({ where: { id: 1 } });
    await tx.platformConfig.upsert({ where: { id: 1 }, create: { id: 1, ...next, updatedById: adminId }, update: { ...next, updatedById: adminId } });
    const from = {
      commissionBps: before?.commissionBps ?? null,
      guestFeeBps: before?.guestFeeBps ?? null,
      holdMinutes: before?.holdMinutes ?? null,
      monthlyDepositPercent: before?.monthlyDepositPercent ?? null,
      cancellationPolicy: (before?.cancellationPolicy as CancellationPolicy | null) ?? null,
    };
    await audit(tx, { actorId: adminId, action: "settings.update", entityType: "settings", entityId: "platform", data: { from, to: next } });
  });
  return { ok: true };
}
