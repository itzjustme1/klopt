import { describe, expect, it } from "vitest";
import { APP_NAME } from "../../src/config";
import { en } from "../../src/i18n/en";
import { interpolate, translate, translatePlural } from "../../src/i18n/index.svelte";
import { nl } from "../../src/i18n/nl";

function shape(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? "string" : Object.keys(v as object).sort().join(",")]));
}

function allStrings(obj: Record<string, unknown>): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : Object.values(v as object).map((s) => [k, s as string] as [string, string])));
}

describe("i18n", () => {
  it("nl and en have identical keys and value shapes", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(nl).sort());
    expect(shape(en)).toEqual(shape(nl));
  });

  it("uses the same placeholders in both languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const key of Object.keys(nl) as (keyof typeof nl)[]) {
      const a = nl[key];
      const b = en[key];
      if (typeof a === "string") expect(ph(b as string), key).toBe(ph(a));
      else expect(ph((b as { other: string }).other), key).toBe(ph(a.other));
    }
  });

  it("never hardcodes the app name and never uses em dashes", () => {
    for (const [key, s] of [...allStrings(nl), ...allStrings(en)]) {
      expect(s.includes(APP_NAME), `${key} contains the app name`).toBe(false);
      expect(s.includes("—"), `${key} contains an em dash`).toBe(false);
      expect(s.trim(), `${key} is empty`).not.toBe("");
    }
  });

  it("interpolates variables and the app name", () => {
    expect(interpolate("{app} {n}", { n: 3 })).toBe(`${APP_NAME} 3`);
    expect(interpolate("{missing}")).toBe("{missing}");
    expect(translate("nl", "practice.questionOf", { i: 3, n: 8 })).toBe("Vraag 3 van 8");
    expect(translate("en", "practice.questionOf", { i: 3, n: 8 })).toBe("Question 3 of 8");
  });

  it("picks plural forms with Intl.PluralRules", () => {
    expect(translatePlural("nl", "common.cardsCount", 1)).toBe("1 kaart");
    expect(translatePlural("nl", "common.cardsCount", 2)).toBe("2 kaarten");
    expect(translatePlural("nl", "common.cardsCount", 0)).toBe("0 kaarten");
    expect(translatePlural("en", "common.cardsCount", 1)).toBe("1 card");
    expect(translatePlural("nl", "common.cardsCount", 1200)).toBe("1.200 kaarten");
    expect(translatePlural("en", "common.cardsCount", 1200)).toBe("1,200 cards");
  });

  it("does not interpret user text as a template", () => {
    // A deck name containing braces must come out exactly as typed.
    expect(translate("nl", "receive.added", { name: "{app} <b>x</b>" })).toBe('"{app} <b>x</b>" toegevoegd.');
  });
});
