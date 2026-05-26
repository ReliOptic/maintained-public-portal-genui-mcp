import { getRuntimeConfig } from "../../config/runtime.js";
import type { AdapterFetchParams, ApiAdapter, DataRecord, SourceManifest } from "../../types/adapter.types.js";

const ADAPTER_ID = "welfare-facility-kr";
const AGENCY = "보건복지부";
const API_NAME = "사회복지시설 현황";
const ENDPOINT = "https://api.odcloud.kr/api/15001848/v1/uddi";

type RawRow = Readonly<Record<string, unknown>>;

const regionMap: Readonly<Record<string, string>> = {
  서울특별시: "seoul", 서울: "seoul", 부산광역시: "busan", 부산: "busan", 대구광역시: "daegu", 대구: "daegu",
  인천광역시: "incheon", 인천: "incheon", 광주광역시: "gwangju", 광주: "gwangju", 대전광역시: "daejeon", 대전: "daejeon",
  울산광역시: "ulsan", 울산: "ulsan", 세종특별자치시: "sejong", 세종: "sejong", 경기도: "gyeonggi", 강원특별자치도: "gangwon",
  강원도: "gangwon", 충청북도: "chungbuk", 충북: "chungbuk", 충청남도: "chungnam", 충남: "chungnam", 전북특별자치도: "jeonbuk",
  전라북도: "jeonbuk", 전북: "jeonbuk", 전라남도: "jeonnam", 전남: "jeonnam", 경상북도: "gyeongbuk", 경북: "gyeongbuk",
  경상남도: "gyeongnam", 경남: "gyeongnam", 제주특별자치도: "jeju", 제주: "jeju",
};

const asRecord = (value: unknown): RawRow => typeof value === "object" && value !== null && !Array.isArray(value) ? value as RawRow : {};
const asString = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const monthStamp = (date = new Date()): string => date.toISOString().slice(0, 7);
const field = (row: RawRow, keys: readonly string[]): string => keys.map((key) => asString(row[key])).find((value) => value.length > 0) ?? "";
const regionFrom = (value: string): string => regionMap[value] ?? regionMap[value.replace(/\s+/gu, "")] ?? "nationwide";

const rawRows = (raw: unknown): RawRow[] => {
  const root = asRecord(raw);
  const rows = Array.isArray(root.data) ? root.data : Array.isArray(root.items) ? root.items : Array.isArray(raw) ? raw : [];
  return rows.map(asRecord);
};

const mockRecord = (params: AdapterFetchParams): DataRecord => ({
  record_id: `${ADAPTER_ID}_${params.region ?? "nationwide"}_mock`,
  adapter_id: ADAPTER_ID,
  region: params.region ?? "nationwide",
  period: params.period ?? monthStamp(),
  payload: {
    시설명: "복지시설 현황 샘플",
    주소: "공공데이터 API 키 미설정으로 로컬 샘플을 표시합니다.",
    전화번호: "",
    운영시간: "",
    대상자: "",
    서비스종류: params.domain_filter ?? "사회복지관",
    call_status: "mock",
  },
});

const normalizeRows = (raw: unknown): DataRecord[] => rawRows(raw).map((row, index) => {
  const code = field(row, ["시설코드", "시설ID", "시설번호", "id"]);
  const sido = field(row, ["시도명", "시도", "지역", "주소시도"]);
  return {
    record_id: `${ADAPTER_ID}_${code || index + 1}`,
    adapter_id: ADAPTER_ID,
    region: regionFrom(sido),
    period: monthStamp(),
    payload: {
      시설명: field(row, ["시설명", "시설명칭", "기관명"]),
      주소: field(row, ["주소", "소재지도로명주소", "소재지지번주소"]),
      전화번호: field(row, ["전화번호", "대표전화", "연락처"]),
      운영시간: field(row, ["운영시간", "이용시간"]),
      대상자: field(row, ["대상자", "이용대상"]),
      서비스종류: field(row, ["시설종류", "시설유형", "서비스종류"]),
    },
  };
});

const fetchRemote = async (params: AdapterFetchParams, key: string): Promise<unknown> => {
  const url = new URL(`${ENDPOINT}:${encodeURIComponent(key)}`);
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", String(params.limit ?? 20));
  url.searchParams.set("returnType", "JSON");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`welfare API failed: ${response.status}`);
  return response.json() as Promise<unknown>;
};

export const welfareFacilityKrAdapter: ApiAdapter = {
  registration: {
    adapter_id: ADAPTER_ID,
    name: API_NAME,
    refresh_mode: "scheduled",
    trigger_intents: ["benefit_check", "benefit_application"],
    fetch_params: { region: { type: "taxonomy_region_enum" }, period: { type: "YYYY-MM" }, limit: { type: "integer", default: 20 } },
  },
  async fetch(params) {
    const key = getRuntimeConfig().welfareApiKey;
    if (!key) return [mockRecord(params)];
    const rows = normalizeRows(await fetchRemote(params, key));
    const filtered = params.region ? rows.filter((row) => row.region === params.region || row.region === "nationwide") : rows;
    return filtered.slice(0, params.limit ?? 20);
  },
  normalize: normalizeRows,
  sourceManifest(callStatus): SourceManifest {
    return { adapter_id: ADAPTER_ID, agency: AGENCY, api_name: API_NAME, last_updated: new Date().toISOString(), call_status: callStatus, auth_type: "key_required" };
  },
};
