import { AdapterDiscoveryResponseSchema, type AdapterDescriptor, type AdapterDiscoveryResponse } from "@mcp-gen-ui-gateway/schema";

const GENERATED_AT = "2026-05-29T00:00:00.000Z";
const FIXTURE_REGION = "daejeon_yuseong";

const scheduledFixtureAdapters: readonly AdapterDescriptor[] = [
  {
    id: "apt-rent-price-kr",
    title: "Apartment rent transaction adapter",
    description: "Scheduled fixture-backed rent snapshot for regional housing context.",
    refreshMode: "scheduled",
    availability: "available",
    outputSectionId: "apt-rent-price-kr",
    triggerIntents: ["housing", "local"],
    dataSections: ["apt-rent-price-kr"],
    supportedRegions: [FIXTURE_REGION],
    source: {
      id: "apt-rent-price-kr",
      name: "MOLIT apartment rent transactions",
      status: "fixture",
      url: "https://www.data.go.kr/data/15126474/openapi.do"
    },
    credentialBoundary: "none"
  },
  {
    id: "population-stats-kr",
    title: "Resident population adapter",
    description: "Scheduled fixture-backed population and household snapshot for regional context.",
    refreshMode: "scheduled",
    availability: "available",
    outputSectionId: "population-stats-kr",
    triggerIntents: ["local", "policy_information"],
    dataSections: ["population-stats-kr"],
    supportedRegions: [FIXTURE_REGION],
    source: {
      id: "population-stats-kr",
      name: "MOIS resident population status",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108071/openapi.do"
    },
    credentialBoundary: "none"
  },
  {
    id: "parking-info-kr",
    title: "Parking lot adapter",
    description: "Scheduled fixture-backed public and private parking lot snapshot.",
    refreshMode: "scheduled",
    availability: "available",
    outputSectionId: "parking-info-kr",
    triggerIntents: ["local", "mobility"],
    dataSections: ["parking-info-kr"],
    supportedRegions: [FIXTURE_REGION],
    source: {
      id: "parking-info-kr",
      name: "Yuseong-gu parking lot information",
      status: "fixture",
      url: "https://www.data.go.kr/data/15110051/fileData.do"
    },
    credentialBoundary: "none"
  },
  {
    id: "cctv-status-kr",
    title: "CCTV installation adapter",
    description: "Scheduled fixture-backed CCTV installation snapshot for local safety context.",
    refreshMode: "scheduled",
    availability: "available",
    outputSectionId: "cctv-status-kr",
    triggerIntents: ["local", "safety"],
    dataSections: ["cctv-status-kr"],
    supportedRegions: [FIXTURE_REGION],
    source: {
      id: "cctv-status-kr",
      name: "Yuseong-gu CCTV installation status",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108837/fileData.do"
    },
    credentialBoundary: "none"
  },
  {
    id: "population-by-dong-kr",
    title: "Administrative-dong population adapter",
    description: "Scheduled fixture-backed dong-level population and household snapshot.",
    refreshMode: "scheduled",
    availability: "available",
    outputSectionId: "population-by-dong-kr",
    triggerIntents: ["local", "policy_information"],
    dataSections: ["population-by-dong-kr"],
    supportedRegions: [FIXTURE_REGION],
    source: {
      id: "population-by-dong-kr",
      name: "MOIS population by administrative dong",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108071/openapi.do"
    },
    credentialBoundary: "none"
  }
];

const gatedAdapters: readonly AdapterDescriptor[] = [
  {
    id: "ev-chargers-kr",
    title: "EV charger availability adapter",
    description: "Declared but unavailable until on-demand proxying and failure disclosure are implemented.",
    refreshMode: "on_demand",
    availability: "unavailable",
    outputSectionId: "ev-chargers-kr",
    triggerIntents: ["mobility", "local"],
    dataSections: ["ev-chargers-kr"],
    supportedRegions: [FIXTURE_REGION],
    source: {
      id: "ev-chargers-kr",
      name: "Korea Environment Corporation EV charger status",
      status: "unavailable",
      url: "https://www.data.go.kr/data/15076352/openapi.do"
    },
    credentialBoundary: "server_proxy_required",
    statusReason: "Live EV availability requires a server-side key boundary and explicit unavailable-state UX."
  },
  {
    id: "korean-law-evidence",
    title: "Korean law evidence adapter",
    description: "Parked until the legal-evidence role and safety boundary are accepted.",
    refreshMode: "on_demand",
    availability: "parked",
    triggerIntents: ["policy_information", "legal_reference"],
    dataSections: [],
    supportedRegions: [],
    source: {
      id: "korean-law-evidence",
      name: "Korean law MCP",
      status: "unavailable"
    },
    credentialBoundary: "decision_required",
    statusReason: "ADR-0022 Option A/B/C must be accepted before live legal lookup or legal text handling.",
    adrReference: "ADR-0022"
  }
];

export function getAdapterDiscovery(): AdapterDiscoveryResponse {
  return AdapterDiscoveryResponseSchema.parse({
    resourceUri: "resource://adapters/v1",
    adapters: [...scheduledFixtureAdapters, ...gatedAdapters],
    generatedAt: GENERATED_AT
  });
}
