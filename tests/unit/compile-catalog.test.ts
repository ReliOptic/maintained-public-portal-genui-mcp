import { describe, expect, it } from "vitest";
import { shouldCompileEntry, validateEntry } from "../../scripts/compile-catalog.js";
import { autoMatchEvidence, resolveEvidenceRefs, warnUnknownEvidenceAppliesTo } from "../../scripts/evidence-auto-match.js";
import type { EntryRecord, EvidenceRecord } from "../../src/types/catalog.js";

const baseEntry: EntryRecord = {
  entry_id: "entry-1",
  status: "published",
  confidence_score: 0.85,
  merged_into: null,
  menu_path: "정부24 > 테스트",
};

const taggedEntry: EntryRecord = {
  ...baseEntry,
  persona_tags: ["freelancer"],
  task_intent: ["tax_filing"],
  life_event_tags: ["tax_season"],
  region_tags: ["nationwide"],
};

const evidence = (fields: EvidenceRecord): EvidenceRecord => fields;

describe("compile-catalog gates", () => {
  it("keeps published confident entries with menu paths", () => {
    expect(shouldCompileEntry(baseEntry)).toBe(true);
  });

  it("filters low confidence and merged entries", () => {
    expect(shouldCompileEntry({ ...baseEntry, confidence_score: 0.849 })).toBe(false);
    expect(shouldCompileEntry({ ...baseEntry, merged_into: "winner" })).toBe(false);
  });

  it("fails fast for missing required identity fields", () => {
    expect(() => validateEntry({ ...baseEntry, entry_id: "" }, "x.json")).toThrow(/entry_id/);
    expect(() => validateEntry({ ...baseEntry, menu_path: "" }, "x.json")).toThrow(/menu_path/);
  });

  it("auto-matches evidence by applies_to and role priority", () => {
    const records = [
      evidence({ evidence_id: "ev-low", role: "later", applies_to: ["freelancer"] }),
      evidence({ evidence_id: "ev-high", role: "first", applies_to: ["tax_filing"] }),
    ];
    expect(autoMatchEvidence(taggedEntry, records, ["first", "later"])).toEqual(["ev-high", "ev-low"]);
  });

  it("does not match region-scoped evidence when regions differ", () => {
    const records = [evidence({ evidence_id: "ev-region", role: "first", applies_to: ["freelancer"], region: ["incheon"] })];
    expect(autoMatchEvidence(taggedEntry, records, ["first"])).toEqual([]);
  });

  it("preserves maintainer-authored evidence_refs", () => {
    const records = [evidence({ evidence_id: "ev-auto", role: "first", applies_to: ["freelancer"] })];
    expect(resolveEvidenceRefs({ ...taggedEntry, evidence_refs: ["ev-manual"] }, records, ["first"])).toEqual(["ev-manual"]);
  });

  it("warns for unknown applies_to values without throwing", () => {
    const warnings: string[] = [];
    const records = [evidence({ evidence_id: "ev-unknown", role: "first", applies_to: ["unknown_value"] })];
    expect(() => warnUnknownEvidenceAppliesTo(records, new Set(["freelancer"]), (message) => warnings.push(message))).not.toThrow();
    expect(warnings).toEqual([
      "WARN evidence ev-unknown applies_to \"unknown_value\" not in taxonomy enum — ignored",
    ]);
  });
});
