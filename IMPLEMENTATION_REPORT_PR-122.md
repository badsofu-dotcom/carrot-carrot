# IMPLEMENTATION_REPORT_PR-122.md — 인앱 피드백 채널

베타 5~20명 대상 피드백 수집.

## 신규 — `src/features/feedback/`

### `feedbackChannel.ts`

```ts
sendFeedback({ message, authMode }): Promise<{ ok, reason? }>
```

POST `VITE_FEEDBACK_WEBHOOK_URL` env (Telegram bot 또는 다른 webhook).

자동 첨부 (개인정보 X):
- `appVersion` (VITE_APP_VERSION env or "dev")
- `authMode` (toss / mock / guest)
- `userAgent`
- `timestamp` (ISO)
- `url` (hash)

Fallback: webhook 미설정 시 클립보드 복사 (개발 환경).

### `FeedbackSheet.tsx`

- Modal — `cc:feedback:open` 이벤트 listener
- 5-row textarea + "취소" / "보내기" 버튼
- safeAreaModalStyle 적용
- busy state during POST
- 결과 toast 4종 (성공 / no_webhook / network / 일반 실패)

## Wire

### `App.tsx`

`<FeedbackSheet />` 글로벌 mount (InAppBanner 패턴 동일).

### `SettingsPage.tsx`

새 `SettingsGroup "💬 피드백"` (친구 초대 그룹 다음, 계정 그룹 위):
```tsx
<Row label="피드백 보내기" sub="버그 · 아이디어 · 불만 환영"
     onClick={() => window.dispatchEvent(new CustomEvent("cc:feedback:open"))} />
```

발견성 위해 visible 그룹 (고급 X). 베타 사용자가 첫 진입 시 인지 쉬움.

## 베타 webhook 설정

메인테이너가 `.env.preview` / Cloudflare Pages env / Apps in Toss 콘솔에 추가:
```
VITE_FEEDBACK_WEBHOOK_URL=https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>
```

또는 별도 webhook (Discord / Slack / 자체 Form). 

baseline: `tg-notify.sh` 와 같은 Telegram bot 토큰 재사용 가능. 단 message format 이 `sendMessage` 의 URL-encoded `text=...` 가 아닌 JSON body — bot API 가 JSON 도 받음.

## 변경 파일

- `src/features/feedback/feedbackChannel.ts` (신규)
- `src/features/feedback/FeedbackSheet.tsx` (신규)
- `src/App.tsx` — FeedbackSheet 글로벌 mount
- `src/pages/SettingsPage.tsx` — "💬 피드백" 그룹 + Row

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 247 / 247 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
