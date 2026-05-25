# Maintainer Review Queue

## catalog-growth-iteration-001 — unresolved sensitive-domain queue

- recorded_at: `2026-05-25T19:02:53+09:00`
- queue_source: `catalog/v1.0.0/entries/*.json` where `sensitive_domain != null`.
- total_sensitive_candidates: `10968`
- counts_by_sensitive_domain: `{'welfare': 10160, 'family': 470, 'tax': 301, 'immigration': 37}`
- expansion_status: exact per-candidate expansion is intentionally not committed here because `10968` rows would violate the repository ≤200-lines/file guardrail.
- exact_reproduction_command:

```bash
python3 - <<'PY2'
import json, pathlib
for p in sorted(pathlib.Path('catalog/v1.0.0/entries').glob('*.json')):
    e=json.loads(p.read_text())
    if e.get('sensitive_domain'):
        print(e.get('entry_id'), e.get('sensitive_domain'), e.get('access_mode'), e.get('confidence_score'), e.get('title'))
PY2
```

- maintainer_action_required: approve/reject sensitive-domain candidates outside this automated run, then re-run `npm run compile && npm run coverage`.

## catalog-growth-iteration-002 — exact current maintainer queue

- recorded_at: `2026-05-25T19:45:00+09:00`
- review_agent_escalations: `23` candidates below require maintainer decision before auto-accept.
- coverage_approval_blocker: `36` compiled `life_event=immigration` entries lack `maintainer_approved=true`; coverage remains blocked at `0%` approval.

### Review Agent escalations

- `01KS6FPN000NPBCFEFNNVP9GRD` — welfare / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:welfare` / 교육급여 수급자 증명서 발급
- `01KS6FPN000TRRR1GH5TB8WZEM` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 국세 납부
- `01KS6FPN000WM3VA57T3QKJ100` — tax / portal_handoff / confidence `0.72` / reasons `confidence_lt_0.85, sensitive_domain_maintainer:tax` / 종합소득세 신고
- `01KS6FPN003Z030C6KCGA39J8Z` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 사업자등록 신청
- `01KS6FPN0046GXDPT9YG4K1S38` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 원천세 신고
- `01KS6FPN004JBPV5RNC5XAB5J7` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 근로장려금 신청
- `01KS6FPN004RBZSNM2S33SCBAE` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 부가가치세 신고도움 조회
- `01KS6FPN004S8M8H68DX1ASNCG` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 법인세 신고
- `01KS6FPN005KQ5VT7AD05HGHXQ` — immigration / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:immigration` / 외국인체류확인서 발급
- `01KS6FPN005QD5X2JRPEQS73HN` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 휴업 신고
- `01KS6FPN0066ZQ8T401G7HMQ8G` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 양도소득세 신고
- `01KS6FPN00A5MT8X3EK960KDS1` — welfare / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:welfare` / 차상위계층 확인서 발급
- `01KS6FPN00CH7HE2K8QW5HGQHC` — family / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:family` / 가정위탁보호확인서 발급
- `01KS6FPN00CRHK6A12PZ3DX8HA` — immigration / portal_handoff / confidence `0.72` / reasons `confidence_lt_0.85, sensitive_domain_maintainer:immigration` / 선박국적증서 영역서 발급
- `01KS6FPN00D2GNH44K77F3PBQC` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 사업자등록 정정 신고
- `01KS6FPN00J0T5PZA7GDMAAXNA` — tax / portal_handoff / confidence `0.72` / reasons `confidence_lt_0.85, sensitive_domain_maintainer:tax` / 부가가치세 신고
- `01KS6FPN00N17CF6HQBER3SZ80` — welfare / portal_handoff / confidence `0.72` / reasons `confidence_lt_0.85, sensitive_domain_maintainer:welfare` / 정부24 보조금24 맞춤안내 조회
- `01KS6FPN00N2TE3SVB0M272NTM` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 폐업 신고
- `01KS6FPN00PC5TYN0XEYZHCXRZ` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 연말정산 간소화 자료 조회
- `01KS6FPN00Q0NQ5K48EZZ46F7Z` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 자녀장려금 신청
- `01KS6FPN00RXNREABYPDHMGNRT` — immigration / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:immigration` / 국적취득 사실증명서 발급
- `01KS6FPN00T67EMVCC8V46VKSS` — immigration / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:immigration` / 국적 관련 사실증명 발급
- `01KS6FPN00ZASYPABDS1ZZD6M8` — tax / portal_handoff / confidence `0.88` / reasons `sensitive_domain_maintainer:tax` / 종합소득세 신고도움 조회

### Coverage-gate immigration approvals required

