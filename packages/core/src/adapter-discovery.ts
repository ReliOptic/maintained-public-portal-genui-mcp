import { AdapterDiscoveryResponseSchema, type AdapterDescriptor, type AdapterDiscoveryResponse } from "@mcp-gen-ui-gateway/schema";

const GENERATED_AT = "2026-05-29T00:00:00.000Z";
const FIXTURE_REGION = "daejeon_yuseong";

const scheduledFixtureAdapters: readonly AdapterDescriptor[] = [
  {
    adapter_id: "apt-rent-price-kr",
    name: "Apartment rent transaction adapter",
    description: "Scheduled fixture-backed rent snapshot for regional housing context.",
    refresh_mode: "scheduled",
    availability: "available",
    output_section_id: "apt-rent-price-kr",
    trigger_intents: ["housing", "local"],
    data_sections: ["apt-rent-price-kr"],
    supported_regions: [FIXTURE_REGION],
    fetch_params: {
      region: { type: "taxonomy_region_enum" },
      period: { type: "YYYY-MM" },
      limit: { type: "integer", default: 20 }
    },
    source: {
      agency: "Ministry of Land, Infrastructure and Transport",
      api_name: "Apartment rent transactions",
      auth_type: "key_required",
      status: "fixture",
      url: "https://www.data.go.kr/data/15126474/openapi.do"
    },
    credential_boundary: "none"
  },
  {
    adapter_id: "population-stats-kr",
    name: "Resident population adapter",
    description: "Scheduled fixture-backed population and household snapshot for regional context.",
    refresh_mode: "scheduled",
    availability: "available",
    output_section_id: "population-stats-kr",
    trigger_intents: ["local", "policy_information"],
    data_sections: ["population-stats-kr"],
    supported_regions: [FIXTURE_REGION],
    fetch_params: {
      region: { type: "taxonomy_region_enum" },
      period: { type: "YYYY-MM" },
      limit: { type: "integer", default: 20 }
    },
    source: {
      agency: "Ministry of the Interior and Safety",
      api_name: "Resident population status",
      auth_type: "key_required",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108071/openapi.do"
    },
    credential_boundary: "none"
  },
  {
    adapter_id: "parking-info-kr",
    name: "Parking lot adapter",
    description: "Scheduled fixture-backed public and private parking lot snapshot.",
    refresh_mode: "scheduled",
    availability: "available",
    output_section_id: "parking-info-kr",
    trigger_intents: ["local", "mobility"],
    data_sections: ["parking-info-kr"],
    supported_regions: [FIXTURE_REGION],
    fetch_params: {
      region: { type: "taxonomy_region_enum" },
      period: { type: "YYYY-MM" },
      limit: { type: "integer", default: 20 }
    },
    source: {
      agency: "Daejeon Yuseong-gu",
      api_name: "Parking lot information",
      auth_type: "public",
      status: "fixture",
      url: "https://www.data.go.kr/data/15110051/fileData.do"
    },
    credential_boundary: "none"
  },
  {
    adapter_id: "cctv-status-kr",
    name: "CCTV installation adapter",
    description: "Scheduled fixture-backed CCTV installation snapshot for local safety context.",
    refresh_mode: "scheduled",
    availability: "available",
    output_section_id: "cctv-status-kr",
    trigger_intents: ["local", "safety"],
    data_sections: ["cctv-status-kr"],
    supported_regions: [FIXTURE_REGION],
    fetch_params: {
      region: { type: "taxonomy_region_enum" },
      period: { type: "YYYY-MM" },
      limit: { type: "integer", default: 20 }
    },
    source: {
      agency: "Daejeon Yuseong-gu",
      api_name: "CCTV installation status",
      auth_type: "public",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108837/fileData.do"
    },
    credential_boundary: "none"
  },
  {
    adapter_id: "population-by-dong-kr",
    name: "Administrative-dong population adapter",
    description: "Scheduled fixture-backed dong-level population and household snapshot.",
    refresh_mode: "scheduled",
    availability: "available",
    output_section_id: "population-by-dong-kr",
    trigger_intents: ["local", "policy_information"],
    data_sections: ["population-by-dong-kr"],
    supported_regions: [FIXTURE_REGION],
    fetch_params: {
      region: { type: "taxonomy_region_enum" },
      period: { type: "YYYY-MM" },
      limit: { type: "integer", default: 20 }
    },
    source: {
      agency: "Ministry of the Interior and Safety",
      api_name: "Population by administrative dong",
      auth_type: "key_required",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108071/openapi.do"
    },
    credential_boundary: "none"
  }
];

const gatedAdapters: readonly AdapterDescriptor[] = [
  {
    adapter_id: "ev-chargers-kr",
    name: "EV charger availability adapter",
    description: "Declared but unavailable until on-demand proxying and failure disclosure are implemented.",
    refresh_mode: "on_demand",
    availability: "unavailable",
    output_section_id: "ev-chargers-kr",
    trigger_intents: ["mobility", "local"],
    data_sections: ["ev-chargers-kr"],
    supported_regions: [FIXTURE_REGION],
    fetch_params: {
      region: { type: "taxonomy_region_enum" },
      limit: { type: "integer", default: 20 }
    },
    source: {
      agency: "Korea Environment Corporation",
      api_name: "EV charger status",
      auth_type: "key_required",
      status: "unavailable",
      url: "https://www.data.go.kr/data/15076352/openapi.do"
    },
    credential_boundary: "server_proxy_required",
    status_reason: "Live EV availability requires a server-side key boundary and explicit unavailable-state UX."
  },
  {
    adapter_id: "korean-law-evidence",
    name: "Korean law evidence adapter",
    description: "Parked until the legal-evidence role and safety boundary are accepted.",
    refresh_mode: "on_demand",
    availability: "parked",
    trigger_intents: ["policy_information", "legal_reference"],
    data_sections: [],
    supported_regions: [],
    fetch_params: {},
    source: {
      agency: "Korean law MCP",
      api_name: "Legal evidence lookup",
      auth_type: "key_required",
      status: "unavailable"
    },
    credential_boundary: "decision_required",
    status_reason: "ADR-0022 Option A/B/C must be accepted before live legal lookup or legal text handling.",
    adr_reference: "ADR-0022"
  }
];

export function getAdapterDiscovery(): AdapterDiscoveryResponse {
  return AdapterDiscoveryResponseSchema.parse({
    resource_uri: "resource://adapters/v1",
    adapters_version: "v1",
    adapters: [...scheduledFixtureAdapters, ...gatedAdapters],
    generated_at: GENERATED_AT
  });
}
