import { describe, expect, it } from "vitest";
import { FormsDrill, markRow } from "../../src/lib/forms";
import { VERB_SETS } from "../../src/lib/verbsets";

describe("ready-made verb sets", () => {
  it("have exactly one form per column for every verb, and no empty or duplicate verbs", () => {
    for (const set of VERB_SETS) {
      const seen = new Set<string>();
      for (const verb of set.verbs) {
        expect(verb.forms, `${set.id} ${verb.verb}`).toHaveLength(set.columns.length);
        expect(verb.forms.every((f) => f.trim().length > 0), `${set.id} ${verb.verb}`).toBe(true);
        expect(verb.nl && verb.en, verb.verb).toBeTruthy();
        expect(seen.has(verb.verb), `${set.id} duplicate ${verb.verb}`).toBe(false);
        seen.add(verb.verb);
      }
    }
  });
  it("spot-checks a few forms", () => {
    const get = (id: string, verb: string) => VERB_SETS.find((s) => s.id === id)!.verbs.find((v) => v.verb === verb)!.forms;
    expect(get("fr-present", "être")).toEqual(["suis", "es", "est", "sommes", "êtes", "sont"]);
    expect(get("de-praesens", "fahren")[2]).toBe("fährt");
    expect(get("es-presente", "tener")[0]).toBe("tengo");
    expect(get("en-irregular", "go")).toEqual(["went", "gone"]);
  });
});

describe("forms drill", () => {
  const parler = { id: "p", front: "parler", back: "praten", forms: ["parle", "parles", "parle", "parlons", "parlez", "parlent"] };
  it("marks a row: all right is goed, half or more twijfel, less fout; alternatives and accents per the settings", () => {
    expect(markRow(parler, ["parle", "parles", "parle", "parlons", "parlez", "parlent"]).grade).toBe("goed");
    expect(markRow(parler, ["parle", "parles", "parle", "x", "x", "x"]).grade).toBe("twijfel");
    expect(markRow(parler, ["parle", "", "", "", "", ""]).grade).toBe("fout");
    const be = { id: "b", front: "be", back: "zijn", forms: ["was / were", "been"] };
    expect(markRow(be, ["were", "been"]).grade).toBe("goed");
    const etre = { id: "e", front: "être", back: "zijn", forms: ["suis", "es", "est", "sommes", "êtes", "sont"] };
    expect(markRow(etre, ["suis", "es", "est", "sommes", "etes", "sont"]).right[4]).toBe(false);
    expect(markRow(etre, ["suis", "es", "est", "sommes", "etes", "sont"], { lenientAccents: true }).right[4]).toBe(true);
    // A column that doesn't apply is not asked.
    expect(markRow({ ...be, forms: ["was / were", ""] }, ["was", ""]).right).toEqual([true, null]);
  });
  it("brings a row that isn't fully right back at the end", () => {
    const d = new FormsDrill([parler, { ...parler, id: "q" }], () => 0.1);
    const first = d.current!.id;
    d.answer({ right: [], grade: "fout" });
    expect(d.queue.at(-1)!.id).toBe(first);
    d.answer({ right: [], grade: "goed" });
    d.answer({ right: [], grade: "goed" });
    expect(d.current).toBeNull();
    expect(d.first.get(first)).toBe("fout");
  });
});
