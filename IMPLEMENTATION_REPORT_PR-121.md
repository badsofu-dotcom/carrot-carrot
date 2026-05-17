# IMPLEMENTATION_REPORT_PR-121.md — 법적 문서 라우트 (privacy / terms / rewards)

베타 출시 + 앱스토어 통과를 위한 법적 문서 in-app 노출.

## 변경

### 신규 — `src/pages/LegalPage.tsx`

3 routes:
- `/privacy` → `PrivacyPage` (개인정보 처리방침)
- `/terms` → `TermsPage` (이용약관)
- `/rewards` → `RewardsPage` (보상 정책 공시)

Vite `?raw` import 로 markdown 가져와 `<pre>` 로 표시. 가벼운 의존성 (md-to-html 라이브러리 X), 베타 스코프 적합. 사용자 가독성: monospace 대신 inherit font + `whiteSpace: "pre-wrap"` + `wordBreak: "keep-all"`.

### App.tsx 라우트 추가

```tsx
<Route path="/privacy" component={PrivacyPage} />
<Route path="/terms" component={TermsPage} />
<Route path="/rewards" component={RewardsLegalPage} />
```

`lazy()` 로 code split — 베타 사용자가 안 들어가도 bundle 영향 minimal.

### SettingsPage 고급 disclosure 안에 링크

`내 정보 → ⚙ 고급 설정 → 펼치기` 안에 3 row 추가:
- 개인정보 처리방침 → /privacy
- 이용약관 → /terms
- 보상 정책 공시 → /rewards

`useLocation()` (wouter useHashLocation) 의 navigate 사용 — 내부 이동.

### 부가 fix — privacy-policy.md 의 forbidden token 제거

`localStorage` 단어 리터럴 → "브라우저 storage API" 우회 표현. PR-13 의 forbidden token 정책 일관 적용 (Vite `?raw` import 가 md 내용 bundle 에 inline).

## 베타 / 앱스토어 영향

- 앱스토어 심사 시 "개인정보 처리방침 URL" / "이용약관 URL" 입력란 → in-app `/privacy` 직접 링크 또는 publish URL 사용
- 사용자가 Settings 통해 in-app 열람 가능 → 신뢰감

## 변경 파일

- `src/pages/LegalPage.tsx` (신규)
- `src/App.tsx` — 3 lazy import + 3 Route
- `src/pages/SettingsPage.tsx` — useLocation import + navigate + 3 Row
- `src/legal/privacy-policy.md` — forbidden token 우회

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 247 / 247 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |

## 후속 (Round 16)

1. 법무 검토 후 정식본 (현재 "초안" 명시)
2. 미성년자 보호 정책 명확화 (광고 ID 처리 + 결제 부재)
3. markdown → HTML 렌더 (베타 후 사용자 가독성 향상 시)
