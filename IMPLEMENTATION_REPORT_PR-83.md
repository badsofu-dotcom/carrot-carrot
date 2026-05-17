# IMPLEMENTATION_REPORT_PR-83.md — fixed-light surface contrast 부분 PR-80 revert

## 중요 발견 — PR-80 의 부작용

PR-80 (`#888` → `var(--text-tertiary, #888)`) 가 일부 사이트에서 dark mode contrast 를 **악화** 시켰음:

| 사이트 (8개) | bg | text | 이전 (#888) contrast | PR-80 후 (#b3a691 dark var) contrast |
| --- | --- | --- | --- | --- |
| GemTradeModal sub | #FFF8EE (fixed) | tertiary | 3.34:1 | **2.27:1** ❌ |
| RewardsPanel 3 사이트 | #FFF8EE (fixed) | tertiary | 3.34:1 | **2.27:1** ❌ |
| AdRewardChannelModal 2 사이트 | #FFF8EE (fixed) | tertiary | 3.34:1 | **2.27:1** ❌ |
| InventoryModal 2 사이트 | #FFF8EE (fixed) | tertiary | 3.34:1 | **2.27:1** ❌ |

원인: `--text-tertiary` 는 **theme-aware** 토큰 (dark 시 lighter). 모달 bg 는 `#FFF8EE` **fixed light** — 둘 다 light = contrast 실패.

## 해결 — fixed dark grey

fixed-light bg 위에서는 fixed dark text 사용:

```diff
- color: "var(--text-tertiary, #888)"
+ color: "#6a6055"
```

`#6a6055` on `#FFF8EE` contrast = **5.8:1** (AA pass, 안전 마진 포함). dark mode 변화 무관 (양쪽 모두 같은 dark grey).

## 적용 사이트 (10개)

| 파일 | 변경 |
| --- | --- |
| `InventoryModal.tsx` (2 사이트) | `var(--text-tertiary, #888)` → `#6a6055` |
| `AdRewardChannelModal.tsx` (2 사이트) | 同上 |
| `GemTradeModal.tsx` (1 사이트) | 同上 |
| `RewardsPanel.tsx` (3 사이트) | 同上 |
| `DailyMissionsCard.tsx` mission item caption | 同上 |
| `WeeklyMissionsCard.tsx` mission item caption | 同上 |

DailyMissionsCard/WeeklyMissionsCard 의 카드 **outer header** 의 `var(--text-tertiary)` 는 유지 — 그곳은 `var(--bg-elevated)` (theme-aware) bg 이라 token 정상 작동.

## AdRewardChannelModal ChannelRow label 추가 fix

```diff
- <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{label}</span>
+ <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#2b2b2b" }}>{label}</span>
```

이전: color 미지정 → body inherited → dark mode 시 light text on white card = 보이지 않음.
PR-83: fixed `#2b2b2b` (AAA 15.8:1).

## 신규 테스트 — 4 case

| 케이스 | 검증 |
| --- | --- |
| `#6a6055` on `#FFF8EE` >= 4.5 | AA |
| `#2b2b2b` on `#fff` >= 7 | AAA |
| `#666` on `#fff` >= 5 | AA + 여유 |
| 4 modal 파일에 `var(--text-tertiary)` 잔여 0 | 회귀 차단 |

총 **188 / 188 pass** (184 → 188).

## 가이드라인 추가

향후 작업자를 위한 메모 (코드 내 comment):
- **theme-aware bg** (`var(--bg-elevated)` 등) 위 → `var(--text-*)` token 사용
- **fixed light bg** (`#FFF8EE`, `#fff`) 위 → fixed dark text (`#2b2b2b` heading, `#6a6055` caption)
- **fixed dark bg** 없음 (현재) — 추후 도입 시 fixed light text

## 변경 파일

- `src/components/Inventory/InventoryModal.tsx`
- `src/components/Inventory/AdRewardChannelModal.tsx`
- `src/components/Inventory/GemTradeModal.tsx`
- `src/components/Farm/RewardsPanel.tsx`
- `src/features/missions/DailyMissionsCard.tsx`
- `src/features/missions/WeeklyMissionsCard.tsx`
- `src/lib/darkModeContrast.test.mjs` — 4 신규 test + hex shorthand 지원

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 188 / 188 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
