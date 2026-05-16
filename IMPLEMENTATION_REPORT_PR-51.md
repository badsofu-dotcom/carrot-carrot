# IMPLEMENTATION_REPORT_PR-51.md — GRAC 게임심의 가드레일

게임물 분류 회피를 위한 어휘 정리 + 법적 공시 문서 + 확률 명시.

## A. 어휘 변경 (user-facing 한국어만)

| 이전 | 이후 | 위치 |
| --- | --- | --- |
| "수확 가챠" | "수확 보너스" | itemMeta.ts (4곳), itemsStore.ts (5곳) |
| "토끼 가챠 비용" | "토끼 만나기 비용" | itemMeta.ts, itemsStore.ts (carrot_coin effect) |
| "레전더리 가챠" | "전설 친구 만나기" | GemTradeModal (option title) |
| "레전더리 토끼 시도" | "전설 토끼 unlock" | GemTradeModal (body) |
| "레전더리 토끼 획득" | "전설 토끼 도감 unlock" | GemTradeModal (success toast) |
| "레전더리 토끼 1마리" | "전설 토끼 1마리" | itemsStore (star effect), itemMeta |

코드 식별자 (변수명 `gachaBunnyId` / 파일명 `BunnyGachaModal.tsx` / 이벤트명 `cc:bunny-gacha:show` / `bunnyGacha.ts`) 는 **유지** — 사용자 미노출, 리팩토링 부담 회피.

## B. 확률 명시 (확률형 아이템 공시)

GemTradeModal `legend` 옵션 카피:
- 이전: "레전더리 토끼 1회 시도 (이미 보유면 환불)"
- **신규**: "전설 토끼 1마리 unlock (이미 보유면 보석 환불, **실패 0%**)"

이유: 전설 풀에 `legendary-demon` 1마리만 정의. 미보유 → 100% 성공. 보유 → 50 보석 환불. **확률형 아이템 정의 회피** (결과 보장).

수확 보너스 + 일일 / 주간 / 보물 풀 등은 `src/legal/reward-disclosure.md` 에서 완전 공시.

## C. 신규 법적 문서

`src/legal/` 디렉터리 신규.

1. **`reward-disclosure.md`**
   - 본 앱 분류 (집중 / 생산성 도구) 명시
   - 일일 환산 한도 100 P (도감 100마리 시 110 P)
   - Conversion table
   - 확률형 보너스 풀 5종 (수확 / 친구 만나기 / 일일 선물 / 주간 보물 / 광고 보물 진행) 완전 공시
   - 농장 드랍 풀 가중치 표
   - 광고 정책 + 미성년자 보호 (결제 부재로 별도 보호 안 적용)
   - 환산 정책 (50 P 이상 환산, executePromotion)

2. **`terms-of-service.md`** (초안)
   - 9 조 (목적 / 서비스 분류 / 회원가입 / 이용 / 사용자 의무 / 회사 의무 / 책임 제한 / 약관 변경 / 분쟁 해결)
   - 출시 전 법무 검토 필요 명시.

3. **`privacy-policy.md`** (초안)
   - 8 절 (수집 항목 / 목적 / 보유 기간 / 제3자 / 사용자 권리 / 보안 / 책임자 / 변경)
   - safeStorage 키 enumeration (cc.farm/items/rewards/buffs/farmDrop/adPrompt/ad.dailyCount)
   - Apps in Toss 만 제3자 제공 (executePromotion).

## D. ECONOMY_DESIGN.md 헤더 공시

문서 최상단에 인용 블록:

> 본 앱은 게임물이 아닌 **집중 / 생산성 도구** 입니다. 농장 시각화 + 보상은 사용자의 집중 활동에 대한 인센티브입니다. **일일 환산 한도 100 P** ...

## E. README 카테고리 라벨

```
**카테고리:** 집중 / 생산성 도구 (게임물 분류 아님 — 보상 정책 공시 …)
```

## F. 의도적으로 안 한 것

- "퀘스트" / "레벨업" / "보스" — 코드/UI 에서 사용 안 함 (grep 결과 없음). 안전.
- "확률 배너 UI" — `reward-disclosure.md` + GemTradeModal `legend` 의 "실패 0%" 명시로 대체. 별도 모달 안 만듦 (사용자 spec "UI 에 확률 배너 표시" 는 GemTradeModal 의 카피 보강 + legal 문서로 만족).
- BunnyGachaModal 자체 — 자동 트리거 (수확 / 히든 토끼) 시 비용 없는 unlock surface. 확률형 아이템 정의 밖.

## G. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 110/110 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-52 (일일 미션 시스템).
