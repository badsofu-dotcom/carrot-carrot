# IMPLEMENTATION_REPORT_PR-67.md — 모달 minHeight + fertilizer 자산 복원

Round 8 끼어든 hotfix. 두 작업 묶음.

## Fix 1: InventoryModal 끝까지 안 올라옴

### Before
- PR-56 이 `height: 70vh` → `maxHeight: 90vh` 로 교체.
- `height` 가 없어서 모달이 컨텐츠 크기만큼만 자람.
- 자원 탭 (4개) 처럼 컨텐츠 적으면 화면 70~80% 위치에서 멈춤.
- 위쪽에 농장 배경 그대로 노출 → bottom-sheet UX 어색.

### After
- `minHeight: 70vh` 추가. `maxHeight: 90vh` 유지.
- 정책:
  | 상황 | 모달 높이 |
  | --- | --- |
  | 컨텐츠 적음 (자원 4개 등) | **70vh** (minHeight 적용) |
  | 컨텐츠 보통 | content-sized |
  | 컨텐츠 많음 (DetailPanel + ActionBar) | **90vh** (maxHeight 적용) |
- 작은 viewport (iPhone SE 568) 에서도 동일 — 70vh = 397.6px 시 충분히 큼.

## Fix 2: tool_fertilizer 자산 복원 (PR-58 follow-up)

### Before
- PR-58 에서 사용자 spec `tool_fertilizer.png` 자산 부재 확인 → `tool_seed_pack.png` 자율 대체.

### After
- 사용자가 `/mnt/c/dev/carrot-carrot/.../public/assets/farm/items/tool_fertilizer.png` 추가.
- WSL 마운트 통해 repo 의 `public/assets/farm/items/tool_fertilizer.png` 로 복사 (391 KB).
- PR-58 의 3 사이트 모두 원안 `assets/farm/items/tool_fertilizer.png` 로 복원:

| 사이트 | 이전 (PR-58) | 신규 (PR-67) |
| --- | --- | --- |
| `itemsStore.ts` seed.iconRel | `assets/farm/tools/tool_seed_pack.png` | `assets/farm/items/tool_fertilizer.png` |
| `FarmDropLayer.tsx` seed drop iconRel | 동일 | `assets/farm/items/tool_fertilizer.png` |
| `CollectionPage.tsx` CurrencyChip seed icon | 동일 | `assets/farm/items/tool_fertilizer.png` |

`FarmHub CROP_ASSETS.seed` (농장 plot stage1 어린 모종) 는 그대로 유지 — 작물 라이프사이클 시각화는 별개.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## 후속

Round 8 main 라인 (PR-61 → PR-66) 자율 모드 이어서 진행. PR-62 (친구 초대 UI) FriendInviteGroup 파일 작성 완료, mount 만 남음.
