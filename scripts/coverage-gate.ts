#!/usr/bin/env node
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { JsonObject, JsonValue } from "../src/types/catalog.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DB_PATH = path.join(ROOT, "catalog", "compiled.sqlite");
const REPORT_PATH = path.join(ROOT, "coverage-report.json");
const THRESHOLD = 20;
const GATED_AXES = ["persona", "intent", "life_event", "region"] as const;
const SENSITIVE_VALUES = new Set(["tax", "welfare", "family", "immigration", "legal"]);
const REGION_NON_PRIMARY = new Set(["central_government", "education_office", "overseas"]);

type Axis = typeof GATED_AXES[number];

type Verdict = "READY" | "NOT READY";

interface CountRow {
  readonly count: number;
}

interface CoverageRow {
  readonly axis: Axis;
  readonly value: string;
  readonly published_count: number;
  readonly required_count: number;
  readonly approval_ratio: number | null;
  readonly ready: boolean;
}

interface CoverageReport {
  readonly verdict: Verdict;
  readonly first_failure: string | null;
  readonly rows: readonly CoverageRow[];
}

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asObject = (value: unknown): JsonObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected JSON object");
  return value as JsonObject;
};

const taxonomyAxisValues = (taxonomy: JsonObject, axis: Axis): string[] => {
  const axes = isObject(taxonomy.axes) ? taxonomy.axes : {};
  const axisNode = isObject(axes[axis]) ? axes[axis] : {};
  const values = isObject(axisNode.values) ? axisNode.values : {};
  return Object.keys(values).filter((value) => axis !== "region" || isPrimaryRegion(value));
};

const isPrimaryRegion = (value: string): boolean =>
  value === "nationwide" || (!REGION_NON_PRIMARY.has(value) && !value.includes("_"));

const countSql = (sensitive: boolean): string => `
  SELECT COUNT(DISTINCT e.entry_id) AS count
  FROM entries e JOIN entry_terms t ON t.entry_id = e.entry_id
  WHERE e.status = 'published' AND t.axis = ? AND t.value = ?
  ${sensitive ? "AND json_extract(e.payload_json, '$.maintainer_approved') IN (1, 'true')" : ""}`;

const countEntries = (db: Database.Database, axis: Axis, value: string, approved: boolean): number => {
  const row = db.prepare(countSql(approved)).get(axis, value) as CountRow | undefined;
  return row?.count ?? 0;
};

const coverageRow = (db: Database.Database, axis: Axis, value: string): CoverageRow => {
  const published = countEntries(db, axis, value, false);
  if (!SENSITIVE_VALUES.has(value)) {
    return { axis, value, published_count: published, required_count: THRESHOLD, approval_ratio: null, ready: published >= THRESHOLD };
  }
  const approved = countEntries(db, axis, value, true);
  const ratio = published === 0 ? 0 : approved / published;
  return { axis, value, published_count: published, required_count: THRESHOLD, approval_ratio: ratio, ready: published >= THRESHOLD && approved >= published };
};

export const evaluateCoverage = (db: Database.Database): CoverageReport => {
  const payload = db.prepare("SELECT payload_json FROM taxonomy LIMIT 1").pluck().get() as string | undefined;
  if (!payload) throw new Error("taxonomy payload not found");
  const taxonomy = asObject(JSON.parse(payload) as unknown);
  const rows = GATED_AXES.flatMap((axis) => taxonomyAxisValues(taxonomy, axis).map((value) => coverageRow(db, axis, value)));
  const first = rows.find((row) => !row.ready);
  return { verdict: first ? "NOT READY" : "READY", first_failure: first ? `${first.axis}/${first.value}` : null, rows };
};

export const formatCoverage = (report: CoverageReport): string => {
  const header = "axis\tvalue\tpublished\trequired\tapproval\tready";
  const lines = report.rows.map((row) => [
    row.axis,
    row.value,
    String(row.published_count),
    String(row.required_count),
    row.approval_ratio === null ? "-" : `${Math.round(row.approval_ratio * 100)}%`,
    row.ready ? "yes" : "no",
  ].join("\t"));
  const verdict = report.verdict === "READY" ? "READY" : `NOT READY: ${report.first_failure ?? "unknown"}`;
  return [header, ...lines, verdict].join("\n");
};

export const runCoverageGate = (dbPath = DB_PATH, reportPath = REPORT_PATH): CoverageReport => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const report = evaluateCoverage(db);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(formatCoverage(report));
    return report;
  } finally {
    db.close();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = runCoverageGate();
    process.exitCode = report.verdict === "READY" ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "coverage_gate_failed", message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}
