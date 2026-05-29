import type { AdapterDiscoveryResponse, BenefitDetail, BenefitSearchResponse } from "@mcp-gen-ui-gateway/schema";

export const demoSearchResponse: BenefitSearchResponse = {
  query: "신혼부부 프리랜서가 대전 유성구로 이사할 때 확인할 주거와 고용 지원",
  profile: {
    region: "daejeon_yuseong",
    ageRange: "thirties",
    studentStatus: "unknown",
    employmentStatus: "self_employed",
    householdType: "couple",
    interests: ["housing", "employment", "local"]
  },
  generatedAt: "2026-05-29T00:00:00.000Z",
  dataSections: [
    {
      id: "apt-rent-price-kr",
      title: "Apartment rent transaction snapshot",
      region: "daejeon_yuseong",
      source: {
        id: "apt-rent-price-kr",
        name: "MOLIT apartment rent transactions",
        status: "fixture",
        url: "https://www.data.go.kr/data/15126474/openapi.do"
      },
      metrics: [
        { label: "LAWD_CD", value: "30200" },
        { label: "Average jeonse deposit", value: 30000, unit: "10k KRW" },
        { label: "Transaction count", value: 3, unit: "rows" }
      ],
      rows: [
        {
          dealYm: "202604",
          apartment: "Doan Xi",
          rentType: "jeonse",
          depositManwon: 32000,
          monthlyRentManwon: 0,
          legalDong: "Doan-dong"
        }
      ],
      generatedAt: "2026-05-29T00:00:00.000Z"
    },
    {
      id: "population-stats-kr",
      title: "Resident population snapshot",
      region: "daejeon_yuseong",
      source: {
        id: "population-stats-kr",
        name: "MOIS resident population status",
        status: "fixture",
        url: "https://www.data.go.kr/data/15108071/openapi.do"
      },
      metrics: [
        { label: "ctpvNm", value: "대전광역시" },
        { label: "signguNm", value: "유성구" },
        { label: "Total population", value: 342000, unit: "people" }
      ],
      rows: [],
      generatedAt: "2026-05-29T00:00:00.000Z"
    },
    {
      id: "ev-chargers-kr",
      title: "EV charger availability",
      region: "daejeon_yuseong",
      source: {
        id: "ev-chargers-kr",
        name: "Korea Environment Corporation EV charger status",
        status: "unavailable",
        url: "https://www.data.go.kr/data/15076352/openapi.do"
      },
      metrics: [
        { label: "zscode", value: "30200" },
        { label: "Activation status", value: "disabled until on-demand proxy and failure disclosure exist" }
      ],
      rows: [],
      generatedAt: "2026-05-29T00:00:00.000Z"
    }
  ],
  results: [
    {
      id: "daejeon-newlywed-housing-loan",
      title: "대전 신혼부부 주거비 지원",
      provider: "대전광역시",
      category: "housing",
      summary: "대전 거주 신혼부부의 전월세 보증금과 주거비 부담을 낮추기 위한 후보 지원 사업입니다.",
      status: "candidate",
      reasons: ["daejeon_yuseong 지역 조건과 일치합니다.", "나이대 조건과 일치합니다."],
      missingInfo: []
    },
    {
      id: "self-employed-employment-stability",
      title: "자영업자 고용안정 지원",
      provider: "고용노동부",
      category: "employment",
      summary: "프리랜서와 자영업자가 소득 변동기에 확인할 수 있는 고용·직업훈련 후보 지원입니다.",
      status: "candidate",
      reasons: ["고용 상태 조건과 일치합니다."],
      missingInfo: []
    }
  ]
};

