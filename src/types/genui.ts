import type { JsonObject } from "./catalog.js";
import type { SafeCopyRule, UiSlot } from "./ranking.js";

export interface GenUiCard {
  readonly entry_id: string;
  readonly title: string;
  readonly body: string;
  readonly cta_label: string;
  readonly access_mode: string;
  readonly ui_slot: UiSlot;
  readonly safe_copy_rule: SafeCopyRule;
  readonly score: number;
  readonly handoff: JsonObject;
  readonly evidence_refs: readonly string[];
}

export interface EvidenceRailItem {
  readonly evidence_id: string;
  readonly title: string;
  readonly role: string;
}

export interface GenUiArtifact {
  readonly segment: string;
  readonly hero: JsonObject;
  readonly handoff_notice: string;
  readonly evidence_rail: { readonly label: string; readonly items: readonly EvidenceRailItem[] };
  readonly cards: readonly GenUiCard[];
}
