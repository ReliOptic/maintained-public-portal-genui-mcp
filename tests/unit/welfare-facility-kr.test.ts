import { afterEach, describe, expect, it, vi } from "vitest";
import { welfareFacilityKrAdapter } from "../../src/services/adapters/welfare-facility-kr.js";

describe("welfare-facility-kr adapter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes public-data rows into DataRecords", () => {
    const rows = welfareFacilityKrAdapter.normalize({ data: [{ 시설코드: "A1", 시도명: "서울특별시", 시설명: "서울복지관", 주소: "서울", 전화번호: "02", 운영시간: "09-18", 대상자: "노인", 시설종류: "노인복지관" }] });
    expect(rows[0]).toMatchObject({ record_id: "welfare-facility-kr_A1", adapter_id: "welfare-facility-kr", region: "seoul" });
    expect(rows[0]?.payload).toMatchObject({ 시설명: "서울복지관", 서비스종류: "노인복지관" });
  });

  it("falls back to nationwide when 시도명 is missing", () => {
    const rows = welfareFacilityKrAdapter.normalize({ data: [{ 시설코드: "A2", 시설명: "전국시설" }] });
    expect(rows[0]?.region).toBe("nationwide");
  });

  it("returns mock records when WELFARE_API_KEY is unset", async () => {
    vi.stubEnv("WELFARE_API_KEY", "");
    const rows = await welfareFacilityKrAdapter.fetch({ region: "seoul" });
    expect(rows[0]?.payload.call_status).toBe("mock");
  });

  it("builds a source manifest", () => {
    expect(welfareFacilityKrAdapter.sourceManifest("ok")).toMatchObject({ adapter_id: "welfare-facility-kr", agency: "보건복지부", api_name: "사회복지시설 현황", call_status: "ok", auth_type: "key_required" });
  });
});
