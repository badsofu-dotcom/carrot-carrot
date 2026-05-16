# IMPLEMENTATION_REPORT_PR-45.md — FarmDropLayer 위치 영역 재정의

기존 sky 영역 (top 12-25%) → 산 라인 아래 농장 활동 영역 (top 45-85%) + spot 클러스터 weighted random.

## 클러스터 풀

| ID | weight | top % | left % | 의미 |
| --- | --- | --- | --- | --- |
| fence-inside | 30 | 60-70 | 25-75 | plot 영역 사이 (울타리 안) — 가장 흔함 |
| fence-outside | 25 | 70-85 | 10-90 | 울타리 바깥 잔디 — 두 번째 |
| mushroom-house | 15 | 75-85 | 8-22 | 좌측 하단 버섯집 주변 |
| tree-base | 15 | 70-82 | 78-92 | 우측 하단 나무 밑 |
| well | 10 | 55-65 | 8-20 | 좌측 중간 우물 근처 |
| random-low | 5 | 45-85 | 10-90 | fallback (어디든 낮은 영역) |

총 가중치 100. spawn 마다 cluster pick → cluster 안에서 uniform random.

## 변경

`src/components/Farm/FarmDropLayer.tsx`:
- `SpotCluster` interface + `SPOT_CLUSTERS` 배열 + `pickSpot(rng)` 헬퍼 신규.
- 기존 hardcoded `top 12-25 / left 15-85` 제거. spawn() 안에서 `pickSpot` → 클러스터 박스 안 random.

## 변경 영향

- BuffIndicator (top 42 px), 헤더 영역 (top 0-10%) 과 겹치지 않음 (drop top ≥ 45%).
- ToolDock (bottom 8 px ≈ top 92-100%) 와도 안 겹침 (drop top ≤ 85%).
- BG 자산의 실제 위치 (버섯집/나무/우물) 추정값 — 실제 PNG 와 미세 차이는 사용자 piloting 으로 튜닝 가능.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 101/101 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-47 (드랍 잔존 정책 — 무한 표시 + 일일 cap 12 + 동시 3).
