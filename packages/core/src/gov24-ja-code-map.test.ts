import { describe, expect, it } from "vitest";
import { gov24JaCodeMappings, resolveGov24JaCode } from "./gov24-ja-code-map.js";

describe("gov24 JA-code mapping", () => {
  it("covers every JA code from the teammate gov24 schema", () => {
    expect(gov24JaCodeMappings.map((mapping) => mapping.code)).toEqual([
      "JA0101",
      "JA0102",
      "JA0326",
      "JA0327",
      "JA0401",
      "JA0403",
      "JA0404",
      "JA0411",
      "JA0412",
      "JA0413",
      "JA1101",
      "JA1102"
    ]);
  });

  it("maps only to existing non-identifying profile fields", () => {
    expect(resolveGov24JaCode("JA0326")).toMatchObject({
      status: "mapped",
      mapping: { profilePatch: { employmentStatus: "employed" } }
    });
    expect(resolveGov24JaCode("JA0327")).toMatchObject({
      status: "mapped",
      mapping: { profilePatch: { employmentStatus: "unemployed" } }
    });
    expect(resolveGov24JaCode("JA0403")).toMatchObject({
      status: "mapped",
      mapping: { profilePatch: { householdType: "single_parent" } }
    });
    expect(resolveGov24JaCode("JA0404")).toMatchObject({
      status: "mapped",
      mapping: { profilePatch: { householdType: "single" } }
    });
    expect(resolveGov24JaCode("JA0412")).toMatchObject({
      status: "mapped",
      mapping: { profilePatch: { interests: ["housing"] } }
    });
    expect(resolveGov24JaCode("JA1102")).toMatchObject({
      status: "mapped",
      mapping: { profilePatch: { employmentStatus: "self_employed" } }
    });
  });

  it("records gaps instead of inventing unsupported profile axes", () => {
    expect(resolveGov24JaCode("JA0413")).toMatchObject({
      status: "gap",
      mapping: { gap: "Upstream profile has no relocation life-event field." }
    });
    expect(resolveGov24JaCode("JA0411")).toMatchObject({
      status: "gap",
      mapping: { gap: "Upstream profile has family household type but no multi-child signal." }
    });
    expect(resolveGov24JaCode("JA0101")).toMatchObject({
      status: "gap",
      mapping: { gap: "Upstream profile intentionally has no gender field." }
    });
  });

  it("treats undocumented JA codes as unknown gaps", () => {
    expect(resolveGov24JaCode("JA9999")).toEqual({
      status: "unknown",
      code: "JA9999",
      gap: "Unknown gov24 JA code; do not infer profile values from undocumented codes."
    });
  });
});
