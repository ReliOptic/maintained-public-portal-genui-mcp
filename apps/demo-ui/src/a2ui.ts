import type { AdapterDiscoveryResponse, BenefitDetail, BenefitSearchResponse, DataSection } from "@mcp-gen-ui-gateway/schema";

export type A2UIBlock =
  | { type: "section"; id: string; title: string }
  | { type: "benefit-card"; id: string; title: string; provider: string; status: string; summary: string; reasons: string[]; missingInfo: string[] }
  | {
      type: "adapter-discovery";
      id: string;
      title: string;
      resourceUri: string;
      adapters: AdapterDiscoveryResponse["adapters"];
    }
  | { type: "data-section"; id: string; title: string; region: string; source: string; metrics: DataSection["metrics"] }
  | { type: "checklist"; id: string; title: string; items: { id: string; label: string; required: boolean }[] }
  | { type: "steps"; id: string; title: string; steps: { title: string; description: string }[] }
  | { type: "notice"; id: string; text: string };

export function benefitSearchToA2UI(
  response: BenefitSearchResponse,
  detail: BenefitDetail,
  adapterDiscovery?: AdapterDiscoveryResponse
): A2UIBlock[] {
  return [
    {
      type: "section",
      id: "query-summary",
      title: `"${response.query}" 검색 결과`
    },
    ...(adapterDiscovery
      ? [
          {
            type: "adapter-discovery" as const,
            id: "adapter-discovery",
            title: "Adapter discovery",
            resourceUri: adapterDiscovery.resourceUri,
            adapters: adapterDiscovery.adapters
          }
        ]
      : []),
    ...response.results.map((result) => ({
      type: "benefit-card" as const,
      id: result.id,
      title: result.title,
      provider: result.provider,
      status: result.status,
      summary: result.summary,
      reasons: result.reasons,
      missingInfo: result.missingInfo
    })),
    ...response.dataSections.map((section) => ({
      type: "data-section" as const,
      id: section.id,
      title: section.title,
      region: section.region,
      source: `${section.source.name} (${section.source.status})`,
      metrics: section.metrics
    })),
    {
      type: "checklist",
      id: `${detail.id}-checklist`,
      title: "신청 준비 체크리스트",
      items: detail.documents.map((document) => ({
        id: document.id,
        label: document.label,
        required: document.required
      }))
    },
    {
      type: "steps",
      id: `${detail.id}-guide`,
      title: "신청 단계 가이드",
      steps: [
        { title: "대상 조건 확인", description: detail.target },
        { title: "준비물 확인", description: "필수 서류와 추가 확인 조건을 점검합니다." },
        { title: "공식 경로 이동", description: detail.applicationUrl ?? detail.sourceUrl }
      ]
    },
    {
      type: "notice",
      id: "safety",
      text: "이 도구는 확정 자격 판정, 로그인, 본인인증, 제출 자동화를 수행하지 않습니다."
    }
  ];
}
