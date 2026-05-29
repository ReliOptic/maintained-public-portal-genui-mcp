import { describe, expect, it } from "vitest";
import { regionNativeCodeMappings, resolveRegionNativeCodes } from "./region-code-lookup.js";

describe("region native-code lookup", () => {
  it("keeps the Daejeon Yuseong mapping as validated reference data", () => {
    expect(regionNativeCodeMappings).toEqual([
      {
        regionKey: "daejeon_yuseong",
        label: "Daejeon Yuseong-gu",
        lawdCd: "30200",
        zscode: "30200",
        ctpvNm: "대전광역시",
        signguNm: "유성구"
      }
    ]);
  });

  it("resolves daejeon_yuseong into every native upstream key needed by later providers", () => {
    expect(resolveRegionNativeCodes("daejeon_yuseong")).toEqual({
      status: "mapped",
      codes: {
        regionKey: "daejeon_yuseong",
        label: "Daejeon Yuseong-gu",
        lawdCd: "30200",
        zscode: "30200",
        ctpvNm: "대전광역시",
        signguNm: "유성구"
      }
    });

    expect(resolveRegionNativeCodes("대전광역시 유성구")).toMatchObject({
      status: "mapped",
      codes: { lawdCd: "30200", zscode: "30200" }
    });
  });

  it("returns a gap for unknown regions instead of fabricating native API parameters", () => {
    expect(resolveRegionNativeCodes("unknown_region")).toEqual({
      status: "gap",
      region: "unknown_region",
      gap: "Unknown region; no native upstream codes are available, so regional evidence providers must not fabricate API parameters."
    });
  });
});
