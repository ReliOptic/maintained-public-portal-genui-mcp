import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileAdapters } from "../../scripts/compile-adapters.js";
import type { AdapterFetchParams, ApiAdapter, DataRecord, SourceManifest } from "../../src/types/adapter.types.js";

const roots: string[] = [];

const makeRoot = (adapterId = "test-adapter"): { readonly root: string; readonly dbPath: string } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portal-adapters-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "adapters"), { recursive: true });
  fs.mkdirSync(path.join(root, "taxonomy"), { recursive: true });
  fs.writeFileSync(path.join(root, "adapters", "adapters.json"), JSON.stringify({ adapters_version: "1.0.0", adapters: [{ adapter_id: adapterId, name: "Test", refresh_mode: "scheduled", trigger_intents: ["benefit_check"], fetch_params: { region: { type: "taxonomy_region_enum" }, limit: { type: "integer", default: 2 } } }] }));
  fs.writeFileSync(path.join(root, "taxonomy", "v1.0.json"), JSON.stringify({ closed_enum: { region: { values: { seoul: {}, busan: {} } } } }));
  const dbPath = path.join(root, "compiled.sqlite");
  const db = new Database(dbPath);
  db.exec("CREATE TABLE data_records (record_id TEXT NOT NULL, adapter_id TEXT NOT NULL, region TEXT NOT NULL, period TEXT NOT NULL, last_fetched_at TEXT NOT NULL, call_status TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (adapter_id, record_id))");
  db.close();
  return { root, dbPath };
};

const adapter = (behavior: "ok" | "error"): ApiAdapter => ({
  registration: { adapter_id: "test-adapter", name: "Test", refresh_mode: "scheduled", trigger_intents: ["benefit_check"], fetch_params: {} },
  async fetch(params: AdapterFetchParams): Promise<DataRecord[]> {
    if (behavior === "error") throw new Error("boom");
    return [{ record_id: `row-${params.region ?? "none"}`, adapter_id: "test-adapter", region: params.region ?? "nationwide", period: "2026-05", payload: { value: 1 } }];
  },
  normalize(): DataRecord[] { return []; },
  sourceManifest(callStatus: SourceManifest["call_status"]): SourceManifest {
    return { adapter_id: "test-adapter", agency: "agency", api_name: "api", last_updated: "2026-05-26T00:00:00.000Z", call_status: callStatus, auth_type: "public" };
  },
});

const rows = (dbPath: string): readonly { readonly call_status: string; readonly payload_json: string }[] => {
  const db = new Database(dbPath, { readonly: true });
  try { return db.prepare("SELECT call_status, payload_json FROM data_records ORDER BY record_id").all() as { readonly call_status: string; readonly payload_json: string }[]; }
  finally { db.close(); }
};

afterEach(() => {
  while (roots.length > 0) fs.rmSync(String(roots.pop()), { recursive: true, force: true });
});

describe("compile-adapters", () => {
  it("writes error rows without throwing on adapter fetch errors", async () => {
    const { root, dbPath } = makeRoot();
    await expect(compileAdapters({ catalogRoot: root, dbPath, adapters: [adapter("error")], logger: () => undefined })).resolves.toBeDefined();
    expect(rows(dbPath).map((row) => row.call_status)).toEqual(["error", "error"]);
  });

  it("round-trips successful payload_json rows", async () => {
    const { root, dbPath } = makeRoot();
    await compileAdapters({ catalogRoot: root, dbPath, adapters: [adapter("ok")], logger: () => undefined });
    expect(rows(dbPath).map((row) => JSON.parse(row.payload_json))).toEqual([{ value: 1 }, { value: 1 }]);
  });

  it("throws for unknown adapter_id in adapters.json", async () => {
    const { root, dbPath } = makeRoot("missing-adapter");
    await expect(compileAdapters({ catalogRoot: root, dbPath, adapters: [], logger: () => undefined })).rejects.toThrow(/unknown adapter_id/u);
  });
});