export const demoBenefitDetail: BenefitDetail = {
  id: "daejeon-newlywed-housing-loan",
  title: "대전 신혼부부 주거비 지원",
  provider: "대전광역시",
  category: "housing",
  summary: "대전 거주 신혼부부의 전월세 보증금과 주거비 부담을 낮추기 위한 후보 지원 사업입니다.",
  target: "대전광역시에 거주하거나 전입 예정인 신혼부부 중 공고 조건을 충족하는 가구",
  eligibility: ["대전 거주 또는 전입 예정", "신혼부부 또는 예비부부", "주택 및 소득 기준 확인 필요"],
  applicationPeriod: "공고별 상이",
  fee: "없음",
  processingTime: "공고별 상이",
  documents: [
    { id: "marriage-proof", label: "혼인관계 또는 예식 예정 확인 서류", required: true, source: "program" },
    { id: "lease-contract", label: "임대차계약서 또는 주거 예정 확인 서류", required: true, source: "program" },
    { id: "income-proof", label: "소득 확인 서류", required: true, source: "program" }
  ],
  applicationMethods: ["공고문 확인 후 온라인 또는 방문 신청"],
  applicationUrl: "https://www.gov.kr/portal/service",
  sourceUrl: "https://www.gov.kr/portal/service",
  lastFetchedAt: "2026-05-29T00:00:00.000Z",
  evidence: []
};

export const demoAdapterDiscovery: AdapterDiscoveryResponse = {
  resource_uri: "resource://adapters/v1",
  adapters_version: "v1",
  generated_at: "2026-05-29T00:00:00.000Z",
  adapters: [
    {
      adapter_id: "apt-rent-price-kr",
      name: "Apartment rent transaction adapter",
      description: "Fixture-backed scheduled rent section for Daejeon Yuseong.",
      refresh_mode: "scheduled",
      availability: "available",
      output_section_id: "apt-rent-price-kr",
      trigger_intents: ["housing", "local"],
      data_sections: ["apt-rent-price-kr"],
      supported_regions: ["daejeon_yuseong"],
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
      description: "Fixture-backed scheduled population section for Daejeon Yuseong.",
      refresh_mode: "scheduled",
      availability: "available",
      output_section_id: "population-stats-kr",
      trigger_intents: ["local", "policy_information"],
      data_sections: ["population-stats-kr"],
      supported_regions: ["daejeon_yuseong"],
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
      description: "Fixture-backed scheduled parking section for Daejeon Yuseong.",
      refresh_mode: "scheduled",
      availability: "available",
      output_section_id: "parking-info-kr",
      trigger_intents: ["local", "mobility"],
      data_sections: ["parking-info-kr"],
      supported_regions: ["daejeon_yuseong"],
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
      description: "Fixture-backed scheduled CCTV section for Daejeon Yuseong.",
      refresh_mode: "scheduled",
      availability: "available",
      output_section_id: "cctv-status-kr",
      trigger_intents: ["local", "safety"],
      data_sections: ["cctv-status-kr"],
      supported_regions: ["daejeon_yuseong"],
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
      description: "Fixture-backed scheduled dong-level population section for Daejeon Yuseong.",
      refresh_mode: "scheduled",
      availability: "available",
      output_section_id: "population-by-dong-kr",
      trigger_intents: ["local", "policy_information"],
      data_sections: ["population-by-dong-kr"],
      supported_regions: ["daejeon_yuseong"],
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
    },
    {
      adapter_id: "ev-chargers-kr",
      name: "EV charger availability adapter",
      description: "Unavailable until server-side on-demand proxying exists.",
      refresh_mode: "on_demand",
      availability: "unavailable",
      output_section_id: "ev-chargers-kr",
      trigger_intents: ["mobility", "local"],
      data_sections: ["ev-chargers-kr"],
      supported_regions: ["daejeon_yuseong"],
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
      status_reason: "Live EV availability requires a server-side key boundary."
    },
    {
      adapter_id: "korean-law-evidence",
      name: "Korean law evidence adapter",
      description: "Parked until ADR-0022 Option A/B/C is accepted.",
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
      status_reason: "ADR-0022 role decision required before legal lookup or legal text handling.",
      adr_reference: "ADR-0022"
    }
  ]
};
