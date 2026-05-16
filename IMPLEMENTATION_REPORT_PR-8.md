# IMPLEMENTATION_REPORT_PR-8.md — 당근 주스 (juice) live

옵션 C 두 번째. `juice` 의 "(미구현)" 토스트를 실제 작동하는 buff 로 교체.

## A. 디자인

**Effect**: 다음 단일 수확 가챠에서 캔디 확률 +5 %p. 다른 보너스 (perfect-combo, comboStreak ≥ 5) 와 가산 스택.

**Activation**: 가방 → 도구 아이템 → 당근 주스 "사용". 1 개 소비 → `buffsStore.juiceActive` 플래그 ON.

**Consumption**: 다음 수확 시 `FarmHub.harvest` 가 `useBuffsStore.consume("juice")` 로 atomic read+clear. 1 회 한정.

### 밸런싱 결정 (autonomous-mode 보고)

- `JUICE_CANDY_BONUS = 0.05` (5 %p). 기존 `HARVEST_BASE_CANDY = 0.04` 대비 두 배 이상의 임시 부스트 — 1회 한정 + drop 빈도가 낮은 (오늘의 선물상자 일부) 아이템이므로 EV 영향은 미미.
- 누적 가챠 폭 (perfect-combo 12 % + comboStreak 1 % + juice 5 % = 18 %) 도 bunny/golden 밴드를 침범하지 않음 (테스트로 검증).

## B. 변경 파일

### 신규
1. **`src/features/collection/buffsStore.ts`** — zustand 스토어. `juiceActive`/`soupActive`/`cakeActive` 3 개 플래그 + `activate(kind)` / `consume(kind)` (atomic read+clear). `safeStorage` 영속. PR-9/10 가 soup/cake 와이어업 시 동일 패턴 재사용 예정.

### 수정
2. **`src/lib/seasonalBunny.ts`**:
   - `JUICE_CANDY_BONUS = 0.05` 상수 export
   - `RollOpts` 에 `juiceActive?: boolean` 옵션 추가
   - `rollHarvestGacha` 의 candy 분기에서 `juiceActive` 면 `candyP += 0.05` 누적
3. **`src/features/collection/FarmHub.tsx`**:
   - `useBuffsStore` import
   - 수확 직전 `useBuffsStore.getState().consume("juice")` 로 플래그 read+clear → `rollHarvestGacha({ juiceActive })` 호출
4. **`src/components/Inventory/InventoryModal.tsx`**:
   - `useBuffsStore` import
   - `case "juice"`: 더 이상 "(미구현)" 토스트 아님 — `useBuffsStore.getState().activate("juice")` + 토스트 "🥤 다음 수확 캔디 확률 +5%p"
5. **`src/lib/seasonalBunny.test.mjs`**:
   - `JUICE_CANDY_BONUS` 상수 sanity 추가
   - 3 개 신규 케이스: juice 단독 widening / perfect-combo 위에 stack / bunny·golden 비침해
6. **`FARM_RULES.md`** — `## 당근 주스 (juice) — PR-8` 섹션 추가.

## C. 영향 분석

- **기존 buff 시스템 부재** — `buffsStore` 가 첫 buff 보관소. 단일 store 로 3 종 (juice/soup/cake) 통합 관리.
- **수확 hot-path overhead** — `useBuffsStore.getState().consume("juice")` 는 1 회 분기 검사 + 잠재적 `set` 호출. 매 수확마다 호출되지만 동기 + zustand 의 가벼운 set. 부담 없음.
- **TODO 매트릭스 (CLAUDE.md §9)** — `InventoryModal.tsx:104` `(미구현)` 항목 제거.
- **buffsStore 영속화** — tab reload 시 활성 buff 유지. 다른 기기/세션 간 동기화는 안 됨 (worker schema 의도적 미연동). 자율 모드 정책상 DB 마이그 생성 시 보고 — 본 PR 은 마이그 미생성.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **90/90 pass** (이전 87 + seasonalBunny 신규 3) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

`build:ait` 는 PR-6 와 동일 경로 검증 완료. PR-8 은 client-only — asset/worker types 변동 없음, 추가 실행 생략.

## E. Maintainer 후속 조치

없음. DB 마이그/시크릿/wrangler 불필요.

## F. 다음 작업

PR-9 `soup` — 다음 물뿌리개 충전 시 +1 charge. `toolStore.refillFromAd` (또는 새 일반 refill 메서드) 가 `useBuffsStore.consume("soup")` 으로 buff 를 소비하고 `MAX_DAILY + 1` 한도 적용. 자율 모드 이어감.
