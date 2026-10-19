import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import type { FeeConfig } from "@/features/bookings/money";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { settingsInput, toBps, type SettingsInput } from "./validation";

export type CancellationPolicy = { en: string | null; fr: string | null; rw: string | null };

export type PlatformSettings = FeeConfig & {
  holdMinutes: number | null;
  monthlyDepositPercent: number | null;
  monthlyUpfrontMonths: number | null;
  monthlyIdentity: "NONE" | "ID" | "ID_NATIONALITY";
  referralEnabled: boolean;
  referralRewardAmount: number | null;
  dislikeHideCount: number | null;
  promoterEnabled: boolean;
  promoterRewardFixed: number | null;
  promoterRewardBps: number | null;
  commissionByType: Record<string, number> | null;
  feeModel: "ADD_ON" | "INCLUDED";
  vatBps: number | null;
  citBps: number | null;
  paymentInstructions: string | null;
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
    monthlyUpfrontMonths: row?.monthlyUpfrontMonths ?? null,
    monthlyIdentity: row?.monthlyIdentity ?? "NONE",
    referralEnabled: row?.referralEnabled ?? false,
    referralRewardAmount: row?.referralRewardAmount ?? null,
    dislikeHideCount: row?.dislikeHideCount ?? null,
    promoterEnabled: row?.promoterEnabled ?? false,
    promoterRewardFixed: row?.promoterRewardFixed ?? null,
    promoterRewardBps: row?.promoterRewardBps ?? null,
    commissionByType: (row?.commissionByType as Record<string, number> | null) ?? null,
    feeModel: row?.feeModel ?? "ADD_ON",
    vatBps: row?.vatBps ?? null,
    citBps: row?.citBps ?? null,
    paymentInstructions: row?.paymentInstructions ?? null,
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

/** Percent per category → basis points, keeping only the categories that have a rate. */
function byType(percents: Record<string, number | null> | undefined): Record<string, number> | null {
  const entries = Object.entries(percents ?? {}).flatMap(([type, pct]) => (pct === null || pct === undefined ? [] : [[type, toBps(pct)!] as const]));
  return entries.length ? Object.fromEntries(entries) : null;
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
    monthlyUpfrontMonths: v.monthlyUpfrontMonths,
    monthlyIdentity: v.monthlyIdentity,
    referralEnabled: v.referralEnabled,
    referralRewardAmount: v.referralRewardAmount,
    dislikeHideCount: v.dislikeHideCount,
    promoterEnabled: v.promoterEnabled,
    promoterRewardFixed: v.promoterRewardFixed,
    promoterRewardBps: toBps(v.promoterRewardPercent),
    commissionByType: byType(v.commissionByTypePercent) ?? Prisma.DbNull,
    feeModel: v.feeModel,
    vatBps: toBps(v.vatPercent),
    citBps: toBps(v.citPercent),
    paymentInstructions: v.paymentInstructions,
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
      monthlyUpfrontMonths: before?.monthlyUpfrontMonths ?? null,
      monthlyIdentity: before?.monthlyIdentity ?? "NONE",
      referralEnabled: before?.referralEnabled ?? false,
      referralRewardAmount: before?.referralRewardAmount ?? null,
      dislikeHideCount: before?.dislikeHideCount ?? null,
      promoterEnabled: before?.promoterEnabled ?? false,
      promoterRewardFixed: before?.promoterRewardFixed ?? null,
      promoterRewardBps: before?.promoterRewardBps ?? null,
      commissionByType: (before?.commissionByType as Record<string, number> | null) ?? null,
      feeModel: before?.feeModel ?? "ADD_ON",
      vatBps: before?.vatBps ?? null,
      citBps: before?.citBps ?? null,
      paymentInstructions: before?.paymentInstructions ?? null,
      cancellationPolicy: (before?.cancellationPolicy as CancellationPolicy | null) ?? null,
    };
    await audit(tx, { actorId: adminId, action: "settings.update", entityType: "settings", entityId: "platform", data: { from, to: { ...next, commissionByType: byType(v.commissionByTypePercent) } } as Prisma.InputJsonObject });
  });
  return { ok: true };
}
