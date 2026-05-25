import type { CatalogEntry, CatalogEvidence, JsonObject, JsonValue } from "../types/catalog.js";
import type { GenUiArtifact, GenUiCard } from "../types/genui.js";
import type { RankedEntry, RankRequest } from "../types/ranking.js";

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: JsonValue | undefined): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asStringArray = (value: JsonValue | undefined): string[] => {
  if (typeof value === "string" && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
};

const text = (value: JsonValue | undefined, fallback: string): string => asString(value) ?? fallback;

const requestValues = (request: RankRequest, key: string): readonly string[] => {
  if (key === "intent_any") return request.intent ?? [];
  if (key === "persona_any") return request.persona ?? [];
  if (key === "life_event_any") return request.life_event ?? [];
  if (key === "region_any") return request.region ?? [];
  if (key === "season_any") return request.season ? [request.season] : [];
  return [];
};

const conditionMatches = (request: RankRequest, key: string, values: JsonValue | undefined): boolean => {
  const expected = asStringArray(values);
  if (expected.length === 0) return false;
  const actual = new Set(requestValues(request, key));
  return expected.some((value) => actual.has(value));
};

const segmentMatches = (request: RankRequest, match: JsonObject): boolean => {
  if (match.fallback === true) return true;
  const keys = Object.keys(match).filter((key) => key.endsWith("_any"));
  return keys.length > 0 && keys.every((key) => conditionMatches(request, key, match[key]));
};

export const resolveFrameSegment = (request: RankRequest, segmentsPayload: JsonObject): string => {
  const raw = Array.isArray(segmentsPayload.segments) ? segmentsPayload.segments : [];
  const rows = raw.filter(isObject).sort((left, right) => Number(left.priority ?? 999) - Number(right.priority ?? 999));
  const matched = rows.find((row) => isObject(row.match) && segmentMatches(request, row.match));
  return asString(matched?.segment) ?? "general";
};

const allowedUserUrl = (value: string | undefined, allowedHosts: readonly string[]): string | undefined => {
  if (!value) return undefined;
  const host = new URL(value).hostname.replace(/^www\./u, "");
  const allowed = allowedHosts.some((item) => host === item || host.endsWith(`.${item}`));
  return allowed ? value : undefined;
};

const handoffPayload = (entry: CatalogEntry, allowedHosts: readonly string[]): JsonObject => {
  const handoff = isObject(entry.handoff) ? entry.handoff : {};
  const url = allowedUserUrl(asString(handoff.url), allowedHosts);
  return {
    portal: text(handoff.portal, text(entry.access_mode, "portal")),
    tier: text(handoff.tier, "tier3"),
    menu_path: text(handoff.menu_path, text(entry.menu_path, "")),
    ...(url ? { url } : {}),
  };
};

const cardFromRanked = (ranked: RankedEntry, allowedHosts: readonly string[]): GenUiCard => {
  const entry = ranked.entry;
  const handoff = handoffPayload(entry, allowedHosts);
  return {
    entry_id: text(entry.entry_id, ""),
    title: text(entry.card_title, text(entry.title, "공공서비스")),
    body: text(entry.card_body, "공식 포털에서 최신 안내를 확인하세요."),
    cta_label: text(entry.cta_label, "공식 포털에서 확인"),
    access_mode: text(entry.access_mode, "portal_handoff"),
    portal: text(entry.portal, text(handoff.portal, "portal")),
    ui_slot: ranked.ui_slot,
    safe_copy_rule: ranked.safe_copy_rule,
    score: Number(ranked.score.toFixed(6)),
    handoff,
    evidence_refs: asStringArray(entry.evidence_refs),
  };
};

const evidenceItems = (cards: readonly GenUiCard[], evidence: readonly CatalogEvidence[]) => {
  const refs = new Set(cards.flatMap((card) => card.evidence_refs));
  return evidence.filter((item) => refs.has(text(item.evidence_id, ""))).map((item) => ({
    evidence_id: text(item.evidence_id, ""),
    title: text(item.title, "근거"),
    role: text(item.role, "evidence"),
  }));
};

const frameForSegment = (frameCopy: JsonObject, segment: string): JsonObject => {
  const frame = isObject(frameCopy[segment]) ? frameCopy[segment] : frameCopy.general;
  return isObject(frame) ? frame : {};
};

export const composeGenUiArtifact = (
  ranked: readonly RankedEntry[],
  request: RankRequest,
  frameCopy: JsonObject,
  segments: JsonObject,
  evidence: readonly CatalogEvidence[],
  allowedHosts: readonly string[],
  segmentOverride?: string,
): GenUiArtifact => {
  const segment = segmentOverride ?? resolveFrameSegment(request, segments);
  const frame = frameForSegment(frameCopy, segment);
  const rail = isObject(frame.evidence_rail) ? frame.evidence_rail : {};
  const visible = ranked.filter((item) => item.ui_slot !== "hidden");
  const actionCards = visible.filter((item) => item.ui_slot !== "insight_card").map((item) => cardFromRanked(item, allowedHosts));
  const insightCards = visible.filter((item) => item.ui_slot === "insight_card").map((item) => cardFromRanked(item, allowedHosts));
  return {
    segment,
    hero: isObject(frame.hero) ? frame.hero : {},
    handoff_notice: text(frame.handoff_notice, "공식 포털에서 최신 안내를 확인하세요."),
    evidence_rail: { label: text(rail.label, "추천 근거"), items: evidenceItems([...actionCards, ...insightCards], evidence) },
    cards: actionCards,
    insight_rail: insightCards,
  };
};
