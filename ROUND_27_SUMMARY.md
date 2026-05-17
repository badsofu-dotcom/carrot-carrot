# Round 27 — 농장 잔상 박멸 + 버섯집 가구 당근 구매 시스템 (2026-05-18)

## 한 줄 요약

농장 9-plot grid 의 빠른 연속 탭 잔상 버그 수정 + R26 PHASE 2 의
"도감 N마리 자동 지급" 흐름 폐기 → **도감 자격 해금 → 당근 결제 →
보관함 입고** 새 흐름 도입.

## 변경 PR

| PR | sha | 분류 | 한 줄 |
| --- | --- | --- | --- |
| PR-163 | `029f234` | fix(farm) | plot sprite 잔상 — AnimatePresence popLayout + exit + 4 stage preload + will-change |
| PR-164 | `e075595` | feat(decor) | 가구 step 당근 가격표 50/100/.../400 + `farmhubStore.buyNextStep` 액션 + `evaluateBuyNextStep` 순수 helper |
| PR-165 | `2810fbe` | feat(decor) | `BuyFurnitureModal` + 보관함 자물쇠/가격 UI + R26 PHASE 2 자동 지급 hook archive |
| PR-166 | `ff9e05a` | feat(dev) | DevActionsGroup 3 row — 🥕 +1000 / 무료 풀세트 / 가격표 toast |

## PHASE 1 — plot sprite 잔상 박멸

### 진단

`src/features/collection/FarmHub.tsx:786~ {plotBounds.map}` 의 `motion.image`
는 이미 `key={\`${b.id}-${stage}\`}` 로 stage 별 fresh mount + farmStore 의
plant/harvest 는 immutable slice. 즉 사용자의 spec hypothesis (a)~(b) 와 (e)
는 이미 충족. 그러나 두 가지 빠짐:

- **AnimatePresence 없음** — exit transition 정의 X. stage 변할 때
  React 가 즉시 unmount 하지만 framer-motion 의 RAF cleanup 이 1~2 frame
  지연되어 transform 잔여가 paint 에 남음.
- **자산 preload 없음** — 4 stage webp 가 첫 사용 시점에 fetch + decode.
  빠른 연속 탭 시 디코딩 동안 이전 sprite 흔적 노출.

### 수정

```jsx
<AnimatePresence mode="popLayout" initial={false}>
  {plotBounds.map((b) => (
    <motion.image
      key={`${b.id}-${stage}`}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
      style={{ willChange: "opacity, transform", ... }}
    />
  ))}
</AnimatePresence>
```

+ FarmHub mount 시 4 stage `new Image()` 디코더 캐시 warm-up (~80KB).

회귀 위험: AnimatePresence popLayout 은 SVG `<image>` children 공식 지원.
plot 9개 → 최대 18 노드 동시 exit/enter, 부하 무관.

## PHASE 2 — 당근으로 가구 단계 구매 시스템

### 흐름 변경

```
이전 (R26):  [도감 N마리 unlock] → [자동 지급] → [보관함]
이후 (R27):  [도감 N마리 unlock] → [구매 자격 해금]
                                  → [당근 N개로 구매] → [보관함]
```

도감은 **자격 게이트** 로만 작동. 사용자가 명시적으로 결제해야 unlock.

### 가격표

| step | 가구 | 가격 |
| --- | --- | --- |
| 1 | 원형 카펫 | 🥕 50 |
| 2 | 패치워크 침대 | 🥕 100 |
| 3 | 원형 테이블 | 🥕 150 |
| 4 | 책장 | 🥕 200 |
| 5 | 화분 | 🥕 250 |
| 6 | 서랍장 | 🥕 300 |
| 7 | 장난감 상자 | 🥕 350 |
| 8 | 스툴 의자 | 🥕 400 |
| **누적** | | **🥕 1800** |

선형 50 증가 곡선 v1. R28 에서 analytics funnel 분석 후 조정 예정.

