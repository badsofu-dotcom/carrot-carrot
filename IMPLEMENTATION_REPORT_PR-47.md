# IMPLEMENTATION_REPORT_PR-47.md — 드랍 잔존 정책 + 동시 3 + cap 12 + persistence

## 변경 사양

| | 이전 (PR-34) | 신규 (PR-47) |
| --- | --- | --- |
| 잔존 시간 | 5 초 fadeout | **무한** (탭으로만 제거) |
| 동시 cap | 1 | **3** |
| 일일 cap | 30 | **12** (가치 보존) |
| Persistence | 없음 (mount 마다 새로) | **sessionStorage** (탭 전환 후 복원) |
| KST 자정 | n/a | 모든 drops 폐기 |

## Weight 재조정 (총 100)

| Drop | weight | 이전 | 신규 |
| --- | --- | --- | --- |
| gem | 30 | 25 | **30** |
| bolt | 22 | 20 | **22** |
| heart | 15 | 15 | 15 |
| hourglass | 10 | 10 | 10 |
| juice | 4 | 5 | **4** |
| soup | 4 | 5 | **4** |
| cake | 4 | 5 | **4** |
| seed | 4 | 5 | **4** |
| golden | 2 | 1 | **2** |
| hidden_bunny | 1 | 1 | 1 |

cap 30→12 으로 줄어든 만큼 희귀 드랍 (gem/bolt/golden) 가중치 올려 가치 보존.

## 구조 변경

- `ActiveDrop` interface: `spec: DropSpec` → `kindIdx: number` (직렬화 안전). render 시 `DROPS[kindIdx]` lookup.
- State: `drop: ActiveDrop | null` → `drops: ActiveDrop[]` (max 3).
- 분리된 sub-컴포넌트 `DropSprite` — render 책임 분리. PR-46 의 sparkle/float 효과를 이 컴포넌트에 강화 예정.
- `PersistedState` shape: `{ day, nextId, drops[] }`. `loadPersisted` / `savePersisted` 헬퍼 + 매 setDrops 마다 persist 호출.
- 자정 cross-day detection: visibilitychange listener 에서 persisted.day !== kstDayKey() 시 모든 drops + nextId reset.
- `VISIBLE_MS` / `fadeTimer` 관련 코드 제거.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 101/101 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-46 (드랍 시각 효과 강화 — sparkle / float / bounce / 빛 ray).