- `01KS6FPN00ERGGWDE5DFSKNDYS` — api_cached / confidence `0.85` / 결혼이민자 국적취득 비용(수수료) 지원
- `01KS6FPN00BDWHE4EZRP66DYAV` — api_cached / confidence `0.85` / 결혼이민자 국적취득 축하비 지원
- `01KS6FPN002AJGFZ3S0Y1Q0909` — api_cached / confidence `0.85` / 결혼이민자 국적취득비용(수수료) 지원
- `01KS6FPN00PBRW0KA37WK3DXR6` — api_cached / confidence `0.85` / 결혼이민자 등 국적취득 비용 지원
- `01KS6FPN00T67EMVCC8V46VKSS` — portal_handoff / confidence `0.88` / 국적 관련 사실증명 발급
- `01KS6FPN00RXNREABYPDHMGNRT` — portal_handoff / confidence `0.88` / 국적취득 사실증명서 발급
- `01KS6FPN008R8KY33W0GRWC7E4` — api_cached / confidence `0.85` / 국적취득비용(수수료)지원
- `01KS6FPN0069EM5WC7SYCREA1H` — api_cached / confidence `0.85` / 국적취득축하금
- `01KS6FPN00JD61QNFA78DQ6AG8` — api_cached / confidence `0.85` / 귀화허가, 국적회복허가 신청 및 국적업무 증명서 발급 수수료 면제 안내
- `01KS6FPN00CEH8MRDG57RXMRGB` — api_cached / confidence `0.85` / 기상악화 시 공항체류객 지원
- `01KS6FPN00ZT7SNKPW2EA6YPRB` — api_cached / confidence `0.85` / 다문화 가족 및 국내체류 외국인 대상 운전면허교실 운영 지원
- `01KS6FPN00FJ1S9K82GB1GN01G` — api_cached / confidence `0.85` / 다문화가족 국적취득자 지원
- `01KS6FPN004J3RPDT0EMWEC8BZ` — api_cached / confidence `0.85` / 무료 소송대리 서비스(국내거주외국인)
- `01KS6FPN00W6PX9718040PG3BH` — api_cached / confidence `0.85` / 서비스형 외국인투자지역 임대료 지원
- `01KS6FPN00N20B39KJV2JD5HXR` — api_cached / confidence `0.85` / 여성결혼이민자 국적취득비 및 기술취득비 지원
- `01KS6FPN00JG4SSHD033Z83MXK` — api_cached / confidence `0.85` / 외국인 고용허가제
- `01KS6FPN00NQVMNEMZ61341MZS` — api_cached / confidence `0.85` / 외국인 관광객 유치 인센티브 지원
- `01KS6FPN00YZ8DJ0X3HWG1ET9X` — api_cached / confidence `0.85` / 외국인 근로자 지원 서비스
- `01KS6FPN00X91MHHAKM60T7BYJ` — api_cached / confidence `0.85` / 외국인 범죄 예방교실 운영 지원
- `01KS6FPN00K0AKZGW8QKZH3YPZ` — api_cached / confidence `0.85` / 외국인 선원 숙소 지원
- `01KS6FPN0098Q7ZY46KTZ0V6H2` — api_cached / confidence `0.85` / 외국인 아동(0~2세) 보육료 지원
- `01KS6FPN00SG1DD5ME26DZSE4X` — api_cached / confidence `0.85` / 외국인 아동(누리3~5세) 보육료 지원
- `01KS6FPN00Q4XAK3A7V5CYS3Z7` — api_cached / confidence `0.85` / 외국인 유아(만3~5세)  운영비 지원
- `01KS6FPN00EM05G7Q18D33JWRY` — api_cached / confidence `0.85` / 외국인 주민 EMS 요금 할인 지원
- `01KS6FPN00A0ZSZXXX82WVW0S5` — api_cached / confidence `0.85` / 외국인 주민 긴급 지원
- `01KS6FPN00VNZJ09EWGYC8FGN8` — api_cached / confidence `0.85` / 외국인 체류지변경신고 절차 간소화
- `01KS6FPN0076BE7B9ZM7ZWVVJP` — api_cached / confidence `0.85` / 외국인 피해자 지원제도 안내·연계 서비스
- `01KS6FPN00M23YFWV4E5G1NYGW` — api_cached / confidence `0.85` / 외국인계절근로자 도입 운영 지원
- `01KS6FPN00ZGCDP2X4C52PGFAM` — api_cached / confidence `0.85` / 외국인근로자 의료비 지원
- `01KS6FPN00JGQ46RSKSJW6A9VN` — api_cached / confidence `0.85` / 외국인아동보육료 지원
- `01KS6FPN00NSMTPAJGKKK2Y16D` — api_cached / confidence `0.85` / 외국인여성 출산가사 돌보미 지원
- `01KS6FPN00SMJD4DE8XM8E2Q1D` — api_cached / confidence `0.85` / 외국인자녀 보육료 추가 지원
- `01KS6FPN005KQ5VT7AD05HGHXQ` — portal_handoff / confidence `0.88` / 외국인체류확인서 발급
- `01KS6FPN00B73Y3VM6X9PB69YH` — api_cached / confidence `0.85` / 외국인투자기업 현금지원
- `01KS6FPN00278T2GXEWVSD059R` — api_cached / confidence `0.85` / 이민자체류실태 및 고용조사 통계조사원 일자리 제공
- `01KS6FPN00YMP3FE0R63YPS91B` — api_cached / confidence `0.85` / 청주시 외국인주민 지원센터
