# Round 34 — UI cleanup + economy calibration + 도감 확장 (2026-05-18)

## 한 줄 요약

옛 버전 잔재 카피 정리 + 🎁 선물박스 빨간 점 badge + economy 30일 목표
calibration + dead code 1240 LOC 제거 + 출석 streak 시스템 + 도감
12→35 확장. 게임 전반 최적화 + retention 메커니즘 강화.

## 변경 PR (6개)

| PR | sha | 분류 | 한 줄 |
| --- | --- | --- | --- |
| PR-200 | `379ce36` | fix(copy) | heart "광고 시청 토큰" / "+5 P" / "+10 P" 등 옛 버전 잔재 카피 8개 일괄 정리 |
| PR-201 | `ff0394c` | feat(rewards) | 🎁 선물박스 빨간 점 badge — 오늘의 선물 미수령 OR 주간 보물 ready 시 표시 |
| PR-202 | `a8d6e59` | balance(gacha) | candy pity 10→8 / golden pity 5→3 — 30일×1-2h/day 도감 완성 target |
| PR-203 | `29da006` | cleanup | `_decor_v1_archive` 폴더 전체 + deprecated points 함수 3개 제거 (~1240 LOC) |
| PR-204 | `17341db` | feat(streak) | 일일 출석 streak 시스템 — 매일 +5~10 carrot 자동 보너스 |
| PR-205 | `0c94d45` | feat(dogam) | DOGAM_TOTAL 12 → 35 (23 신규 캐릭터 추가, 기존 transparent webp 재활용) |

## 사용자 요구 반영

| 요구 | 대응 PR |
| --- | --- |
| heart 설명에 "광고 시청 토큰" 잔재 수정 | PR-200 |
| 모든 버튼/문구 점검, 옛 버전 잔재 갱신 | PR-200 |
| 🎁 선물박스 빨간 점 badge (🎯 패턴) | PR-201 |
| 매일 1-2시간 × 30일 = 모든 가구 획득 calibration | PR-202 |
| 불필요한 거 가감 없이 삭제 + 최적화 | PR-203 |
| 추가 게임플레이 아이디어 | PR-204 (streak) |
| 35종 토끼 자산 활용 | PR-205 (도감 확장) |

## 핵심 변화

### Economy calibration

- **가구 1800 carrots**: 광고 무제한 + 수확 + 출석 streak (30일 +285 carrots
  보너스) → 30일 × 1-2h/day 활성 사용자가 풀세트 도달.
- **도감 12 → 35**: 30일 목표는 ~20 마리 (57%), 60-90일 = 풀 컬렉션.
- **가챠 pity 완화**: candy 8 (10→8) / golden 3 (5→3) → 30일 동안 4-5
  pity 가챠 가능.
- **출석 streak**: 매일 농장 첫 진입 시 +5~10 carrots. 6일+ 연속 시
  최대치 (10/day). 30일 누적 285 carrots.

### Code quality

- `_decor_v1_archive/` 폴더 + 14 파일 제거 (1221 LOC).
- `pointsFor` / `totalPoints` / `canWithdraw` 함수 제거 (호출 0건, 15 LOC).
- 총 ~1240 LOC 감소, codebase ~3.8% 슬림화.
- 신규 자산 0 (기존 transparent webp 재활용 → bundle 크기 영향 0).

### UX 개선

- 🎁 보상함 빨간 점 — 미수령 보상 시각 알림.
- heart longDescription "광고 시청 토큰" → "부스트 자원" 정확화.
- 광고 5회 보장 toast 의 "P" 라벨 제거.
- 미션 / 수확 toast 의 "+5 P" / "+10 P" 라벨 일괄 제거.
- 캡 도달 toast 에 "광고 보상은 계속 받을 수 있어요" 안내 추가.

## 검증 결과 (라운드 종합)

| 검사 | R33 끝 | R34 끝 |
| --- | --- | --- |
| `node --test` | 325 pass | **329 pass** (+15 신규 streak, -11 archive cleanup) |
| `npm run typecheck` | clean | clean |
| `npm run build` | OK | OK |
| `npm run build:preview` | OK | OK |
| `dist-preview` forbidden-token | 0/8 | 0/8 |
| codebase LOC | ~32500 | ~31300 (-3.8%) |
| Bunny 도감 | 12 | 35 (-23 신규) |

## 회귀 위험 / 후속

### 회귀 위험

- 도감 12→35 확장으로 일부 사용자 안내 텍스트 ("도감 완성" 등) 가
  12 마리 기준일 수 있음. 후속 PR 에서 audit 가능.
- dogam passives 는 12 마리에서 saturate (13~35 은 추가 패시브 없음).
  의도된 design — 12 = "기본 패시브 완성", 35 = "콜렉션 마스터".
- streak 보너스 (max 10/day) + 광고 N-th tier + harvest 합산 시 1일
  100 carrots 가능 → 가구 30일 풀세트 design target 부합.

### 후속 가능 작업

| ID | 한 줄 | 우선순위 |
| --- | --- | --- |
| R34+1 | 13~35 마리 추가 패시브 layer (콜렉션 마스터 전용 보너스) | 낮음 (선택) |
| R34+2 | streak 임계 보상 (7일/14일/30일 큰 보상) | 중 (retention 강화) |
| R34+3 | "도감 N마리" 라벨 audit (12 → 35 기준 일관성) | 중 |
| R34+4 | bunny v2 transparent vs 기존 colored bg 시각 일관성 점검 | 낮음 |

## 사용자 액션

1. AIT 콘솔에 새 .ait 업로드 후 실기 확인:
   - 농장 우측상단 🎁 버튼: 빨간 점 표시 동작 (오늘 선물 미수령 시)
   - 농장 첫 진입 시 "🔥 N일 연속 출석" toast + carrot 보너스
   - 보상함 → "🥕 오늘 진행" 섹션에 streak chip
   - 인벤토리 → 💗 하트 → 설명문 "부스트 자원" 갱신 확인
   - 도감 페이지 → 35 마리 슬롯 + 23 신규 캐릭터 (gacha 풀에 자동 등장)
   - 수확 toast: "🍬 캔디 당근! +1" / "✨ 황금 당근! +1" (P 라벨 없음)
   - 가챠 pity: 캔디 8개 → rare 보장 / 황금 3개 → epic 보장
   - 광고: 무제한 + 11+회 부터 carrot +1 small 적립

2. **30일 시뮬레이션 target**:
   - 1-2h/day 활성 사용 → 30일 누적: 가구 풀세트 + 도감 ~20 마리
     (57%) + 모든 기본 패시브 (12 마리) + 모든 medal 일부.
   - 광고 source 일일 캡 면제 → 광고 시청 적극 시 더 빠른 진행.
