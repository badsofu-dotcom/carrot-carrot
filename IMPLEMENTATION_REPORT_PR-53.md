# IMPLEMENTATION_REPORT_PR-53.md — 알림 인프라 + drop 트리거

Web Notification API + in-app fallback + per-kind toggle 인프라. MVP.

## A. 신규 파일

1. **`src/lib/webNotify.ts`** — 안전 wrapper
   - `notificationAvailable()` / `notificationPermission()` / `requestNotificationPermission()` 헬퍼
   - `notify(detail)` — granted 면 native Notification, 아니면 `cc:notify:in-app` CustomEvent dispatch (fallback)
   - 모든 path safe (throw 안 함)
2. **`src/features/notifications/notificationsStore.ts`** — settings store
   - `masterEnabled` + per-`NotifyKind` toggle (drop/mission/session/midnight/treasure)
   - `shouldNotify(kind)` 헬퍼 — caller 가 매번 gate
   - safeStorage `cc.notifications.v1` 영속

## B. 첫 trigger 사이트 wire

`FarmDropLayer.spawn` — 새 drop spawn 시 notify("drop"). Apps in Toss WebView 환경에서 native Notification 지원 안 되면 `cc:notify:in-app` 이벤트로 fallback.

## C. 후속 trigger / UI (next PR)

본 PR 은 MVP — 인프라 + 1 site 만. 향후 wire:

- **세션 완료 알림**: HomePage `lastSnapshot.type === "complete"` 분기에서 `notify("session", ...)`. autoBreak 모드 인 경우 노이즈.
- **미션 미완료 (18:00 KST)**: 별도 in-app scheduler 또는 service worker push (Apps in Toss 의 push API 검증 필요).
- **자정 임박 (23:30 KST)**: 일일 P 미달 시 알림.
- **주간 보물 알림 (토 18:00 KST)**: 7 progress 충족 후 안내.
- **In-app banner UI**: `cc:notify:in-app` 리스너 + Toast 형식 또는 카드 — Settings 에서 native permission 안 받은 사용자용.
- **Settings 토글 UI**: notificationsStore 의 마스터 + 5 kind 토글 row. 권한 요청 버튼.

ROADMAP 에 follow-up 등록.

## D. Apps in Toss 환경 검증

`Notification` API 가 WebView 에서 지원되지 않을 가능성. `webNotify` 의 `notificationAvailable()` 가 `typeof window.Notification === "undefined"` 검사 — 미지원 환경에서 자동 fallback. 추가 가드 없음.

In-app fallback 경로 (`cc:notify:in-app`) 는 항상 동작 — banner UI 만 mount 하면 즉시 노출 가능.

## E. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 126/126 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## F. 사용자 자산 보고

PR-49 의 11종 메달 PNG (medal-first-breath.png 등) 작업 트리에 **미존재** 확인. `public/assets/farm/rewards/` 에는 기본 3종 (medal_bronze/silver/gold.png) 만. `find . -name "medal-first-breath.png"` 결과 0건.

PR-49 의 `MedalIcon` 컴포넌트가 onError fallback → tier 별 medal_{bronze/silver/gold}.png 사용하므로 UI 는 정상 표시. 사용자 자산 추가 시 자동 반영.

## G. 다음 작업

PR-54 (친구 초대 stub) + PR-55 (정합 검증).
