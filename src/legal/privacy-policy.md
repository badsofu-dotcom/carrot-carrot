# 개인정보 처리방침 (Privacy Policy) — 초안

본 문서는 Carrot Carrot (BunnyTime v2) 의 개인정보 처리방침 초안. 정식 출시 시 법무 검토 필요.

## 1. 수집하는 개인정보 항목

### 필수
- **사용자 식별자** (`user_key`): Apps in Toss 가 발급. SHA-256 hash 형태.
- **세션 정보**: JWT access/refresh token (Apps in Toss 발급).

### 선택
- **광고 시청 이벤트**: 광고 보상 검증을 위한 nonce + timestamp.
- **알림 권한**: Web Notification API (PR-53 wire 시 적용).

### 자동 수집
- **safeStorage 데이터** (브라우저 / WebView 로컬):
  - `cc.farm.*` (농장 plot 상태)
  - `cc.items.*` (가방 인벤토리)
  - `cc.rewards.*` (메달 / 보물 진행)
  - `cc.buffs.*` (활성 버프)
  - `cc.farmDrop.*` (드랍 카운터)
  - `cc.adPrompt.*` (안내 cooldown)
  - `cc.ad.dailyCount.*` (광고 차수)
- 브라우저 캐시 / 쿠키 (Apps in Toss 인증 토큰).

## 2. 수집 목적

- 서비스 제공 (인증 / 보상 적립 / 가구 상점 통화 운영 / 가챠 pity).
- 일일 한도 / anti-abuse 운영.
- 광고 노출 횟수 추적.

> ⚠ **베타 안내** (Round 33): 토스포인트 환산은 정식 출시 정책 재확정
> 까지 dormant. 베타 동안 자원은 in-app sink (가구 상점 + 가챠 pity)
> 에서만 사용. **광고 시청은 무제한** (일일 자원 캡 면제).

## 3. 보유 및 이용 기간

- 사용자 계정 유지 동안 보유.
- 회원 탈퇴 (`/unlink`) 시 모든 데이터 즉시 삭제.
- safeStorage 데이터는 사용자 직접 브라우저 데이터 삭제로 제거 가능.

## 4. 제3자 제공

- **Apps in Toss**: 인증 토큰 / 광고 시청 검증을 위한 사용자 식별자 전송.
  (정식 출시 시점에 토스포인트 환산 재활성화 시 환산 P 도 전송 — 별도 공시 갱신)
- 그 외 제3자 제공 없음.

## 5. 사용자 권리

- 데이터 열람 / 정정 / 삭제 / 동의 철회 요청 가능.
- 회원 탈퇴 (`/unlink`) 시 자동 처리.
- 알림 권한 거부 시 in-app banner 만 노출 (PR-53).

## 6. 보안

- 모든 통신 HTTPS.
- JWT secret 은 Cloudflare Worker secret store 만 보관 (Git 미커밋).
- safeStorage 는 iframe-safe shim — 리터럴 브라우저 storage API 토큰 번들 노출 방지 (PR-13 정책).

## 7. 개인정보 보호책임자

- 이메일: (출시 전 등록 예정)
- GitHub Issues: 임시 채널.

## 8. 변경 사항

- 변경 시 앱 내 공지 7일 이상.
- 본 문서는 PR-51 초안. 출시 전 법무 검토 필요.

---

*최종 갱신: PR-51 초안.*
