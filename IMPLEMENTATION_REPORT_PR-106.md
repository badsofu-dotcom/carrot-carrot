# IMPLEMENTATION_REPORT_PR-106.md — 다크 모드 heading 누락 사이트 fix (PR-84 후속)

## 발견 (사용자 보고 + grep)

PR-84 (Round 11) 가 일부 modal heading 만 `color: "#2b2b2b"` 명시. 잔여 누락 사이트:

| 컴포넌트 | h3/h2 | bg | 이전 color | PR-106 |
| --- | --- | --- | --- | --- |
| InventoryModal DetailPanel `<h3>{def.ko}</h3>` | (item name) | fixed #fff | inherited (dark mode invisible) | fixed `#2b2b2b` |
| BuffInfoPopover `<h3>{meta.displayName}</h3>` | (버프 이름) | fixed #FFF8EE | inherited | fixed `#2b2b2b` |
| AdSuggestionModal `<h3>{detail.title}</h3>` | (광고 제안 제목) | fixed #FFF8EE | inherited | fixed `#2b2b2b` |
| BunnyGachaModal `<h2>{bunny.name}</h2>` | (토끼 이름) | fixed #FFF8EE | inherited | fixed `#2b2b2b` |

## 통일 원칙 (PR-83/84 가이드라인 일관)

- **fixed light bg** (`#FFF8EE`, `#fff`) 위 → fixed dark text (`#2b2b2b` heading / `#6a6055` caption / `#666` hint)
- **theme-aware bg** (`var(--bg-elevated)` 등) 위 → `var(--text-*)` token

PR-106 의 4 사이트 모두 fixed light bg 위 inheriting heading → fixed `#2b2b2b` 명시.

## 검증 — 다른 fixed-light 사이트

추가 grep 결과 다른 누락 없음:
- `VisitorBunny`, `HiddenBunnyLayer/Peek`, `FarmDropLayer` — h tag 없음
- `SessionOverlay` — theme-aware bg + theme-aware color (정상)
- `AbandonModal`, `CustomDurationSheet` — theme-aware
- `BunnyOnboardingModal` — 검증, theme-aware

## 변경 파일

- `src/components/Inventory/InventoryModal.tsx` — DetailPanel h3 명시
- `src/features/buffs/BuffInfoPopover.tsx` — h3 명시
- `src/components/Farm/AdSuggestionModal.tsx` — h3 명시
- `src/components/Inventory/BunnyGachaModal.tsx` — h2 명시

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 233 / 233 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
