# IMPLEMENTATION_REPORT_PR-65.md — 도감 진행도 surface + GemTrade 부족 UX

PR-63 에서 wire 한 패시브를 사용자에게 보이게 + GemTradeModal 의 disabled 옵션이 왜 비활성인지 명확히.

## A. AchievementsCard — 패시브 banner

`src/features/collection/AchievementsCard.tsx`

도전과제 그리드 위에 새 banner 추가:
- 좌: `🐰 도감 N마리`
- 우: `다음: <nextPassiveLabel>` (FF7B61 orange) 또는 `모든 패시브 달성` (22a06b green)
- 그라데이션 배경 `#fff4dc → #ffe6cf` (꿀빛) — 도감의 "달성 경로" 라는 의미

useCollectionStore 의 `ownedCharacters.length` 를 selector 로 read.
`nextPassiveLabel(n)` (PR-38 부터 존재) 가 25 이상일 때 `null` → green 완료 라벨.

## B. GemTradeModal — 부족 UX 강화

`src/components/Inventory/GemTradeModal.tsx`

기존: disabled 시 회색 배경 + cursor not-allowed 만. 사용자가 왜 안 되는지 알기 어려움.

추가:
- `aria-label` — `${title} — 보석 N개 부족` (또는 `보석 M개 사용`) 으로 접근성 강화.
- emoji 에 `filter: grayscale(0.6)` (canUse=false 시) — 시각적 disabled 신호.
- title 아래 새 shortfall 라인: `보석 N개 더 필요해요` (color #b86a52, 10px bold).
- `opacity: 0.85` (canUse=false 시) — 명도 차이로 그룹 내 구분 강화.
- 비활성 옵션도 클릭 영역은 유지 (button 자체는 그대로) — 사용자가 탭해도 보석을 잃지 않음 (disabled).

## 변경 파일

- `src/features/collection/AchievementsCard.tsx`
- `src/components/Inventory/GemTradeModal.tsx`

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
