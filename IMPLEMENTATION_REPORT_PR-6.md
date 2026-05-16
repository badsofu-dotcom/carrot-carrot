# IMPLEMENTATION_REPORT_PR-6.md — Bag entry point: header → ToolDock

UI 회귀 수정. 보따리(가방) 진입점을 농장 상단 헤더에서 하단 ToolDock 4번째 슬롯으로 이동.

## A. 배경

스크린샷에서 보따리 아이콘이 우측 상단 헤더 (🎁 옆) 에 있었음. 합의된 디자인은 "소지품류는 하단 트레이". PR-6 은 이 회귀를 되돌린다.

## B. 결정 — 옵션 A (별도 4번째 슬롯)

| 옵션 | 평가 |
| --- | --- |
| A: ToolDock에 4번째 슬롯 (삽 / 물뿌리개 / 바구니 / 가방) | ✅ 채택 |
| B: 바구니 안에 탭 통합 | ❌ 바구니는 *도구 선택* (수확 모드 진입), 가방은 *모달 오프너* — 의미가 다름. 합치면 도구 토글 + 모달 오픈이 같은 버튼에 묶여 UX가 깨짐. |

## C. 변경 파일

### 1. `src/components/Farm/ToolDock.tsx`
- 헤더 doc-comment: "3 slots" → "3 tool slots + 1 passive bag slot" 으로 의도 명시.
- `useItemsStore` 구독 추가, `speciesOwned` 카운트 계산 (이전엔 CollectionPage 가 보유).
- `onOpenBag` 핸들러 추가 — `haptic("light")` + `window.dispatchEvent(new CustomEvent("cc:bag:open"))`. SSR 가드 try/catch.
- 4번째 슬롯 렌더링 — `data-testid="tool-bag"`, `aria-label="가방 열기"`, 64×64 슬롯, 50×50 PNG, 활성-스타일(주황 외곽선 + scale 1.05) 없음 (passive), 우상단 species-count 배지(주황 ACCENT 배경).
- 슬롯 위치: tool 3개 → **bag** → refill (조건부, watering=0 일 때만).
- 도구바 aria-label: "농장 도구" → "농장 도구 및 가방".

### 2. `src/pages/CollectionPage.tsx`
- 헤더 bag 버튼 (lines 924–979) 완전 제거. 헤더는 이제 📖 도감 / 🎁 보상 / ⚙ 설정 3개만 정렬.
- `useItemsStore` import 제거, `itemCounts`/`speciesOwned` 로컬 계산 제거 (ToolDock 으로 이동).
- `cc:bag:open` 이벤트 리스너 `useEffect` 추가 — InventoryModal 의 `bagOpen` state 를 켜는 진입점.
- `InventoryModal open={bagOpen}` mount 는 유지 (모달 자체는 그대로 재사용, 진입점만 변경).

### 3. `PROJECT_STATE.md`
- C 섹션의 ToolDock/CollectionPage 스냅샷 두 줄 업데이트 (3 슬롯 → 3+1 슬롯, 헤더 bag 제거 반영).

## D. 디자인 검증 (정적 코드 리뷰)

### 트레이 너비 — 모바일 390 안전
- 슬롯: 64 px × 4 = 256 px
- 슬롯 간 gap: 6 px × 3 = 18 px
- 컨테이너 padding: 6 px × 2 = 12 px
- **합계: 286 px** (refill 버튼 없는 평상시)
- 모바일 390 viewport - safe-area 좌우 - 카드 padding 12 × 2 = ~366 px 사용 가능 → **80 px 마진**
- watering=0 일 때 refill (≈40 px + gap 6) 까지 합쳐도 332 px → **34 px 마진** (여전히 안전)

### Safe-area
- ToolDock 은 `position: absolute; bottom: 8`, 농장 카드 내부. 부모 카드가 `maxWidth: 480` + `margin: 0 auto` 로 클램프 → safe-area-inset 영향은 카드 위치 결정 시 이미 반영됨. PR-6 은 슬롯 수만 늘리므로 safe-area 회귀 없음.

### 이벤트 채널
- `cc:bag:open` 은 기존 `cc:ad-channel:open` (ToolDock → FarmHub) / `cc:tool:selected` (ToolDock → FarmHub) 패턴과 동일. CustomEvent + try/catch SSR 가드. 리스너는 unmount 시 `removeEventListener` 로 정리.

### 모달 재사용
- `InventoryModal` 컴포넌트는 손대지 않음. props 그대로, `bagOpen`/`onClose` 그대로. 모달 내부 13-item 그리드 + 3-tab + 사용 버튼 모두 변함 없음.

## E. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **78/78 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| `VITE_APPS_IN_TOSS_PROXY_URL=… npm run build:ait` | OK, deploymentId `019e3069-8e2c-7c69-8b2a-0b1742169073` |

### 금지토큰 스캔 (dist-preview)
- `localStorage`/`sessionStorage`/`indexedDB`/`requestFullscreen`/`exitFullscreen`/`requestPointerLock`/`exitPointerLock`: **각 0건**
- `"/assets/farm` / `'/assets/farm` 절대경로: **0건**

### 회귀 검증
- 구 testid `farm-header-bag` dist-preview 잔존: **0건** (완전 제거 확인)
- 신 testid `tool-bag` dist-preview 잔존: **1건 (예상대로 1)**

## F. 테스트 전략 노트

`src/lib/*.test.mjs` 는 pure-helper 전용. UI 컴포넌트 단위 테스트 인프라가 없으므로 PR-6 은 신규 테스트 파일 추가 대신 정적 코드 리뷰 + dist-preview 토큰 스캔으로 회귀 차단. 향후 컴포넌트 테스트 도입 시 ToolDock 의 `cc:bag:open` 이벤트 발화 + CollectionPage 의 리스너가 후보.

## G. Maintainer 후속 조치

없음. PR-6 은 DB 마이그레이션/외부 시크릿/wrangler 호출이 일체 없는 순수 프론트엔드 UI 회귀 수정.

## H. 다음 작업

NEXT_PR_PLAYBOOK 의 5개 PR 은 어제 PR-2~5 까지 완료, PR-1 도 사실상 5/13 커밋에서 핵심 마운트 완료. 다음은 사용자 지시에 따라 옵션 C 신규 콘텐츠 (gem / juice / soup / cake) PR-7 부터 자율 진행.
