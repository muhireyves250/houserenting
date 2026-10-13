export type MoMoProvider = "mtn" | "airtel";

const PREFIXES: Record<MoMoProvider, string[]> = { mtn: ["78", "79"], airtel: ["72", "73"] };

export type MoMoResult = { ok: true; number: string } | { ok: false; error: "invalid" | "network" };

/** Normalises a Rwandan mobile money number to +2507XXXXXXXX and checks it belongs to the chosen network. */
export function parseMobileMoney(provider: MoMoProvider, input: string): MoMoResult {
  const digits = input.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("250") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^7\d{8}$/.test(local)) return { ok: false, error: "invalid" };
  if (!PREFIXES[provider].includes(local.slice(0, 2))) return { ok: false, error: "network" };
  return { ok: true, number: `+250${local}` };
}

/** "078 ••• 3456" for showing a chosen number back. */
export function maskPhone(number: string): string {
  const local = `0${number.replace(/^\+250/, "")}`;
  return `${local.slice(0, 3)} ••• ${local.slice(-4)}`;
}
