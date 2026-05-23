import { describe, expect, it } from "vitest";
import { shouldCompileEntry, validateEntry } from "../../scripts/compile-catalog.js";
import type { EntryRecord } from "../../src/types/catalog.js";

const baseEntry: EntryRecord = {
  entry_id: "entry-1",
  status: "published",
  confidence_score: 0.85,
  merged_into: null,
  menu_path: "정부24 > 테스트",
};

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
});
