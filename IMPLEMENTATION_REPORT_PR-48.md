# IMPLEMENTATION_REPORT_PR-48.md — 광고 채널 보물진행 랜덤 보상

기존 "보물 진행 +1 (별 +1)" 고정 보상을 6 종 풀에서 weighted random 으로 교체.

## 변경

### `src/components/Inventory/AdRewardChannelModal.tsx`

`case "treasure"` 의 `addItem("star", 1)` 단일 grant 를 6 옵션 random pick 으로 교체:

| 보상 | 확률 | 처리 |
| --- | --- | --- |
| ⭐ 별 +1 | 35 % | `addItem("star", 1)` |
| 💎 보석 +1 | 25 % | `addItem("gem", 1)` |
| 🌱 씨앗 +3 | 15 % | `growAllPlanted(0, null, 3)` |
| 🍬 캔디 당근 +1 | 10 % | `incCandyCarrots(1)` |
| ⚡ 번개 +1 | 10 % | `addItem("bolt", 1)` |
| ✨ 황금 당근 +1 | 5 % | `incGoldenCarrots(1)` |

`addTreasureProgress(1)` 은 그대로 (모든 claim 마다). 채널 카드 label/hint:
- `"보물 진행 +1 (별 +1)"` → `"보물 진행 +1 (랜덤 보상)"`
- `"주간 보물상자에 한 발 더"` → `"별/보석/씨앗/캔디/번개/황금 중 1종"`

toast 결과: `🎁 보물 진행 +1 · ⭐ 별 +1` 형식 (선택된 보상 라벨 표시).

## EV 분석

- per treasure claim EV: 0.10 × 5 (candy) + 0.05 × 10 (golden) = **1.0 P**
- 일일 1 회 claim 평균 → 일일 +1 P
- 100 P 캡 영향 미미. ECONOMY_DESIGN.md 의 N-th tier (50 P) 와 daily-gift (2 P) + weekly treasure (5 P) 등과 합쳐도 cap 안전.

## 변경 파일

1. `src/components/Inventory/AdRewardChannelModal.tsx` — claim 분기 + 채널 카드 라벨/힌트.
2. `ECONOMY_DESIGN.md` — 광고 채널 보물 진행 랜덤 보상 표 신규 섹션 추가.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 101/101 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-45 (드랍 위치 영역 재정의).
