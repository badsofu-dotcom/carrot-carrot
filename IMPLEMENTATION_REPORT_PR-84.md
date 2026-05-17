# IMPLEMENTATION_REPORT_PR-84.md — fixed-light card 내 inheriting text 정리

## 자율 발견 — heading text 색 미지정

PR-83 follow-through 검토 중 발견: 모달 헤더 / 카드 heading 텍스트가 `color` 미지정 → body inherited color 사용. 모달 bg 는 fixed `#FFF8EE` 인데 body color 는 theme-aware (dark mode 시 light text). 결과:

| 사이트 | bg | 텍스트 | dark mode 동작 |
| --- | --- | --- | --- |
| RewardsPanel `<h2>보상함</h2>` | #FFF8EE | inherited | **invisible** ❌ |
| RewardsPanel 토스포인트 `{points}P` | #fff | inherited | **invisible** ❌ |
| RewardsPanel "오늘의 선물 받기" | #fff | inherited | **invisible** ❌ |
| RewardsPanel "보물상자 열기 준비됨!" | #fff | inherited | **invisible** ❌ |
| InventoryModal `<h2>내 가방</h2>` | #FFF8EE | inherited | **invisible** ❌ |
| AdRewardChannelModal `<h3>어떤 보상을 받을까요?</h3>` | #FFF8EE | inherited | **invisible** ❌ |
| GemTradeModal `<h3>💎 보석 사용</h3>` | #FFF8EE | inherited | **invisible** ❌ |

PR-83 이 caption / sub 만 fix, heading 은 누락. 이게 user 가 본 "광고 카드 텍스트 너무 밝음" 원인 가능성 높음.

## 해결

모든 heading 에 fixed `#2b2b2b` 명시:

```diff
- <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>보상함</h2>
+ <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#2b2b2b" }}>보상함</h2>
```

Contrast `#2b2b2b` on `#FFF8EE` = **14.6:1** AAA. `#2b2b2b` on `#fff` = **15.8:1** AAA.

또한 RewardsPanel 토스포인트 카드 의 sub line `color: "#777"` 를 `#6a6055` 로 격상 (4.51 → 5.8:1).

## 변경 사이트 (8개)

| 파일 | h2/h3 / 카드 heading |
| --- | --- |
| `RewardsPanel.tsx` | 보상함 h2, 토스포인트 P, 오늘의 선물, 보물상자 — 4 사이트 |
| `InventoryModal.tsx` | 내 가방 h2 |
| `AdRewardChannelModal.tsx` | 어떤 보상을 받을까요? h3 |
| `GemTradeModal.tsx` | 💎 보석 사용 h3 |

`#777` → `#6a6055` (RewardsPanel 토스포인트 sub): 1 사이트.

## 테스트

PR-83 의 darkModeContrast.test.mjs 가 이미 fixed `#2b2b2b` on `#fff` >= 7 검증 — 통과 유지. 신규 test 불필요 (회귀는 PR-83 의 grep test 가 cover).

총 **188 / 188 pass**.

## 가이드라인 강화

향후 작업자를 위해 (PR-83 가이드라인 확장):
- **fixed light bg 위 모든 heading text** → 명시적 `color: "#2b2b2b"` 사용. body inherited 의존 금지 (dark mode 에서 invisible).
- **fixed light bg 위 caption** → `#6a6055` (PR-83).
- **fixed light bg 위 hint** → `#666` 도 OK (5.7:1).

## 변경 파일

- `src/components/Farm/RewardsPanel.tsx` — 5 spot (h2 + 3 card heading + #777→#6a6055)
- `src/components/Inventory/InventoryModal.tsx` — h2 색 추가
- `src/components/Inventory/AdRewardChannelModal.tsx` — h3 색 추가
- `src/components/Inventory/GemTradeModal.tsx` — h3 색 추가

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 188 / 188 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
