# IMPLEMENTATION_REPORT_PR-10.md — 당근 케이크 (cake) live

옵션 C 마지막. `cake` 의 "(미구현)" 토스트를 실제 작동하는 1회 포커스-완료 seed 버프로 교체. 이로써 가방의 모든 usable 아이템(`hourglass`/`bolt`/`juice`/`soup`/`cake`/`gem`)이 라이브 효과를 가짐.

## A. 디자인

**Effect**: 다음 *유효한* 포커스 완료 (5 분 게이트 통과) 시 `seedDelta` 에 +1 추가. duration-tier 보상 위에 누적.

**Activation**: 가방 → 도구 아이템 → 당근 케이크 "사용" → `buffsStore.cakeActive = true`.

**Consumption rule**: 5 분 미만 세션은 게이트로 컷 → buff 소비 **안 함**. 게이트 통과 후에만 `useBuffsStore.consume("cake")` 호출 → 1 회 사용 후 false 로 리셋. 의도: 사용자가 정직하게 집중한 세션에서만 보너스 발동.

### 밸런싱 결정 (autonomous-mode 보고)

- cake 효과: +1 seed. duration-tier 의 seedDelta (0~3) 위에 누적 → 최대 4 seed/완료. 1회 한정.
- 사용처는 1 일 1~3 회 정도 (포커스 세션 빈도) — 인플레이션 영향 미미.

## B. 변경 파일

### 수정
1. **`src/pages/HomePage.tsx`**:
   - `useBuffsStore` import
   - `lastSnapshot.type === "complete"` AND `reward.valid` 분기에서 `cakeActive = consume("cake")` → `totalSeedDelta = reward.seedDelta + (cakeActive ? 1 : 0)` → `growAllPlanted(reward.growSteps, lastSnapshot.at, totalSeedDelta)`.
   - 토스트: 케이크 활성 시 `${reward.message} · 🍰 케이크 효과 씨앗 +1` 로 augment.
2. **`src/components/Inventory/InventoryModal.tsx`**:
   - `case "cake"`: "(미구현)" 토스트 → `useBuffsStore.activate("cake")` + "🍰 다음 포커스 완료 시 씨앗 +1".
   - 모듈 doc-comment 업데이트 — juice/soup/cake/gem 효과 명시, "preview-only flags + toast (TODO)" 문구 제거.
3. **`FARM_RULES.md`** — `## 당근 케이크 (cake) — PR-10` 섹션.
4. **`CLAUDE.md` §9 TODO 매트릭스**:
   - InventoryModal:101/104/107 + itemsStore:176/178/185/187 항목 제거 (PR-5/7/8/9/10 으로 모두 해결).
   - "Items previously listed and now resolved" 블록 추가, PR 번호 cross-ref.
   - 날짜 갱신: 2026-05-14 → 2026-05-16.
   - AdRewardChannelModal TODO 라인 번호 112 → 113 으로 갱신 (PR-9 코드 추가로 한 줄 밀림).

## C. 영향 분석

- **TODO 매트릭스 줄어듦**: 6 entries → 3 (남은 항목 = 모두 Apps-in-Toss ad-token verification, 시크릿 의존 외부 통합).
- **5 분 게이트와의 상호작용**: `reward.valid === false` 분기는 cake 를 건드리지 않음. 의도적 — 사용자가 짧은 세션을 빨리 끄고 buff 만 낭비하는 게이밍 방지.
- **buffsStore 가시성**: 3 종 buff (juice/soup/cake) 모두 동일한 store 에서 독립 플래그로 관리. 동시 활성 가능, 각 trigger 가 자기 것만 consume.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **90/90 pass** (PR-8 부터 유지) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

`build:ait` 는 PR-6 path 검증 완료, 본 PR client-only — 생략.

## E. Maintainer 후속 조치

없음. DB 마이그/시크릿/wrangler 불필요.

## F. 다음 작업

옵션 C (gem/juice/soup/cake) **완전 종료**. 가방의 모든 usable 아이템 live.

후속 후보 (사용자 결정 대기):
- ad-token verification (워커 측 `tools.ts:220` / `items.ts` TODO) — Apps-in-Toss SDK 시크릿 + `executePromotion` 와이어업과 함께. 시크릿 필요 → autonomous 모드 hard-stop.
- 시즈널 토끼 art (PR-3 의 placeholder ID 교체) — 사용자가 PNG 업로드 필요.
- BGM/ambient 사운드 (PR-4 의 SFX 외 잔여) — 사용자가 mp3 자산 업로드 필요.
- 버프 활성 시각 표시 (가방 푸터 또는 농장 카드 코너에 작은 인디케이터) — 자율 가능, 폴리시.
- treasure_progress / weekly treasure 와이어업 (현재 도큐먼트만 있고 런타임 미연결).
