import "server-only";
import data from "./rwanda.json";

/** Rwanda's official administrative divisions (5 provinces, 30 districts, 416 sectors, 2,148 cells, 14,837 villages). */
export const LEVELS = ["province", "district", "sector", "cell", "village"] as const;
export type Level = (typeof LEVELS)[number];
export type Place = { code: string; name: string };
export type LocationPath = { province: string; district: string; sector: string; cell: string; village: string; villageCode: string };

type Row = [code: string, name: string, parent?: string];
const TABLE: Record<Level, Row[]> = {
  province: data.provinces as Row[],
  district: data.districts as Row[],
  sector: data.sectors as Row[],
  cell: data.cells as Row[],
  village: data.villages as Row[],
};
const byCode = new Map<string, { level: Level; row: Row }>();
for (const level of LEVELS) for (const row of TABLE[level]) byCode.set(row[0], { level, row });

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name);

/** The places one level down (provinces when no parent is given), sorted by name. */
export function childrenOf(level: Level, parentCode: string | null): Place[] {
  return TABLE[level]
    .filter((r) => (level === "province" ? true : r[2] === parentCode))
    .map(([code, name]) => ({ code, name }))
    .sort(byName);
}

/** A village's full path (province down to village), or null when the code isn't an official village. */
export function pathOfVillage(villageCode: string): LocationPath | null {
  const village = byCode.get(villageCode);
  if (!village || village.level !== "village") return null;
  const cell = byCode.get(village.row[2]!)!.row;
  const sector = byCode.get(cell[2]!)!.row;
  const district = byCode.get(sector[2]!)!.row;
  const province = byCode.get(district[2]!)!.row;
  return { province: province[1], district: district[1], sector: sector[1], cell: cell[1], village: village.row[1], villageCode };
}

/** The codes above a village (to show the picker filled in when editing). */
export function codesOfVillage(villageCode: string): Record<Level, string> | null {
  const village = byCode.get(villageCode);
  if (!village || village.level !== "village") return null;
  const cell = village.row[2]!;
  const sector = byCode.get(cell)!.row[2]!;
  const district = byCode.get(sector)!.row[2]!;
  const province = byCode.get(district)!.row[2]!;
  return { province, district, sector, cell, village: villageCode };
}

/** Search villages, cells and sectors by name ("Kimihurura"): each with its full path, best matches first. */
export function searchLocations(query: string, limit = 12): { code: string; level: Level; label: string; path: string }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: { code: string; level: Level; label: string; path: string; rank: number }[] = [];
  const pathOf = (code: string): string[] => {
    const names: string[] = [];
    let cur = byCode.get(code);
    while (cur) {
      names.push(cur.row[1]);
      cur = cur.row[2] ? byCode.get(cur.row[2]) : undefined;
    }
    return names;
  };
  for (const level of ["sector", "cell", "village"] as const) {
    for (const [code, name] of TABLE[level]) {
      const n = name.toLowerCase();
      if (!n.includes(q)) continue;
      const names = pathOf(code);
      out.push({ code, level, label: name, path: names.slice(1).join(", "), rank: (n === q ? 0 : n.startsWith(q) ? 1 : 2) * 10 + LEVELS.indexOf(level) });
      if (out.length > 400) break;
    }
  }
  return out.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).slice(0, limit).map((r) => ({ code: r.code, level: r.level, label: r.label, path: r.path }));
}

/** Every village under a place at any level (for filtering places by province, district, sector or cell). */
export function villageCodesUnder(code: string): string[] {
  const entry = byCode.get(code);
  if (!entry) return [];
  if (entry.level === "village") return [code];
  let parents = new Set([code]);
  for (const level of LEVELS.slice(LEVELS.indexOf(entry.level) + 1)) {
    const next = new Set<string>();
    for (const r of TABLE[level]) if (parents.has(r[2]!)) next.add(r[0]);
    parents = next;
  }
  return [...parents];
}

export const nameOf = (code: string) => byCode.get(code)?.row[1] ?? null;

/** The codes from the province down to this place (any level); levels below it are left empty. */
export function codesOf(code: string): Partial<Record<Level, string>> | null {
  const start = byCode.get(code);
  if (!start) return null;
  const out: Partial<Record<Level, string>> = {};
  let cur: { level: Level; row: Row } | undefined = start;
  while (cur) {
    out[cur.level] = cur.row[0];
    cur = cur.row[2] ? byCode.get(cur.row[2]) : undefined;
  }
  return out;
}
