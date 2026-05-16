# IMPLEMENTATION_REPORT_PR-54.md — 친구 초대 (client stub)

`/economy/invite` 워커 라우트 부재로 client-only stub. 사용자 spec 의 "백엔드 미구현 시 클라 stub + TODO" 준수.

## 신규 — `src/features/friends/inviteStore.ts`

- `myCode`: 사용자별 1회 발급 (`crypto.randomUUID` 또는 6자 안전 문자집합 random). safeStorage 영속.
- `usedCode`: 사용한 초대 코드 (1회만).
- `invitedCount`: 향후 worker 가 알려줄 invitedCount (현재 클라 0).
- `applyInviteCode(code)`: 결과 enum "ok" / "self" / "already" / "invalid". client validation 만 — 형식 검사 (`/^[A-Z0-9]{4,12}$/`). worker 검증은 TODO.
- 가입자 grant: 씨앗 +10 (`growAllPlanted side-door`) + 보석 +5 (`itemsStore.add`).
- 미션 트리거: `friend_invite` 진행도 +1.
- `shareIntent()`: 공유 텍스트 helper — "버니타임에서 같이 집중해요 🥕\n초대 코드: XXXXXX".

## TODO (worker wire 필요)

- `POST /economy/invite { code }` 라우트:
  - 1 유저 1 코드, 1 redeem.
  - 양쪽 grant (초대자 +heart +gem, 가입자 +seed +gem).
  - 초대자 측 invitedCount 증가 → 클라 hydrate.
- 가입자 시점에 toss 친구 권유 intent (Apps in Toss `share` API) wire.

## UI

본 PR 은 store 만. 향후 PR:
- Settings 페이지 "친구 초대" 섹션
- 초대 코드 표시 + 공유 버튼 + 코드 입력 폼

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 126/126 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-55 (라운드 6 정합 검증 — 본 보고서가 통합).
