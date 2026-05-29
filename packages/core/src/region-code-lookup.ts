export type RegionNativeCodes = {
  readonly regionKey: string;
  readonly label: string;
  readonly lawdCd: string;
  readonly zscode: string;
  readonly ctpvNm: string;
  readonly signguNm: string;
};

export type RegionCodeResolution =
  | {
      readonly status: "mapped";
      readonly codes: RegionNativeCodes;
    }
  | {
      readonly status: "gap";
      readonly region: string;
      readonly gap: string;
    };

export const regionNativeCodeMappings = [
  {
    regionKey: "daejeon_yuseong",
    label: "Daejeon Yuseong-gu",
    lawdCd: "30200",
    zscode: "30200",
    ctpvNm: "대전광역시",
    signguNm: "유성구"
  }
] as const satisfies readonly RegionNativeCodes[];

const regionAliases = new Map<string, RegionNativeCodes>();

for (const mapping of regionNativeCodeMappings) {
  regionAliases.set(normalizeRegion(mapping.regionKey), mapping);
  regionAliases.set(normalizeRegion(mapping.label), mapping);
  regionAliases.set(normalizeRegion(`${mapping.ctpvNm} ${mapping.signguNm}`), mapping);
  regionAliases.set(normalizeRegion("대전 유성구"), mapping);
}

export function resolveRegionNativeCodes(region: string): RegionCodeResolution {
  const codes = regionAliases.get(normalizeRegion(region));
  if (!codes) {
    return {
      status: "gap",
      region,
      gap: "Unknown region; no native upstream codes are available, so regional evidence providers must not fabricate API parameters."
    };
  }

  return { status: "mapped", codes };
}

function normalizeRegion(region: string): string {
  return region.trim().toLowerCase().replace(/[\s-]+/gu, "_");
}
