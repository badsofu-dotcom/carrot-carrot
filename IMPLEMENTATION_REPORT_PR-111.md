# IMPLEMENTATION_REPORT_PR-111.md — Legacy MissionType 12종 정리

## 변경 — 미배포 컨텍스트 활용

PR-75 가 fixed 3 mission pool 채택. 이후 legacy 12 MissionType (focus_25 / focus_50 / focus_night / ad_watch / bunny_new / golden_harvest / candy_harvest / drop_pickup / medal_unlock / perfect_combo / tool_use / friend_invite) 은 union 에 유지되었으나 silent no-op. PR-111 가 모두 **완전 제거**.

| 측면 | Before | After |
| --- | --- | --- |
| `MissionType` union | 15 종 (3 active + 12 legacy) | 3 종 |
| `emptyProgress()` | 15 키 | 3 키 |
| `incrementProgress("focus_25", 1)` 등 caller | 12 사이트 | 0 사이트 |
| 사용 안 되는 import | `useMissionsStore` 잔재 | 정리됨 |

## 제거된 trigger 사이트 (12)

| 파일 | 호출 |
| --- | --- |
| `HomePage.tsx` | `focus_25`, `focus_50`, `focus_night` |
| `AdRewardChannelModal.tsx` | `ad_watch` |
| `InventoryModal.tsx` | `tool_use` |
| `FarmDropLayer.tsx` | `drop_pickup` |
| `inviteStore.ts` | `friend_invite` |
| `FarmHub.tsx` | `bunny_new`, `medal_unlock`, `candy_harvest`, `golden_harvest`, `perfect_combo` |

## 호환성

미배포 컨텍스트 → silent migration 불필요. localStorage 의 v2 progress dict 가 새 schema 와 일치 안 하면 emptyProgress() 가 reload 시 새 schema 적용.

## 변경 파일

- `src/features/missions/dailyMissions.ts` — MissionType union 축소 + header 정리
- `src/features/missions/missionsStore.ts` — emptyProgress 3 키만
- `src/pages/HomePage.tsx` — focus_25/50/night trigger 제거
- `src/components/Inventory/AdRewardChannelModal.tsx` — ad_watch trigger + useMissionsStore import 제거
- `src/components/Inventory/InventoryModal.tsx` — tool_use trigger + import 제거
- `src/components/Farm/FarmDropLayer.tsx` — drop_pickup trigger + import 제거
- `src/features/friends/inviteStore.ts` — friend_invite trigger + import 제거
- `src/features/collection/FarmHub.tsx` — bunny_new/medal_unlock/candy_harvest/golden_harvest/perfect_combo trigger 모두 제거

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 237 / 237 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
