# ROUND 12 SUMMARY — 도구 칩 표기 + 자루↔가방 명확화 + 경제 audit & 일일 P 캡

Round 11 종료 (`062cd4c`) → Round 12 종료 (`11a2f58`). 7 PR.

## A. PR 1줄 요약

| PR | SHA | 요약 |
| --- | --- | --- |
| PR-86 | `15ac965` | 자루 칩 = 가방 trigger — aria-label "내 가방 (N종 보유)" + title |
| PR-87 | `b64ace2` | 모종삽 칩 "🌱 N" badge + label "모종삽" (사용자 용어) |
| PR-88 | `8267cf9` | 물뿌리개 옵션 C — 3-state badge (정상/경고/끝) + select 차단 |
| PR-89 | `a875e1f` | **ECONOMY_AUDIT.md** — P source 전체 audit, heavy player ~196P/day |
| PR-90 | `2ed0fd0` | **일일 P 캡 100P + dogam +10P** — soft cap, RewardsPanel 진행도 UI |
| PR-91 | `6057886` | 모래시계 가드 — 빈 밭 / 만렙 시 사용 차단 (farmHelpers 신설) |
| PR-92 | `11a2f58` | 도구 재설계 — 수프 황금+5%p / 케이크 모든 보상 1.5배 / 번개 유지 |
| PR-93 | (this) | Round 12 통합 보고 |

## B. 메트릭

| 항목 | 값 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **214 / 214 pass** (188 → 214, +26 신규) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지 토큰 in dist-preview | **0** |
| `"/assets/farm"` literal | **0** |

### Test 증가 분포

| PR | +tests | 누적 |
| --- | --- | --- |
| PR-86 자루 | 0 | 188 |
| PR-87 모종삽 | 0 | 188 |
| PR-88 물뿌리개 | 0 | 188 |
| PR-89 ECONOMY_AUDIT | 0 (docs) | 188 |
| PR-90 dailyCap | 10 | 198 |
| PR-91 farmHelpers | 12 | 210 |
| PR-92 soup 재설계 | 4 | 214 |

## C. 핵심 결정 (자율 + 이유 기록)

### C-1. 일일 P 캡 100P + dogam 10P (PR-90)

**ECONOMY_AUDIT.md** 의 데이터 기반 결정:
- Casual user: ~16P/day → 캡 영향 없음
- Mid user: ~60P/day → 캡 영향 없음
- Heavy user: ~196P/day → 캡 96P 제한 (cap = 100)

채택 이유:
1. reward-disclosure.md (legal) 의 기존 정책 일치
2. `passivesFromOwned.dailyCapBoost` 기존 코드 자산 활용 (Round 9 PR-71)
3. MIN_PAYOUT 50P 대비 2일 출금 가능 (의욕 유지)
4. 150P / 120P 후보 기각 — disclosure 위반 또는 grinding 유인

기각 후보:
- 70P: MIN_PAYOUT 대비 마진 약함
- 120P: disclosure 불일치
- 150P: heavy farming 허용

### C-2. 소프트 캡 (resource grant 차단 X)

User spec "차단" 을 strict interpretation 시 game flow 깨짐:
- 익은 작물 harvest 차단 시 plot 상태 데이터 손실
- mission claim 차단 시 button 의미 상실

자율 결정: **earned counter 만 cap 까지 추적**. resource 는 항상 grant. 캡 의미 = "출금 정산 한도 + 학습 톤 안내".

### C-3. 도구 재설계 (PR-92)

- **수프**: 물뿌리개 +1 → 황금당근 +5%p. 주스 (캔디 +5%p) 의 대칭 디자인.
- **케이크**: 씨앗 +1 → 모든 보상 1.5배. P=0 인 seed 보상이 미미했던 문제 해결.
- **번개**: 유지. 직관 명확 ("전기 = 즉시 충전") + 변경 시 다른 시스템 영향 위험.

### C-4. 모종삽 informational badge — disable 안 함 (PR-87)

`farmStore.plant()` 가 free (씨앗 소비 안 함) → 0 에 disable 시 plant 자체 차단.
→ Phase 1: informational 만. Phase 2 (seed consumption wire 시) disable 패턴 적용.

## D. 자율 적용한 추가 (7건)

1. **모종삽 label "삽" → "모종삽"** (PR-87) — 사용자 용어 일치
2. **물뿌리개 "끝" 1글자 badge** (PR-88) — 한국어 직관, 토스트 보충
3. **물뿌리개 분모 /10 제거** (PR-88) — soup buff 로 11/10 가능 → misleading
4. **3-state badge bg color** (PR-88) — normal white / warning amber / disabled grey
5. **soupActive RollOpts 추가** (PR-92) — juiceActive 와 대칭 구조
6. **`Math.ceil` 케이크 보상** (PR-92) — 사용자 유리 (보수적 올림)
7. **번개 변경 없음 결정** (PR-92) — risk-vs-value 판단으로 audit 만

## E. 사용자 검증 포인트

1. **자루 칩 길게 누르기** — "내 가방" 툴팁 표시 + 스크린리더가 "내 가방 (N종 보유)" 읽음
2. **모종삽 칩** — "🌱 N" badge (씨앗 보유 수). label "모종삽" 으로 변경됨
3. **물뿌리개 칩 5회 이하** — amber badge 색. 0 도달 시 "끝" + 칩 비활성화 (탭 시 토스트)
4. **🎁 보상함 토스포인트 섹션** — "오늘 모은 P  N / 100 P" 진행 바. cap 도달 시 "🌙 오늘은 푹 쉬어요" + 초록 바
5. **모래시계 사용** — 빈 밭 / 만렙 시 토스트 + ActionBar disabled
6. **수프 사용 후 수확** — 황금당근 확률 +5%p (BuffChip 30분 active)
7. **케이크 사용 후 25분+ 포커스** — 농장 보상 1.5배 (씨앗 + grow)

## F. Round 13 후보 (이월 + 신규)

1. **Worker server-side cap enforcement** — 클라이언트 tamper 가능
2. **확률 audit** (PROB_AUDIT.md) — 가챠 / 보물상자 / 드랍 명시 vs hardcode
3. **Phase 2 seed consumption** — farmStore.plant() 가 seed -1 차감 + 모종삽 0 시 disable
4. **GemTrade 페이스 검토** — gem 획득 경로 (daily gift 2%) 가 너무 느림 가능성
5. **반복 cap-reached 토스트** — 첫 도달 시 1회 안내 (현재 silent)
6. **earned counter 의 GemTrade 영향** — 보석→캔디 conversion 도 P-earning 으로 counted (의도 vs 부작용)
7. **lite mode contrast audit** — Round 10/11 의 dark fix 만, light 아직 미검증

## G. 결론

Round 12 = **"밸런싱 + 시각 신호 정밀화"**.

- **UX 정제** (PR-86/87/88): 도구 바 3 칩 의미 명확 (가방/씨앗/물뿌리개 상태)
- **경제 audit** (PR-89): heavy player ~200P 도달 확인 → 캡 정당화
- **일일 캡 도입** (PR-90): 학습 도구 톤 + 출금 정산 양립 (소프트 캡)
- **도구 일관성** (PR-91/92): 모래시계 가드 + 수프/케이크 재설계 → 5 도구 모두 의도 명확

학습 도구 톤 강화 + 시스템 정합성 확보가 핵심. Round 13 은 full QA sweep (audit-driven).

모두 push 완료 — `origin/main` 최신 `11a2f58` (이 보고서 commit 후 갱신).
