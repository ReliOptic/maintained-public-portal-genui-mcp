export interface AdapterFetchParams {
  readonly region?: string;
  readonly period?: string;
  readonly domain_filter?: string;
  readonly limit?: number;
}

export interface SourceManifest {
  readonly adapter_id: string;
  readonly agency: string;
  readonly api_name: string;
  readonly last_updated: string;
  readonly call_status: "ok" | "timeout" | "error" | "mock";
  readonly auth_type: "public" | "key_required";
}

export interface AdapterSource {
  readonly agency: string;
  readonly api_name: string;
  readonly auth_type: SourceManifest["auth_type"];
  readonly status?: "live" | "fixture" | "unavailable";
  readonly url?: string;
}

export interface DataRecord {
  readonly record_id: string;
  readonly adapter_id: string;
  readonly region: string;
  readonly period: string;
  readonly payload: Readonly<Record<string, string | number | null>>;
}

export interface DataSection {
  readonly type: "metric_cards" | "data_table" | "chart" | "source_list";
  readonly title: string;
  readonly rows: readonly DataRecord[];
  readonly source: SourceManifest;
  readonly error?: string;
}

export interface AdapterParamSchema {
  readonly region?: { readonly type: "taxonomy_region_enum" };
  readonly period?: { readonly type: string };
  readonly domain_filter?: { readonly type: "enum"; readonly values: readonly string[] };
  readonly limit?: { readonly type: "integer"; readonly default: number };
}

export interface AdapterRegistration {
  readonly adapter_id: string;
  readonly name: string;
  readonly description?: string;
  readonly refresh_mode: "scheduled" | "on_demand";
  readonly availability?: "available" | "unavailable" | "parked";
  readonly output_section_id?: string;
  readonly trigger_intents: readonly string[];
  readonly data_sections?: readonly string[];
  readonly supported_regions?: readonly string[];
  readonly fetch_params: AdapterParamSchema;
  readonly proxy_url?: string;
  readonly source?: AdapterSource;
  readonly credential_boundary?: "none" | "server_proxy_required" | "decision_required";
  readonly status_reason?: string;
  readonly adr_reference?: string;
}

export interface ApiAdapter {
  readonly registration: AdapterRegistration;
  fetch(params: AdapterFetchParams): Promise<DataRecord[]>;
  normalize(raw: unknown): DataRecord[];
  sourceManifest(callStatus: SourceManifest["call_status"]): SourceManifest;
}
