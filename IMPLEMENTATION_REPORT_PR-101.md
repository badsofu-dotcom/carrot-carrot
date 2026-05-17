# IMPLEMENTATION_REPORT_PR-101.md — 내 정보 그룹 재구성 (압축)

## 변경

| 측면 | Before (PR-69 ~ 100) | After (PR-101) |
| --- | --- | --- |
| 그룹 수 (visible) | 7 (계정/집중/알림&소리/외관/데이터/친구/정보) | 7 (집중/알림/소리/외관/친구/계정/고급) |
| Visible master row 수 | ~18 | **9** (1+1+2+1+2+2) |
| 순서 | 계정 > 집중 > 알림&소리 > ... > 정보 | 집중 > 알림 > 소리 > 외관 > 친구 > 계정 > 고급 |
| 알림 / 소리 | 합쳐진 1 그룹 | **분리** 2 그룹 |
| 고급 disclosure | 알림&소리 안에 nested | **top-level 그룹** 으로 승격 |
| 데이터 / 정보 그룹 | top-level visible | **고급 안으로 강등** |

## SETTINGS_INVENTORY 참조

`SETTINGS_INVENTORY.md` 의 G-2 에 상세 표 + 자율 결정 사유.

## 핵심 변경

### 1. SoundNotifyGroup 제거

PR-69 의 통합 컴포넌트 → 알림 그룹 (1 row) + 소리 그룹 (2 row) 으로 분리.

### 2. AdvancedDisclosure 승격

기존: 알림&소리 그룹 내부 nested. 이제: 자체 SettingsGroup "고급 설정" 안에 단일 disclosure. 모든 rare actions 한 곳:
- 알림 세부 (PushReminder / 4 NotifyKind / EndAlert) — 6 rows
- 집중 세부 (CustomSlot / AutoBreak) — 2 rows
- 외관 세부 (FarmBgAuto) — 1 row
- 데이터 (캐시 / 온보딩 / 초기화) — 3 rows
- 정보 (버전 / 크레딧 / 개발자) — 3 rows

총 고급 내부 15 rows. 펼침 시에만 visible — UX 무리 없음.

### 3. 사용 빈도 기반 reorder

```
🎯 집중   → 가장 자주 (TimerPreset)
🔔 알림   → master
🔊 소리   → master 2
🎨 외관   → DarkMode
👥 친구   → 발견성
👤 계정   → 가장 아래 (1회 사용)
⚙ 고급   → rare
```

### 4. 계정 그룹 단순화

토스 connected 시 "토스 연결됨 ✓" status row 제거 (badge 가 status 표시 충분). "로그인 상태" + "연결 끊기" 2 row 로 유지.

## 변경 파일

- `src/pages/SettingsPage.tsx` — JSX tree 재구성 + SoundNotifyGroup 제거
- `SETTINGS_INVENTORY.md` (신규 — 별도 commit 가능했으나 본 PR 에 동봉)

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 218 / 218 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## Round 14 후보

1. **계정 status badge merge** — "로그인 상태" + badge → 1 row 단일화
2. **친구 초대 collapse** — 별도 modal 로 이동 (lifetime 1회 사용)
3. **고급 안 카테고리 헤더** — 알림/집중/외관/데이터/정보 sub-header
4. **TimerPreset row 확장** — 15/25/50 + Custom 슬롯 칩 통합 (현재 Custom 은 고급으로 강등됨)