### buyNextStep 결정 로직 (순수 함수)

`evaluateBuyNextStep({step, pendingFurnitureId, dogamCount, carrots})`:

| 우선순위 | 조건 | reason |
| --- | --- | --- |
| 1 | step ≥ 8 | `max_step` |
| 2 | pendingFurnitureId !== null | `already_pending` |
| 3 | dogamCount < step + 1 | `step_locked` |
| 4 | carrots < price | `insufficient_carrot` |
| ok | else | targetStep / furnitureId / price 반환 |

zustand 의존 X — node --test 18 케이스 모두 pass.

### BuyFurnitureModal CTA 분기

- 도감 자격 부족 → "도감 N마리 더 모으기" (비활성)
- 도감 OK + 당근 부족 → "🥕 부족 — 농장에서 수확하기" (close only)
- 도감 OK + 당근 OK → "✨ 구매하기" (primary)
- 100 당근 이상 → confirm 2단계 ("정말 구매?" + "다시 묻지 않기"
  체크박스, `cc.farmhub.skip_confirm` 영속)

### 보관함 strip UI 변경

자물쇠 슬롯이 이제 탭 가능 → BuyFurnitureModal open. sprite 하단에
🥕 가격 frosted pill overlay.

### auto-grant 폐기

`useFarmhubDogamGrant.ts` + `farmhubGrantTriggers.ts` 모두
`src/features/_decor_v1_archive/` 로 이동. App.tsx 의 hook 호출 제거.
기존 7 단위 테스트는 import path 만 갱신하여 legacy invariants 유지
(무의식적 재도입 차단).

기존 사용자 데이터 (step / pendingFurnitureId / onboardingShown /
ownedCharacters / carrots) 모두 그대로 보존 — 마이그레이션 X.

## PHASE 3 — DEV 치트 + 분석

3 dev row 추가 (SettingsPage → 개발자 (DEV) 카드):

- **🥕 당근 +1000** — 구매 검증용 (`incCarrots(1000)`)
- **🥕 가구 무료 풀세트** — `devGrantFreeNext()` × (FINAL+1) → step 0→8
  자동 진행. 가격 / 자격 / pending 모두 우회.
- **🥕 가구 가격표 보기** — `FARMHUB_PRICES` + 누적 1800 toast (6s).

production 빌드: `import.meta.env.DEV` 가드로 module 전체 drop.

analytics shim — `src/lib/analytics.ts`:
- `logFarmhubBuy("attempt"|"success", payload)` — BuyFurnitureModal 안에
  hook 됨. DEV: console.info, prod: no-op. R28 worker 연동 예정.

## 빌드 / 테스트 결과

```
node --test src/lib/*.test.mjs    290/290 pass (+18 from R26.5)
npm run typecheck                 clean
npm run build                     ✓ 577ms
npm run build:preview             ✓ 393ms
npm run build:ait                 ✓ 48M, deploymentId 019e367e-948f-7639-b03d-6330aa80393e
forbidden-token scrubs            0 hits (7 종 + "/assets/farm")
```

## 산출물

- `carrot-carrot.ait` (48M) → `/mnt/c/Users/badso.버니즈/Downloads/carrot-carrot.ait`
- deploymentId: `019e367e-948f-7639-b03d-6330aa80393e`
- Downloads 폴더 explorer.exe 자동 오픈 ✓
- Telegram 알림 5건 전송 (PR-163~166 + Round wrap)

## 다음 (R28 후보)

- 가구 배치 UI / 회전 / 저장 (현재는 step 별 사전 합성 bg, 자유 배치 X)
- 가격 곡선 곡선 조정 — analytics funnel 보고 후 데이터 기반 튜닝
- step 8 풀세트 보상 (현재는 토끼 말풍선 1회만)
- analytics 백엔드 연동 (현재 DEV console.info, prod no-op)
- BuyFurnitureModal 에서 농장으로 deeplink (현재 close only)
