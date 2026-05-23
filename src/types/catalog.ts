export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue };

export type SqlValue = string | number | null;
export type SqlParams = Record<string, SqlValue>;

export interface EntryRecord extends JsonObject {
  readonly entry_id?: JsonValue;
  readonly status?: JsonValue;
  readonly confidence_score?: JsonValue;
  readonly merged_into?: JsonValue;
  readonly access_mode?: JsonValue;
  readonly canonical_intent?: JsonValue;
  readonly canonical_action_verb?: JsonValue;
  readonly title?: JsonValue;
  readonly menu_path?: JsonValue;
  readonly persona_tags?: JsonValue;
  readonly task_intent?: JsonValue;
  readonly life_event_tags?: JsonValue;
  readonly region_tags?: JsonValue;
  readonly evidence_refs?: JsonValue;
  readonly seasonality_hint?: JsonValue;
  readonly intrinsic_ordinals?: JsonValue;
  readonly handoff?: JsonValue;
  readonly card_title?: JsonValue;
  readonly card_body?: JsonValue;
  readonly cta_label?: JsonValue;
  readonly safe_copy_audit?: JsonValue;
  readonly last_sync_at?: JsonValue;
  readonly last_verified_at?: JsonValue;
}

export interface EvidenceRecord extends JsonObject {
  readonly evidence_id?: JsonValue;
  readonly title?: JsonValue;
  readonly role?: JsonValue;
}

export interface CompileCounts {
  readonly entries_seen: number;
  readonly entries_inserted: number;
  readonly evidence_inserted: number;
  readonly taxonomy_inserted: number;
  readonly weights_inserted: number;
  readonly frame_copy_inserted: number;
}

export interface EntryFilter {
  readonly access_mode?: string;
  readonly canonical_intent?: string;
  readonly status?: string;
  readonly query?: string;
  readonly limit?: number;
}

export type CatalogEntry = EntryRecord;
export type CatalogEvidence = EvidenceRecord;

export interface CatalogFreshness {
  readonly latest_entry_date: string | null;
  readonly age_days: number | null;
  readonly stale: boolean;
  readonly threshold_days: number;
}

export interface CatalogPayloads {
  readonly taxonomy: JsonObject;
  readonly weights: JsonObject;
  readonly frameCopy: JsonObject;
}
