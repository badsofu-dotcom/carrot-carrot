# IMPLEMENTATION_REPORT_PR-74.md — 홈(/) + 집중 중 농장 알림 suppress + batch flush

## 동기

25분 집중 중 사용자는 `/` 에서 타이머만 본다. 그런데 `/collection` 에서 백그라운드로 농장 드랍이 spawn 되면 `notify({ kind: "drop" })` 가 InAppBanner 로 화면 위쪽에 표시 → 시각 분리되어 집중 깨짐. 학습 도구 톤과 어긋남.

(Spawn 토스트는 InAppBanner / native notification 으로 글로벌 노출. `/collection` 의 FarmDropLayer 가 mount 된 상태에서 spawn 이 일어남.)

## 변경

### 신규 — `src/lib/notify/focusGate.ts`

| 심볼 | 역할 |
| --- | --- |
| `SuppressibleKind` | drop 가능 kind 10종 (gem/bolt/heart/hourglass/juice/soup/cake/seed/golden/hidden_bunny) |
| `isFocusBlackout(): boolean` | `window.location.hash` (wouter useHashLocation 환경) + `useTimerStore.getState().status` 동기 검사 → `path === '/' && status === 'FOCUSING'` |
| `pushSuppressedDrop(kind, count?)` | kind 별 카운터 increment, `safeStorage` 영속 (key `cc.focus-blackout.suppressed.v1`) |
| `consumeSuppressedDrops()` | 읽고 + clear |
| `formatSuppressedMessage(counts)` | `{gem:3, heart:2}` → `"🎁 집중하는 동안 보석 3개, 하트 2개 떨어졌어요"`. 빈 dict → `null` |

### Wire 사이트

1. **`src/components/Farm/FarmDropLayer.tsx` (spawn)** — 드랍 spawn 시 이전엔 `notifStore.shouldNotify("drop") && notify(...)` 만 체크. PR-74:
   ```ts
   if (isFocusBlackout()) {
     pushSuppressedDrop(spec.kind);
   } else if (notifStore.shouldNotify("drop")) {
     notify({...});
   }
   ```
   집중 중일 때는 큐에 누적, 그 외엔 기존대로 알림.

2. **`src/pages/HomePage.tsx` (timer FOCUSING → other 전환)** — 신규 useEffect:
   ```ts
   const prevStatusRef = useRef(status);
   useEffect(() => {
     if (prevStatusRef.current === "FOCUSING" && status !== "FOCUSING") {
       const counts = consumeSuppressedDrops();
       const msg = formatSuppressedMessage(counts);
       if (msg) toast(msg, { duration: 4000 });
     }
     prevStatusRef.current = status;
   }, [status]);
   ```
   세션 종료 직후 batch 메시지. duration 4초 (일반 토스트 2.4초 보다 길게 — 정보량 많음).

3. **`src/features/collection/FarmHub.tsx` (mount)** — 사용자가 농장 진입 시 누적 메시지 flush. 집중 중 농장으로 그냥 넘어와도 한 번에 확인.

### Mission / session 토스트 통과 정책

`isFocusBlackout()` 은 **drop spawn 한정** 으로만 적용. mission/session 토스트는 학습 직접 관련 피드백 → 차단 안 함. user spec: "drop/farm/yield 계열만 차단, mission/session 통과".

(harvest/플롯 탭 토스트는 user tap 이 필요 → 홈에서 발생 불가 → 명시적 gate 불필요.)

## 테스트 — `src/lib/focusGate.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| 초기 consume 빈 dict | `{}` |
| 같은 kind 증가 | gem 3회 push → `{gem:3}` |
| 다른 kind 별도 카운터 | gem/heart/seed 독립 |
| consume 후 큐 비워짐 | 두 번째 consume `{}` |
| count <= 0 no-op | 0/음수 push 무시 |
| 빈 dict → null | format 안전 |
| 단일 kind 메시지 | `"🎁 집중하는 동안 보석 3개 떨어졌어요"` |
| 다중 kind 콤마 | 보석/하트/씨앗 각각 매치 |
| 10 kind 모든 라벨 | 보석/번개/하트/모래시계/주스/수프/케이크/씨앗/황금당근/히든 토끼 |

`isFocusBlackout()` 는 jsdom 필요라 본 테스트 스위트에서 검증 안 함 (Node 환경 — window 없음). 단순 안전 fallback `false`.

9 신규 tests. 총 **146 / 146 pass**.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 146 / 146 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
