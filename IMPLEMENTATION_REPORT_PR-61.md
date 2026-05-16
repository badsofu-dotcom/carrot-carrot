# IMPLEMENTATION_REPORT_PR-61.md — 알림 시스템 잔여 wire

PR-53 의 인프라 (`webNotify` + `notificationsStore` + drop trigger MVP) 에 in-app banner UI + Settings 토글 + session trigger 추가.

## 변경

### 신규 — `src/features/notifications/InAppBanner.tsx`
- `cc:notify:in-app` 이벤트 listener.
- `position: fixed` 상단 banner (safe-area-inset-top 적용).
- 4초 auto-dismiss, tap 즉시 닫힘.
- framer-motion spring entrance/exit.
- App.tsx root 에 mount — 모든 페이지에서 노출.

### SettingsPage 알림 토글 5 row 추가
- **마스터 토글** + 권한 요청 (탭 → `requestNotificationPermission()`, granted/denied/unsupported 상태별 sub 카피).
- **per-kind 토글**: drop / session / mission / treasure (midnight 는 자동 스케줄러 부재로 후속).
- master OFF 시 kind 토글 disabled.

### HomePage session trigger
- `lastSnapshot.type === "complete"` && `reward.valid` 분기에서 `notify({ kind: "session", title, body })`.
- `notificationsStore.shouldNotify("session")` gate.

### Permission UX
- master 첫 ON 시 `permission === "default"` 면 자동 권한 요청 → granted/denied 결과 toast 안내.
- denied / unsupported 면 in-app banner fallback 자동 적용 — 사용자가 별도 액션 불요.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130/130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |
