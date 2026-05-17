# IMPLEMENTATION_REPORT_PR-77.md — itemsStore 원본 한국어화 + copy lint

## 자율 발견

PR-73 이 `translateAcquisition()` 으로 render-time 영어 토큰을 한국어로 바꿔주지만, **소스 문자열 자체** 가 여전히 영어 token / 영어 단어를 담고 있음:

| Item | Field | Before | After |
| --- | --- | --- | --- |
| seed | acquisition | `daily-gift / focus-tier / cake / weekly-treasure / gem 5→9` | `일일 선물 / 집중 보상 / 케이크 사용 / 주간 보물상자 / 보석 5개 → 씨앗 9개 교환` |
| seed | effect | `(향후 sink 예정)` | `(향후 소비 예정)` |
| heart | effect | `(max 5, 자정 리필 3개)` | `(최대 5개, 자정 리필 3개)` |
| gem | acquisition | `오늘의 선물상자 (2%) / 농장 드랍 (rare)` | `오늘의 선물상자 (2%) / 농장 드랍 (드물게)` |

소스 자체가 한국어면:
- render-time 변환 의존도 ↓ (안전망 으로만 유지)
- 코드 리뷰 시 사용자 노출 텍스트 직접 확인 가능
- 향후 token 시스템 변경 시 broken state 위험 감소

## 추가 — Copy lint 테스트

`src/lib/itemsStoreCopy.test.mjs` 신설. 모든 13 item 의 `acquisition` + `effect` 가 영어 식별자 banned token 없는지 검증 + ko 라벨이 한글 포함 여부.

```js
const BANNED_TOKENS = [
  "daily-gift", "focus-tier", "weekly-treasure", "ad-watch", "farm-drop",
  "(rare)", "(max ", " sink",
];
```

이 lint 가 향후 영어 token 회귀 차단. PR 등 작업 중 실수로 영어 추가 시 즉시 fail.

## 4 신규 tests

| 케이스 | 검증 |
| --- | --- |
| acquisition banned tokens 없음 | 13 item × 8 token 검사 |
| effect banned tokens 없음 | 同上 |
| 13 items 정의 | length check |
| ko 한글 포함 | 모든 item 한국어 라벨 |

총 **162 / 162 pass** (158 → 162).

## translateAcquisition 의 미래

PR-73 의 sourceLabels.ts 는 유지. 두 가지 역할:
1. **안전망** — 다른 acquisition 텍스트에 영어 token 이 새로 들어와도 자동 변환
2. **향후 i18n 확장 지점** — 다국어 지원 추가 시 KOREAN_TOKEN_LABELS 를 locale 별로 swap

소스가 한국어인 현재도 translateAcquisition() 은 통과 (매핑 없으면 그대로) — 안전.

## 변경 파일

- `src/features/collection/itemsStore.ts` — 4 string 정리
- `src/lib/itemsStoreCopy.test.mjs` — 신규 lint 테스트

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 162 / 162 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
