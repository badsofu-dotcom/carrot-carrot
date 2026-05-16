# IMPLEMENTATION_REPORT_PR-64.md — 히든 토끼 사양 B (spot peek)

PR-35 의 사양 A (가로지름) 와 별도, B (spot peek) 구현.

## 사양

- **간격**: 10~30 분 random
- **표시 시간**: 3 초 (fade-in 0.4 + hold 2.2 + fade-out 0.4)
- **위치**: 5 spot 클러스터 (PR-45 FarmDropLayer 패턴 차용)
  - mushroom-house (좌하 75-85 / 8-22)
  - tree-base (우하 70-82 / 78-92)
  - well (좌중 55-65 / 8-20)
  - behind-house (중상 52-62 / 28-42)
  - behind-tree (중상 58-68 / 70-82)
- **일일 max**: 3 (PR-35 의 4 와 분리, `cc.hiddenBunnyPeek.dailyCount.<KST>`)
- **풀**: 미획득 캐릭터 우선, 모두 보유 시 전체

## 신규 — `src/components/Farm/HiddenBunnyPeek.tsx`

PR-35 HiddenBunnyLayer 와 별도 컴포넌트로 분리 — A 와 B 의 lifecycle / spawn 패턴이 완전히 다름. 같이 두면 코드 복잡도 증가.

탭 grant 경로 (A 와 동일):
- 미획득: `forceUnlock(characterId)` → `cc:bunny-gacha:show` dispatch (BunnyGachaModal surface)
- 보유: `addItem("gem", 5)` + toast

## FarmHub mount

`<HiddenBunnyLayer />` 다음에 `<HiddenBunnyPeek />` 추가. 둘 다 `position: absolute` 농장 카드 내부.

## A vs B 비교

| 측면 | A (HiddenBunnyLayer, PR-35) | B (HiddenBunnyPeek, PR-64) |
| --- | --- | --- |
| 패턴 | 가로지름 (motion x) | spot peek (static + fade) |
| 간격 | 5~30 분 | 10~30 분 |
| 표시 | 5 초 (linear traversal) | 3 초 (fade in/out) |
| 위치 | 화면 가로 (방향 random) | 5 spot 중 하나 |
| 일일 cap | 4 | 3 |
| Counter | cc.hiddenBunny.dailyCount.<KST> | cc.hiddenBunnyPeek.dailyCount.<KST> |
| 사이즈 | 64 × 64 emoji | 44 × 44 emoji (조금 작게 — peek 느낌) |
| Drop-shadow | 강한 warm glow | 부드러운 brown glow (숨어있는 느낌) |

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
