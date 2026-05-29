import type { AdapterFetchParams, ApiAdapter, DataRecord, SourceManifest } from "../../types/adapter.types.js";

const GENERATED_AT = "2026-05-29T00:00:00.000Z";
const REGION = "daejeon";
const PERIOD = "2026-04";

type PayloadValue = string | number | null;
type Payload = Readonly<Record<string, PayloadValue>>;

interface FixtureDefinition {
  readonly adapterId: string;
  readonly name: string;
  readonly triggerIntents: readonly string[];
  readonly agency: string;
  readonly apiName: string;
  readonly authType: SourceManifest["auth_type"];
  readonly sourceUrl: string;
  readonly rows: readonly Payload[];
}

const yuseongCodes = {
  lawd_cd: "30200",
  zscode: "30200",
  ctpv_nm: "대전광역시",
  signgu_nm: "유성구",
};

const definitions: readonly FixtureDefinition[] = [
  {
    adapterId: "apt-rent-price-kr",
    name: "아파트 전월세 실거래",
    triggerIntents: ["policy_information", "address_change"],
    agency: "국토교통부",
    apiName: "아파트 전월세 실거래자료",
    authType: "key_required",
    sourceUrl: "https://www.data.go.kr/data/15126474/openapi.do",
    rows: [
      { ...yuseongCodes, deal_ym: "202604", apartment: "Doan Xi", rent_type: "jeonse", deposit_manwon: 32000, monthly_rent_manwon: 0, legal_dong: "도안동" },
      { ...yuseongCodes, deal_ym: "202604", apartment: "Yuseong Prugio", rent_type: "jeonse", deposit_manwon: 28000, monthly_rent_manwon: 0, legal_dong: "봉명동" },
      { ...yuseongCodes, deal_ym: "202604", apartment: "Noeun Hanshin", rent_type: "monthly", deposit_manwon: 10000, monthly_rent_manwon: 65, legal_dong: "노은동" },
    ],
  },
  {
    adapterId: "population-stats-kr",
    name: "주민등록 인구 현황",
    triggerIntents: ["data_search", "dataset_download", "policy_information"],
    agency: "행정안전부",
    apiName: "주민등록 인구 및 세대현황",
    authType: "key_required",
    sourceUrl: "https://www.data.go.kr/data/15108071/openapi.do",
    rows: [
      { ...yuseongCodes, stat_ym: "202603", total_population: 342000, total_households: 142000, average_household_size: 2.4 },
    ],
  },
  {
    adapterId: "parking-info-kr",
    name: "주차장 현황",
    triggerIntents: ["data_search", "policy_information"],
    agency: "대전광역시 유성구",
    apiName: "주차장 정보",
    authType: "public",
    sourceUrl: "https://www.data.go.kr/data/15110051/fileData.do",
    rows: [
      { ...yuseongCodes, parking_name: "유성온천 공영주차장", parking_kind: "public", spaces: 120 },
      { ...yuseongCodes, parking_name: "봉명 민영주차장", parking_kind: "private", spaces: 64 },
    ],
  },
  {
    adapterId: "cctv-status-kr",
    name: "CCTV 설치 현황",
    triggerIntents: ["data_search", "policy_information"],
    agency: "대전광역시 유성구",
    apiName: "CCTV 설치 현황",
    authType: "public",
    sourceUrl: "https://www.data.go.kr/data/15108837/fileData.do",
    rows: [
      { ...yuseongCodes, location: "궁동 123", camera_count: 2, purpose: "crime_prevention" },
      { ...yuseongCodes, location: "봉명동 20", camera_count: 3, purpose: "traffic_safety" },
    ],
  },
  {
    adapterId: "population-by-dong-kr",
    name: "행정동 인구 현황",
    triggerIntents: ["data_search", "dataset_download", "policy_information"],
    agency: "행정안전부",
    apiName: "행정동별 주민등록 인구",
    authType: "key_required",
    sourceUrl: "https://www.data.go.kr/data/15108071/openapi.do",
    rows: [
      { ...yuseongCodes, dong: "온천1동", population: 27800, households: 13500 },
      { ...yuseongCodes, dong: "노은1동", population: 31500, households: 12100 },
    ],
  },
];

const supportsRegion = (params: AdapterFetchParams): boolean => !params.region || params.region === REGION;

const recordsFor = (definition: FixtureDefinition, params: AdapterFetchParams): DataRecord[] => {
  if (!supportsRegion(params)) return [];
  const limit = params.limit ?? 20;
  return definition.rows.slice(0, limit).map((payload, index) => ({
    record_id: `${definition.adapterId}_${REGION}_${index + 1}`,
    adapter_id: definition.adapterId,
    region: REGION,
    period: params.period ?? PERIOD,
    payload: { ...payload, call_status: "mock" },
  }));
};

const adapterFor = (definition: FixtureDefinition): ApiAdapter => ({
  registration: {
    adapter_id: definition.adapterId,
    name: definition.name,
    refresh_mode: "scheduled",
    availability: "available",
    output_section_id: definition.adapterId,
    trigger_intents: definition.triggerIntents,
    data_sections: [definition.adapterId],
    supported_regions: [REGION],
    fetch_params: { region: { type: "taxonomy_region_enum" }, period: { type: "YYYY-MM" }, limit: { type: "integer", default: 20 } },
    source: {
      agency: definition.agency,
      api_name: definition.apiName,
      auth_type: definition.authType,
      status: "fixture",
      url: definition.sourceUrl,
    },
    credential_boundary: "none",
  },
  async fetch(params) {
    return recordsFor(definition, params);
  },
  normalize(raw) {
    return Array.isArray(raw) ? recordsFor(definition, { region: REGION, limit: raw.length }) : [];
  },
  sourceManifest(callStatus): SourceManifest {
    return {
      adapter_id: definition.adapterId,
      agency: definition.agency,
      api_name: definition.apiName,
      last_updated: GENERATED_AT,
      call_status: callStatus,
      auth_type: definition.authType,
    };
  },
});

export const dataGoRegionalAdapters: readonly ApiAdapter[] = definitions.map(adapterFor);
