import { describe, expect, it } from "vitest";
import { composeGenUiArtifact } from "../../src/services/composer.js";
import type { DataSection } from "../../src/types/adapter.types.js";
import type { EntryRecord, JsonObject } from "../../src/types/catalog.js";
import type { RankedEntry } from "../../src/types/ranking.js";

const entry: EntryRecord = { entry_id: "entry-a", title: "복지", card_title: "복지 확인", card_body: "확인", cta_label: "정부24", access_mode: "portal_handoff", menu_path: "정부24" };
const ranked: RankedEntry = { entry, score: 0.7, ui_slot: "primary_card", safe_copy_rule: "standard", weight_snapshot: { IF: 1, PF: 0, LF: 0, SE: 0, UR: 0, AC: 0, EV: 0, api_availability: 0, freshness: 0 } };
const frameCopy: JsonObject = { general: { hero: {}, handoff_notice: "확인", evidence_rail: { label: "근거" } } };
const segments: JsonObject = { segments: [{ segment: "general", priority: 1, match: { fallback: true } }] };
const section: DataSection = {
  type: "data_table",
  title: "복지시설 현황",
  rows: [{ record_id: "r1", adapter_id: "welfare-facility-kr", region: "seoul", period: "2026-05", payload: { 시설명: "서울복지관" } }],
  source: { adapter_id: "welfare-facility-kr", agency: "보건복지부", api_name: "사회복지시설 현황", last_updated: "2026-05-26T00:00:00.000Z", call_status: "ok", auth_type: "key_required" },
};

describe("composer data_sections", () => {
  it("emits an empty data_sections array without adapter data", () => {
    expect(composeGenUiArtifact([ranked], {}, frameCopy, segments, [], [], undefined).data_sections).toEqual([]);
  });

  it("passes matched adapter data_sections through", () => {
    const artifact = composeGenUiArtifact([ranked], {}, frameCopy, segments, [], [], undefined, [section]);
    expect(artifact.data_sections).toHaveLength(1);
    expect(artifact.cards.map((card) => card.entry_id)).toEqual(["entry-a"]);
    expect(artifact.insight_rail).toEqual([]);
  });
});
