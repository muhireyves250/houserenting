import { describe, expect, it } from "vitest";
import { icuArguments as placeholders } from "./icu-args";
import { catalogs } from "./messages";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = `${prefix}${key}`;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, `${path}.`));
    return acc;
  }, {});
}


const en = flatten(catalogs.en as unknown as Tree);

describe.each(["rw", "fr"] as const)("%s catalog", (locale) => {
  const other = flatten(catalogs[locale] as unknown as Tree);

  it("has exactly the same keys as en", () => {
    expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
  });

  it("uses the same ICU placeholders as en for every key", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(other[key] ?? ""), key).toEqual(placeholders(en[key]));
    }
  });

  it("has no empty strings", () => {
    for (const [key, value] of Object.entries(other)) expect(value.trim(), key).not.toBe("");
  });
});
