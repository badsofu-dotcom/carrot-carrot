# IMPLEMENTATION_REPORT_PR-59.md — 농장 상단 버프 칩 풀 리뉴얼

기존 PR-17a 의 `BuffIndicator` (단순 한 단어 pill) → 라벨 + 잔여시간 mm:ss + progress bar + tap popover + 만료 5초 깜빡임 으로 풀 리뉴얼.

## A. 신규 / 변경 파일

| 파일 | 역할 |
| --- | --- |
| `src/features/buffs/buffEffects.ts` (new) | `BUFF_META` SoT (displayName/description/trigger/emoji/color/durationMs) + `formatRemaining` + `isFinalCountdown` |
| `src/features/buffs/BuffChip.tsx` (new) | 1개 buff chip — 1초 tick + progress bar + 깜빡임 |
| `src/features/buffs/BuffInfoPopover.tsx` (new) | tap 시 효과 설명 모달 (PR-42 안전 패턴) |
| `src/features/buffs/BuffChipsRow.tsx` (new) | row wrapper, 자동 렌더 (BUFF_META iteration) |
| `src/features/collection/buffsStore.ts` (rewrite) | `*Active: boolean` → `*ExpiresAt: number` + `isActive` / `remainingMs` / `pruneExpired` |
| `src/components/Farm/BuffIndicator.tsx` (delete) | 폐기 |
| `src/features/collection/FarmHub.tsx` (edit) | `<BuffIndicator />` → `<BuffChipsRow />` |
| `src/lib/buffEffects.test.mjs` (new) | 4 test (BUFF_META / formatRemaining / 음수 / isFinalCountdown 경계) |

## B. BUFF_META 정의

| Kind | displayName | duration | color | trigger |
| --- | --- | --- | --- | --- |
| juice | 주스 버프 | 15분 | #FFE26E (노랑) | 다음 수확 시 자동 |
| soup | 수프 버프 | 30분 | #FFB266 (주황) | 다음 광고 충전 시 자동 |
| cake | 케이크 버프 | 30분 | #FF99CC (핑크) | 다음 유효 집중 완료 시 자동 |

기존 효과 정의 (PR-7/8/9) 그대로 유지. 사용자 spec "효과 정의 (제안, 본인 기존 로직 우선)" 준수.

## C. duration 도입

- 활성 후 `BUFF_META.durationMs` 안에 trigger 안 일어나면 자동 만료 (consume false 반환 + state clear).
- 부팅 시 이미 만료된 timestamp 는 init 단계에서 0 으로 reset.
- BuffChip 의 1초 tick 이 `pruneExpired()` 호출 → stale state 청소.
- safeStorage 키 `cc.buffs.v1` → `cc.buffs.v2` (직렬화 shape 변경). 기존 v1 데이터는 자동 폐기 (loss = 활성 buff 손실, but expire 도 비슷 시간 안에 일어났을 것).

## D. UI 디테일

- **Progress bar**: chip 내부 left 0 → width `${pct}%` 의 `${color}55` 반투명 bar. linear transition 0.95s 로 부드럽게 줄어듦.
- **만료 5초 전 깜빡임**: `isFinalCountdown(remaining)` true 시 chip 자체 `animation: buff-chip-blink 0.8s` (opacity 0.55 ↔ 1).
- **남은 시간 색**: 평상 시 brown 글자, 깜빡임 단계 진입 시 red `#d05a3a`.
- **Popover**: 큰 emoji + 잔여 시간 큰 글자 (tabular-nums) + 효과 설명 + trigger 안내. 외곽선 색깔 buff color 로 강조. PR-42 outer fixed-flex centering 패턴.

## E. 확장 가능 구조

새 buff 추가 시:
1. `BuffKind` 유니온에 추가.
2. `BUFF_META` 에 entry 정의.
3. `buffsStore` 의 `fieldOf` switch + Persisted shape + interface 에 expiresAt 필드 추가.
4. trigger 사이트에서 `consume(newKind)` 호출.

BuffChipsRow 는 BUFF_META iteration 으로 자동 렌더 — 신규 chip 별도 mount 불요.

## F. 회귀 회피

- `consume(kind)` boolean return 시그니처 유지 → 기존 4개 trigger 사이트 (FarmHub harvest / AdRewardChannelModal watering / InventoryModal bolt / HomePage focus complete) 코드 변경 불요.
- `activate(kind)` 시그니처 유지 → DEV "버프 일괄 활성" + InventoryModal onUse 그대로.
- `BuffIndicator` 삭제 — import 사이트는 FarmHub 단일, 같이 수정.

## G. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **130/130 pass** (+4 buffEffects) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |
