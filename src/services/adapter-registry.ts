import type { AdapterRegistration, DataRecord, DataSection, SourceManifest } from "../types/adapter.types.js";
import { welfareFacilityKrAdapter } from "./adapters/welfare-facility-kr.js";

const adapters = [welfareFacilityKrAdapter] as const;
const implementations = new Map(adapters.map((adapter) => [adapter.registration.adapter_id, adapter]));

interface RegistryPayload {
  readonly adapters_version: string;
  readonly adapters: readonly AdapterRegistration[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const asStrings = (value: unknown): readonly string[] => Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];

export const validateAdapterRegistration = (value: unknown): AdapterRegistration => {
  if (!isRecord(value)) throw new Error("adapter registration must be an object");
  const refresh = value.refresh_mode;
  const registration = {
    adapter_id: String(value.adapter_id ?? ""),
    name: String(value.name ?? ""),
    refresh_mode: refresh === "on_demand" ? "on_demand" as const : "scheduled" as const,
    trigger_intents: asStrings(value.trigger_intents),
    fetch_params: isRecord(value.fetch_params) ? value.fetch_params : {},
    ...(typeof value.proxy_url === "string" ? { proxy_url: value.proxy_url } : {}),
  };
  if (!registration.adapter_id || !registration.name) throw new Error("adapter registration missing identity");
  if (registration.refresh_mode === "on_demand" && !registration.proxy_url) throw new Error(`${registration.adapter_id} on_demand adapter requires proxy_url`);
  return registration as AdapterRegistration;
};

export const parseAdapterRegistry = (payload: unknown): RegistryPayload => {
  if (!isRecord(payload) || !Array.isArray(payload.adapters)) throw new Error("adapters registry payload is invalid");
  return { adapters_version: String(payload.adapters_version ?? ""), adapters: payload.adapters.map(validateAdapterRegistration) };
};

export const matchingAdapters = (
  registrations: readonly AdapterRegistration[],
  intent: readonly string[] = [],
): AdapterRegistration[] => {
  if (intent.length === 0) return [];
  const intentSet = new Set(intent);
  return registrations.filter((reg) => reg.trigger_intents.some((trigger) => intentSet.has(trigger)));
};

const statusFrom = (rows: readonly DataRecord[]): SourceManifest["call_status"] => {
  const status = rows.map((row) => row.payload.call_status).find((value) => typeof value === "string");
  return status === "mock" || status === "timeout" || status === "error" ? status : "ok";
};

export const sourceManifestFor = (adapterId: string, rows: readonly DataRecord[]): SourceManifest => {
  const adapter = implementations.get(adapterId);
  if (!adapter) throw new Error(`unknown adapter implementation: ${adapterId}`);
  return adapter.sourceManifest(statusFrom(rows));
};

export const dataSectionFor = (registration: AdapterRegistration, rows: readonly DataRecord[]): DataSection | undefined => {
  if (rows.length === 0) return undefined;
  const source = sourceManifestFor(registration.adapter_id, rows);
  return { type: "data_table", title: registration.name, rows, source, ...(source.call_status === "error" ? { error: "adapter_fetch_error" } : {}) };
};

export const getAdapterImplementation = (adapterId: string) => implementations.get(adapterId);
