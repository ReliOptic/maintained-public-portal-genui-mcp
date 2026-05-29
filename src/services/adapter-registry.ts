import type { AdapterRegistration, DataRecord, DataSection, SourceManifest } from "../types/adapter.types.js";
import { welfareFacilityKrAdapter } from "./adapters/welfare-facility-kr.js";
import { dataGoRegionalAdapters } from "./adapters/data-go-regional-fixtures.js";

const adapters = [welfareFacilityKrAdapter, ...dataGoRegionalAdapters] as const;
const implementations = new Map(adapters.map((adapter) => [adapter.registration.adapter_id, adapter]));

interface RegistryPayload {
  readonly adapters_version: string;
  readonly adapters: readonly AdapterRegistration[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const asStrings = (value: unknown): readonly string[] => Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
const isRefreshMode = (value: unknown): value is AdapterRegistration["refresh_mode"] => value === "scheduled" || value === "on_demand";
const isAvailability = (value: unknown): value is NonNullable<AdapterRegistration["availability"]> =>
  value === "available" || value === "unavailable" || value === "parked";
const isAuthType = (value: unknown): value is SourceManifest["auth_type"] => value === "public" || value === "key_required";
const isSourceStatus = (value: unknown): value is NonNullable<NonNullable<AdapterRegistration["source"]>["status"]> =>
  value === "live" || value === "fixture" || value === "unavailable";
const isCredentialBoundary = (value: unknown): value is NonNullable<AdapterRegistration["credential_boundary"]> =>
  value === "none" || value === "server_proxy_required" || value === "decision_required";

const optionalString = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined;

const sourceFrom = (value: unknown): AdapterRegistration["source"] | undefined => {
  if (!isRecord(value) || !isAuthType(value.auth_type)) return undefined;
  const agency = optionalString(value.agency);
  const apiName = optionalString(value.api_name);
  const url = optionalString(value.url);
  if (!agency || !apiName) return undefined;
  return {
    agency,
    api_name: apiName,
    auth_type: value.auth_type,
    ...(isSourceStatus(value.status) ? { status: value.status } : {}),
    ...(url ? { url } : {}),
  };
};

export const validateAdapterRegistration = (value: unknown): AdapterRegistration => {
  if (!isRecord(value)) throw new Error("adapter registration must be an object");
  const refresh = value.refresh_mode;
  if (!isRefreshMode(refresh)) throw new Error("adapter registration refresh_mode must be scheduled or on_demand");
  if (value.availability !== undefined && !isAvailability(value.availability)) {
    throw new Error("adapter registration availability must be available, unavailable, or parked");
  }
  const availability = value.availability ?? "available";
  const source = sourceFrom(value.source);
  const registration = {
    adapter_id: String(value.adapter_id ?? ""),
    name: String(value.name ?? ""),
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
    refresh_mode: refresh,
    availability,
    ...(optionalString(value.output_section_id) ? { output_section_id: optionalString(value.output_section_id) } : {}),
    trigger_intents: asStrings(value.trigger_intents),
    data_sections: asStrings(value.data_sections),
    supported_regions: asStrings(value.supported_regions),
    fetch_params: isRecord(value.fetch_params) ? value.fetch_params : {},
    ...(typeof value.proxy_url === "string" ? { proxy_url: value.proxy_url } : {}),
    ...(source ? { source } : {}),
    ...(isCredentialBoundary(value.credential_boundary) ? { credential_boundary: value.credential_boundary } : {}),
    ...(optionalString(value.status_reason) ? { status_reason: optionalString(value.status_reason) } : {}),
    ...(optionalString(value.adr_reference) ? { adr_reference: optionalString(value.adr_reference) } : {}),
  };
  if (!registration.adapter_id || !registration.name) throw new Error("adapter registration missing identity");
  if (registration.refresh_mode === "on_demand" && registration.availability === "available" && !registration.proxy_url) {
    throw new Error(`${registration.adapter_id} on_demand adapter requires proxy_url`);
  }
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
  return registrations.filter((reg) =>
    (reg.availability ?? "available") === "available" && reg.trigger_intents.some((trigger) => intentSet.has(trigger)));
};

const statusFrom = (rows: readonly DataRecord[]): SourceManifest["call_status"] => {
  const status = rows.map((row) => row.payload.call_status).find((value) => typeof value === "string");
  return status === "mock" || status === "timeout" || status === "error" ? status : "ok";
};

export const sourceManifestFor = (adapterId: string, rows: readonly DataRecord[], callStatus?: SourceManifest["call_status"]): SourceManifest => {
  const adapter = implementations.get(adapterId);
  if (!adapter) throw new Error(`unknown adapter implementation: ${adapterId}`);
  return adapter.sourceManifest(callStatus ?? statusFrom(rows));
};

export const dataSectionFor = (registration: AdapterRegistration, rows: readonly DataRecord[], callStatus?: SourceManifest["call_status"]): DataSection | undefined => {
  if (rows.length === 0) return undefined;
  const source = sourceManifestFor(registration.adapter_id, rows, callStatus);
  return { type: "data_table", title: registration.name, rows, source, ...(source.call_status === "error" ? { error: "adapter_fetch_error" } : {}) };
};

export const getAdapterImplementation = (adapterId: string) => implementations.get(adapterId);
