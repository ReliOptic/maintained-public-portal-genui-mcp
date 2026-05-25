import type { EntryRecord, EvidenceRecord, JsonObject, JsonValue } from "../src/types/catalog.js";

const UNKNOWN_PRIORITY = 999;

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: JsonValue | undefined): string =>
  typeof value === "string" ? value : "";

export const asStringArray = (value: JsonValue | undefined): string[] => {
  if (typeof value === "string" && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
};

const tagSet = (entry: EntryRecord): Set<string> => new Set([
  ...asStringArray(entry.persona_tags),
  ...asStringArray(entry.task_intent),
  ...asStringArray(entry.life_event_tags),
]);

const hasTagMatch = (entryTags: Set<string>, evidence: EvidenceRecord): boolean =>
  asStringArray(evidence.applies_to).some((tag) => entryTags.has(tag));

const hasRegionMatch = (entry: EntryRecord, evidence: EvidenceRecord): boolean => {
  const evidenceRegion = asStringArray(evidence.region);
  if (evidenceRegion.length === 0) return true;
  const entryRegion = new Set(asStringArray(entry.region_tags));
  return evidenceRegion.some((region) => entryRegion.has(region));
};

const priority = (rolePriority: readonly string[], role: string): number => {
  const index = rolePriority.indexOf(role);
  return index === -1 ? UNKNOWN_PRIORITY : index;
};

export const autoMatchEvidence = (
  entry: EntryRecord,
  evidenceRecords: readonly EvidenceRecord[],
  rolePriority: readonly string[],
): string[] => {
  const entryTags = tagSet(entry);
  return evidenceRecords
    .filter((evidence) => hasTagMatch(entryTags, evidence) && hasRegionMatch(entry, evidence))
    .sort((left, right) => {
      const diff = priority(rolePriority, asString(left.role)) - priority(rolePriority, asString(right.role));
      return diff || asString(left.evidence_id).localeCompare(asString(right.evidence_id));
    })
    .slice(0, 3)
    .map((evidence) => asString(evidence.evidence_id))
    .filter((evidenceId) => evidenceId.length > 0);
};

export const resolveEvidenceRefs = (
  entry: EntryRecord,
  evidenceRecords: readonly EvidenceRecord[],
  rolePriority: readonly string[],
): string[] => {
  const authored = asStringArray(entry.evidence_refs);
  return authored.length > 0 ? authored : autoMatchEvidence(entry, evidenceRecords, rolePriority);
};

const axisEnumValues = (axes: JsonObject, axisName: string): string[] => {
  const axis = isObject(axes[axisName]) ? axes[axisName] : {};
  const values = isObject(axis.values) ? axis.values : {};
  return Object.keys(values);
};

export const taxonomyEnumValues = (taxonomy: JsonObject): Set<string> => {
  const axes = isObject(taxonomy.axes) ? taxonomy.axes : {};
  return new Set([
    ...axisEnumValues(axes, "persona"),
    ...axisEnumValues(axes, "intent"),
    ...axisEnumValues(axes, "life_event"),
  ]);
};

export const warnUnknownEvidenceAppliesTo = (
  evidenceRecords: readonly EvidenceRecord[],
  allowedValues: ReadonlySet<string>,
  warn: (message: string) => void = console.warn,
): void => {
  for (const evidence of evidenceRecords) {
    for (const value of asStringArray(evidence.applies_to)) {
      if (!allowedValues.has(value)) {
        warn(`WARN evidence ${asString(evidence.evidence_id)} applies_to "${value}" not in taxonomy enum — ignored`);
      }
    }
  }
};
