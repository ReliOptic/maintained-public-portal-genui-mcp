#!/usr/bin/env node
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getAdapterImplementation, parseAdapterRegistry } from "../src/services/adapter-registry.js";
import type { AdapterRegistration, ApiAdapter, DataRecord, SourceManifest } from "../src/types/adapter.types.js";
import type { JsonObject, JsonValue } from "../src/types/catalog.js";
import { readJson } from "./compile-catalog.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CATALOG = path.join(ROOT, "catalog", "v1.0.0");
const OUT = path.join(ROOT, "catalog", "compiled.sqlite");

interface CompileAdapterOptions {
  readonly catalogRoot?: string;
  readonly dbPath?: string;
  readonly adapters?: readonly ApiAdapter[];
  readonly logger?: (line: string) => void;
}

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const asNumber = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const defaultLogger = (line: string): void => console.error(line);

const registryFile = (root: string) => path.join(root, "adapters", "adapters.json");
const taxonomyFile = (root: string) => path.join(root, "taxonomy", "v1.0.json");

export const taxonomyRegions = (taxonomy: JsonValue): string[] => {
  if (!isObject(taxonomy)) return ["nationwide"];
  const axes = isObject(taxonomy.axes) ? taxonomy.axes : taxonomy.closed_enum;
  const region = isObject(axes) && isObject(axes.region) ? axes.region : {};
  const values = isObject(region) ? region.values : undefined;
  return isObject(values) ? Object.keys(values).sort() : ["nationwide"];
};

const adapterMap = (adapters: readonly ApiAdapter[] | undefined): Map<string, ApiAdapter> => {
  const pairs = adapters?.map((adapter) => [adapter.registration.adapter_id, adapter] as const) ?? [];
  return new Map(pairs);
};

const implementationFor = (registration: AdapterRegistration, injected: Map<string, ApiAdapter>): ApiAdapter => {
  const adapter = injected.get(registration.adapter_id) ?? getAdapterImplementation(registration.adapter_id);
  if (!adapter) throw new Error(`unknown adapter_id in adapters.json: ${registration.adapter_id}`);
  return adapter;
};

const compileRegionsFor = (registration: AdapterRegistration, regions: readonly string[]): readonly string[] =>
  registration.supported_regions && registration.supported_regions.length > 0 ? registration.supported_regions : regions;

const statusFromRecord = (record: DataRecord): SourceManifest["call_status"] => {
  const status = record.payload.call_status;
  return status === "mock" || status === "timeout" || status === "error" ? status : "ok";
};

const errorRecord = (adapterId: string, region: string): DataRecord => ({
  record_id: `${adapterId}_${region}_error`,
  adapter_id: adapterId,
  region,
  period: new Date().toISOString().slice(0, 7),
  payload: {},
});

const insertRecord = (db: Database.Database, record: DataRecord, callStatus: SourceManifest["call_status"], now: string): void => {
  db.prepare(`INSERT OR REPLACE INTO data_records
    (record_id, adapter_id, region, period, last_fetched_at, call_status, payload_json)
    VALUES (@record_id, @adapter_id, @region, @period, @last_fetched_at, @call_status, @payload_json)`).run({
    record_id: record.record_id,
    adapter_id: record.adapter_id,
    region: record.region,
    period: record.period,
    last_fetched_at: now,
    call_status: callStatus,
    payload_json: JSON.stringify(record.payload),
  });
};

export const compileAdapters = async (options: CompileAdapterOptions = {}): Promise<{ readonly records_inserted: number }> => {
  const catalogRoot = options.catalogRoot ?? CATALOG;
  const logger = options.logger ?? defaultLogger;
  const registry = parseAdapterRegistry(readJson(registryFile(catalogRoot)));
  const regions = taxonomyRegions(readJson(taxonomyFile(catalogRoot)));
  const injected = adapterMap(options.adapters);
  const db = new Database(options.dbPath ?? OUT);
  let inserted = 0;
  try {
    for (const registration of registry.adapters.filter((item) => item.refresh_mode === "scheduled" && (item.availability ?? "available") === "available")) {
      const adapter = implementationFor(registration, injected);
      const fetchedRecords: DataRecord[] = [];
      for (const region of compileRegionsFor(registration, regions)) {
        const limit = asNumber(registration.fetch_params.limit?.default) ?? 20;
        try {
          const rows = await adapter.fetch({ region, limit });
          const now = new Date().toISOString();
          db.transaction(() => rows.forEach((row) => insertRecord(db, row, statusFromRecord(row), now)))();
          inserted += rows.length;
          fetchedRecords.push(...rows);
          logger(JSON.stringify({ level: "info", adapter_id: registration.adapter_id, region, count: rows.length }));
        } catch (error) {
          const fallback = errorRecord(registration.adapter_id, region);
          insertRecord(db, fallback, "error", new Date().toISOString());
          inserted += 1;
          fetchedRecords.push(fallback);
          logger(JSON.stringify({ level: "warn", adapter_id: registration.adapter_id, region, message: error instanceof Error ? error.message : String(error) }));
        }
      }
      fs.writeFileSync(path.join(catalogRoot, "adapters", `${registration.adapter_id}-records.json`), `${JSON.stringify(fetchedRecords, null, 2)}\n`);
    }
  } finally {
    db.close();
  }
  return { records_inserted: inserted };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  compileAdapters().then((counts) => console.log(JSON.stringify(counts, null, 2))).catch((error: unknown) => {
    console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  });
}
