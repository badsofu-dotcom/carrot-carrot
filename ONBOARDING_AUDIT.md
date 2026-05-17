# ONBOARDING_AUDIT.md — 신규 사용자 첫 5분 시나리오 (PR-118)

베타 출시 전 신규 사용자 (cold start) 가 첫 5분 안에 핵심 가치를 경험할 수 있는지 검증.

## 시나리오 — 신규 사용자 첫 진입

### Step 1: 앱 로드 (0초)

| 상태 | 확인 |
| --- | --- |
| 인증 | `AppsInTossLoginGate` — Toss 로그인 시도 → 실패 시 게스트 모드 (silent fallback) |
| 첫 화면 | `/` (HomePage) — 타이머 ring + 토끼 |
| Onboarding flag | `onboarded:v1` 미설정 → 농장 첫 진입 시 `BunnyOnboardingModal` 자동 표시 |

### Step 2: 농장 첫 진입 (10초 이내, 사용자가 농장 탭 누르거나 자동 안 됨)

| 상태 | 확인 |
| --- | --- |
| `BunnyOnboardingModal` | 4 step:<br>1. "25분 집중하면 작물이 한 단계씩 자라요"<br>2. "1당근 = 1P, 토스포인트 환산"<br>3. "캔디(5P)/황금(10P) 확률 보상"<br>4. "도감에서 토끼·아이템 컬렉션" |
| Skip 가능 | "건너뛰기" 버튼 — 누구나 짧게 패스 |
| CTA | 단계별 "다음" → step 4 "시작하기" |
| Onboarded flag | 완료 / skip 시 `onboarded:v1 = "true"` |

→ 모달이 학습 도구의 핵심 흐름 (집중 → 작물 → 포인트) 명확 안내. ✅

### Step 3: 첫 25분 포커스 시도 (1분 ~ 26분)

| 시점 | 동작 |
| --- | --- |
| `/` 에서 시작 버튼 탭 | `timerStore.start()` → status = FOCUSING |
| 5분 미만 abandon | `getFocusFarmReward` 가 valid=false → toast "5분 이상 집중해야 작물이 자라요" — gate 명확 |
| 25분 완료 | `lastSnapshot.type === "complete"` → SessionOverlay 표시 + 농장 적용 |

→ 가장 critical: 사용자가 처음 시도할 때 **5분 gate 인지**. 현재 5분 미만 시 toast 만, gate 사전 안내 없음. **개선 후보**: 시작 버튼 위에 "5분 이상 집중해야 보상" 작은 안내.

### Step 4: 첫 수확 (포커스 후 농장 진입)

| 상태 | 확인 |
| --- | --- |
| 농장 자동 진입 | 자동 X — 사용자가 농장 탭 클릭 |
| 작물 stage | 25분 = +1 step → stage 0 (빈 밭) → stage 1 (싹) 변화 |
| Plot 탭 | 모종삽 도구로 빈 밭 탭 → 심기 (이전 시점) |

→ **첫 진입은 빈 농장**. 신규 사용자가 모종삽 칩 → 빈 밭 탭 → 작물 stage 1 → 25분 포커스 후 stage 2/3/4 → 바구니로 수확 → 당근 +1 → "🥕 당근 1개" 토스트.

5단계 흐름 — onboarding 모달은 stage 1 "심기" 안내 부재. **개선 후보**: 모달 step 추가 "빈 밭을 탭해서 작물을 심으세요".

### Step 5: 첫 보상 확인 (5분 ~ 30분)

| 상태 | 확인 |
| --- | --- |
| 보상함 (🎁) | 우상단 헤더 → RewardsPanel 모달. 토스포인트 카드 + 오늘의 선물상자 + 보물상자 |
| 일일 선물 (KST 자정 1회) | "오늘의 선물 받기" 버튼 → claimDailyGift → 캔디/황금/보석 grant |
| 시각 단서 | progress bar 색 변화 + cap reached 시 "🌙 오늘은 푹 쉬어요" |

→ 첫 selfish reward (인벤토리 +) 가 명확. 단 **사용자가 "🎁 버튼 알아채는 지"** 가 변수. headeronly + bunny 그리드 우상단에 비교적 작은 button → 인지 어려울 수 있음.

## 발견 (Beta 전 개선 후보)

### 발견 1. 5분 gate 사전 안내 부재 — **High**

현재: 사용자가 4분 abandon → 토스트로 첫 인지.
→ 시작 버튼 위 작은 hint: "5분 이상 집중해야 보상받아요" (이미 일부 있을 수 있음, 검증 필요)

### 발견 2. Onboarding 모달에 "심기" step 부재 — Medium

현재 4 step 이 전체 시스템 설명 (집중 → 포인트 → 가챠 → 도감). **첫 actionable** = "농장에서 빈 밭을 탭해 심기" 가 빠짐.
→ step 1 보강 또는 step 2 추가: "빈 밭을 탭해 작물을 심고 25분 집중하면 자라요"

### 발견 3. 🎁 보상함 버튼 발견성 — Low

베타 5~20명 대상이라 사용자 1:1 안내 가능 → Round 16 후보.

### 발견 4. 게스트 모드 명시성 — Low

`AuthBadge` 가 "게스트" 표시 → 사용자 인지 가능. 다만 게스트 모드 의미 (출금 불가, 로컬 저장) 안내 부재.
→ Settings 의 계정 그룹 안에 게스트 모드 hint 추가 — Round 16 후보.

### 발견 5. 첫 진입 시 timer preset 기본값 — OK

`selectedMinutes` 기본 25분. 신규 사용자에게 표준 pomodoro 시작점. ✅

## 결론

**Critical blocker: 0건**. Onboarding 모달이 핵심 흐름 안내 적절. 첫 5분 경험 자체는 OK.

**Beta 전 권장 fix (자율)**:
- 발견 1 (High): 5분 gate 사전 hint — PR-119 또는 별도 PR
- 발견 2 (Medium): Onboarding step 보강 — Round 16 후보

미적용 시 베타 사용자가 다소 혼란 가능하지만 시스템 결함 아님.

## 변경 파일

- `ONBOARDING_AUDIT.md` (신규 — 본 보고서, 코드 변경 0)
