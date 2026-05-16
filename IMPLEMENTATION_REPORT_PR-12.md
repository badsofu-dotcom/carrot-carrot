# IMPLEMENTATION_REPORT_PR-12.md — 가방 자원 탭 self-recursive 항목 제거

## A. 문제

InventoryModal 의 "자원" 탭에 `carrot_bag` (당근 주머니) 가 있었음. 같은 가방의 4번째 dock 슬롯(PR-6)이 이 InventoryModal 의 진입점이므로 — 가방 안에서 가방 자신을 항목으로 보여주는 self-recursive UX 가 됨. effect 카피도 "가방 자체 — 보유 종 개수만큼 헤더 뱃지에 표시" 인데 PR-6 이후 헤더 뱃지가 사라지면서 더 이상 정합성도 없음.

## B. 해법 (옵션 A 채택)

권장대로 항목 전체 제거. carrot_bag 정의는 단 3 곳에서만 참조 → 안전 제거.

## C. 변경 파일

1. **`src/features/collection/itemsStore.ts`**:
   - `ItemCode` union 에서 `| "carrot_bag"` 제거
   - `ITEMS` 배열에서 `code: "carrot_bag"` 엔트리 (5번째 자원 항목) 삭제
   - 결과: ITEMS.length 14 → **13**
2. **`src/components/Inventory/InventoryModal.tsx`**:
   - `liveResourceCount` switch 에서 `case "carrot_bag"` 제거
   - 주석에 PR-12 의 의도 명시 (self-recursive 회피, dock 뱃지로 별도 surface)
3. **`PROJECT_STATE.md`**:
   - 13-item inventory 행을 `🟡 → ✅` 으로 업그레이드
   - 카운트 (4/5/4) 갱신 (resources × 4 - carrot_bag 빠짐 + 4 (medal/star/gem/heart) collection 으로 정정 — 이전 표기 5/5/3 은 부정확)
   - PR-5/7/8/9/10 의 효과 wired live 명기, PR-12 의 carrot_bag 제거 cross-ref

ITEMS 의 `InventoryModal` footer (`총 {ITEMS.length}종`) 는 dynamic 으로 13 으로 자동 갱신 → 별도 수정 불요.

## D. 데이터 호환성

`safeStorage` 키 `cc.items.v1` 에 carrot_bag count 가 저장돼 있던 기존 사용자:

- `loadCounts` 의 `blank` 객체는 `ITEMS.map(i => [i.code, 0])` 로 만들어짐 → carrot_bag 키 없음
- 기존 JSON 의 carrot_bag 값은 무시되고 (`if (typeof v === "number") blank[c] = v;` 에서 `c` 가 ITEMS 의 코드만 순회) 다음 `saveCounts` 시 자연스럽게 잊혀짐
- 데이터 손실 없음 (carrot_bag 자체가 사용 가능한 자원이 아니었음 — 항상 `speciesOwned()` 반환값)

워커 측 `user_items` 테이블 영향: 워커는 `code` 를 자유 문자열로 받음 (`routes/items.ts` doc-comment 명시). 기존 row 가 있어도 클라가 더 이상 carrot_bag 을 쿼리/디스플레이하지 않으므로 dormant. 마이그/cleanup 불필요.

## E. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **90/90 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |
| `carrot_bag` in dist-preview | **0** (완전 제거 확인) |

## F. Maintainer 후속 조치

없음. CSS/JSX 자료구조 변경만. DB 마이그/시크릿/wrangler 불필요.

## G. 다음 작업

PR-13 — BGM + 효과음 풀스택 도입. 자산 자동 다운로드 시도 (pixabay/freesound CC0), 실패 시 코드 + Settings UI + README 가이드 작성하고 사용자가 자산 떨궈넣으면 즉시 활성화되도록.
