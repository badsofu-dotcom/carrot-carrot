# IMPLEMENTATION_REPORT_PR-9.md — 당근 수프 (soup) live

옵션 C 세 번째. `soup` 의 "(미구현)" 토스트를 실제 작동하는 1회 충전 buff 로 교체.

## A. 디자인

**Effect**: 다음 ad-refill 1회 동안 +1 charge (and 한도 lift). 즉 일반 +3 → +4, 천장 `MAX_DAILY` (10) → 11.

**Activation**: 가방 → 도구 아이템 → 당근 수프 "사용". `buffsStore.soupActive` ON.

**Consumption call sites**:
- AdRewardChannelModal 의 watering 채널 ("물뿌리개 충전") 버튼
- InventoryModal 의 bolt (번개) 아이템 사용 — 동등한 광고 보상 refill

**Pre-consume + restore** 패턴: 호출자가 `useBuffsStore.consume("soup")` 으로 먼저 비우고 refill 시도. refill 이 fail (오늘 MAX_AD_REFILLS = 3 도달) 하면 즉시 `activate("soup")` 로 복원 → no-op 에 buff 가 낭비되지 않음.

### 밸런싱 결정 (autonomous-mode 보고)

- soup 1 회 효과: +1 charge (전체 ad-refill 의 ~33 % 부스트).
- 1 일 최대 보너스: MAX_AD_REFILLS = 3 × soup 1 = 최대 +3 charges/day (단, soup 1 회 사용 = 1 충전에만 적용되므로 실질 +1).
- 천장 일시 lift (11/10): 다음날 KST 자정 롤오버 시 다시 10 으로 trim — 누적 효과 없음.

## B. 변경 파일

### 수정
1. **`src/features/collection/toolStore.ts`**:
   - `refillFromAd: () => boolean` → `refillFromAd: (extraCharges?: number) => boolean`
   - 본체: `bonus = Math.max(0, floor(extra))`, `grant = AD_REFILL_AMOUNT + bonus`, `ceiling = MAX_DAILY + bonus`.
   - doc-comment 에 PR-9 의미 명시 + caller pre-consume 가이드.
2. **`src/components/Inventory/AdRewardChannelModal.tsx`**:
   - `useBuffsStore` import
   - watering 케이스: pre-consume soup → `refill(extra)` → fail 시 buff 복원 + 한도 토스트, 성공 시 수프 효과 있으면 "+4 충전 (수프 효과)" 토스트.
3. **`src/components/Inventory/InventoryModal.tsx`**:
   - bolt 케이스: 동일 패턴 (pre-consume → refill(extra) → fail 복원).
   - soup 케이스: "(미구현)" 토스트 → `useBuffsStore.activate("soup")` + "🍲 다음 물뿌리개 충전 +1" 토스트.
4. **`FARM_RULES.md`** — `## 당근 수프 (soup) — PR-9` 섹션.

## C. 영향 분석

- **공개 API 변경**: `refillFromAd` 가 optional 매개변수 도입. 기존 무인자 호출은 전부 컴파일/동작 호환 (default 0). 새 caller 만 명시적으로 1 전달.
- **TODO 매트릭스 (CLAUDE.md §9)** — `InventoryModal.tsx:104` `(미구현)` 항목 제거.
- **buffsStore**: PR-8 의 동일 store, soup 플래그 살아있음 → soup/juice 동시 활성 가능. 두 효과는 독립 (juice = 수확 가챠, soup = 충전).
- **워커**: tools refill 은 client-only state. `refillFromAd` 가 worker /tools/refill 라우트와 분리되어 있음 (PR-2 에 wiring 일부 있으나 client-side 가 SoT). 변경 영향 없음.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **90/90 pass** (PR-8 까지 유지) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

`build:ait` 는 PR-6 path 검증 완료, 본 PR client-only — 생략.

테스트 노트: PR-9 의 변경은 `toolStore.refillFromAd` 의 산술 + caller 패턴 수정. `toolStore` 는 zustand 기반이라 기존 `src/lib/*.test.mjs` 순수 helper 패턴 밖. 향후 PR 에서 `refillFromAd` 산술을 lib/ 의 pure helper 로 추출하면 단위 테스트 가능 — 다만 PR-9 자체 범위는 코드 리뷰로 검증.

## E. Maintainer 후속 조치

없음. DB 마이그/시크릿/wrangler 불필요.

## F. 다음 작업

PR-10 `cake` — 다음 포커스 완료 시 씨앗 +1. `HomePage` (또는 포커스 완료 핸들러) 에서 `useBuffsStore.consume("cake")` → 추가 seed 1 grant. 자율 모드 마지막 옵션 C 항목.
