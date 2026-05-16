# IMPLEMENTATION_REPORT_PR-62.md — 친구 초대 UI

PR-54 의 `inviteStore` client stub 위에 SettingsPage 의 새 섹션.

## 신규 — `src/features/friends/FriendInviteGroup.tsx`

Self-contained section (SettingsPage 내부의 SettingsGroup/Row 컴포넌트 export 안 됨 → 자체 inline styling 으로 톤 매치).

### Row 1: 내 코드 표시
- monospace + tabular letter-spacing 으로 코드 가독성.
- "복사" 버튼 (주황): `navigator.clipboard.writeText` → fallback toast.
- "공유" 버튼 (외곽선): Web Share API → fallback clipboard → fallback toast.

### Row 2: 친구 코드 입력
- text input (maxLength 12, auto-uppercase).
- 적용 버튼: `inviteStore.applyInviteCode(code)` 호출 → result enum 에 따라 toast 분기:
  - `ok`: "🎉 친구 초대 적용 — 씨앗 +10, 보석 +5" + `incrementProgress("friend_invite", 1)` (inviteStore 가 호출)
  - `self`: "내 코드는 입력할 수 없어요"
  - `already`: "이미 다른 코드를 적용했어요"
  - `invalid`: "코드 형식이 올바르지 않아요 (4~12자 영숫자)"
- usedCode 가 있으면 input + 버튼 모두 disabled + sub 카피 "사용 완료: XXXXXX".

## SettingsPage mount

데이터 그룹 다음 / DEV 그룹 이전 위치에 `<FriendInviteGroup />` mount.

## TODO (worker wire)

- `POST /economy/invite { code }` 라우트 — 1유저 1redeem 검증 + 양방향 grant + 초대자 invitedCount 증가.
- Apps in Toss `share` intent — 현재 Web Share API 만 사용, native intent 가능 시 우선.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
