import { z } from "zod";

const optional = (schema: z.ZodNumber) => schema.nullable();
const policyText = z.string().trim().max(4000).transform((v) => v || null).nullable();

/** What staff can set. Blank = not set: nothing is charged and no terms are promised. */
export const settingsInput = z.object({
  commissionPercent: optional(z.number().min(0).max(50)),
  guestFeePercent: optional(z.number().min(0).max(50)),
  holdMinutes: optional(z.number().int().min(5).max(1440)),
  monthlyDepositPercent: optional(z.number().int().min(0).max(1200)),
  monthlyUpfrontMonths: optional(z.number().int().min(1).max(24)).optional().default(null),
  /** Identity details asked for monthly rentals (only what the business has approved). */
  monthlyIdentity: z.enum(["NONE", "ID", "ID_NATIONALITY"]).optional().default("NONE"),
  referralEnabled: z.boolean().optional().default(false),
  referralRewardAmount: optional(z.number().int().min(1).max(10_000_000)).optional().default(null),
  cancellationPolicy: z.object({ en: policyText, fr: policyText, rw: policyText }),
});

export type SettingsInput = z.input<typeof settingsInput>;

/** Percent with up to two decimals → basis points (12.5% → 1250). */
export const toBps = (percent: number | null) => (percent === null ? null : Math.round(percent * 100));
export const fromBps = (bps: number | null) => (bps === null ? null : bps / 100);
