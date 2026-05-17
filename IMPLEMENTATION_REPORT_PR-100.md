# IMPLEMENTATION_REPORT_PR-100.md — 홈 미션 IA: 기본 접힘 + RUNNING 강제 접힘

## 결정 (자율) — 옵션 1 + 3 결합

User spec 3 옵션 중:
- 옵션 1 (드롭다운): 기본 접힘 + 사용자 expand 토글
- 옵션 3 (RUNNING 자동 접힘)

**채택: 1 + 3 결합** — 사용자 추천 + 학습 도구 톤 가장 강함.

옵션 2 (별도 탭) 기각 이유:
- 5번째 탭 추가 = 정보 분산
- 미션 카드는 홈에서 보이는 게 자연 (집중 후 보상 흐름)
- 별도 탭 = 발견성 낮음

## 동작 매트릭스

| Timer 상태 | userExpanded (sessionStorage) | 실제 표시 |
| --- | --- | --- |
| IDLE / DONE / ABANDONED | false (기본) | 접힘 1줄 |
| IDLE / DONE / ABANDONED | true (사용자 expand) | 펼침 |
| FOCUSING / PAUSED | (무관) | **강제 접힘** |

`forceCollapsed = isFocusing || isPaused` — PAUSED 도 집중 보호 컨텍스트.

## 영속

| Storage | Key | TTL |
| --- | --- | --- |
| sessionStorage | `cc.missions.expanded.v1` | tab close 시까지 |
| sessionStorage | `cc.weeklyMissions.expanded.v1` | 同上 |

**왜 sessionStorage?**: 사용자 spec — "다음 진입 시 다시 접힘". 새 세션 = 기본 접힘 상태. 같은 세션 내 expand 결정은 유지.

## 1줄 헤더 UI

기본 접힘 시:
```
🎯 오늘 목표 2/3  [▼]
```
expand 시:
```
🎯 오늘 목표 2/3  [▲]
    [3 mission rows + bonus button]
```

weekly:
```
📅 이번 주 목표 1/3  [▼]
```

emoji 추가:
- 일일: 🎯 (target/goal)
- 주간: 📅 (calendar/week)

## 변경 파일

- `src/features/missions/DailyMissionsCard.tsx` — forceCollapsed prop + 접힘 logic + emoji header
- `src/features/missions/WeeklyMissionsCard.tsx` — 同 패턴
- `src/pages/HomePage.tsx` — `forceCollapsed={isFocusing || isPaused}` 전달

## 호환성

- 기존 mission claim / bonus claim 동작 변화 없음 (expand 시에만 표시)
- aria-expanded 추가 — screenreader 가 상태 인지
- forceCollapsed 시 button disabled + cursor: default

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 218 / 218 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
