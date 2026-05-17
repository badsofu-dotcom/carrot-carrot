#!/usr/bin/env bash
#
# ship-ait-postbuild.sh (Round 26.2, PR-158)
#
# `npm run ship:ait` 의 후처리 — 빌드 직후 Downloads 복사 + Telegram
# 알림 + deploymentId 추출/출력. build:ait stdout 은 `/tmp/last-ait-
# build.log` 에 tee 되어 있다고 가정 (ship:ait script 가 보장).
#
# 환경별 안전 — Downloads 폴더가 없으면 (Linux 서버 등) skip,
# tg-notify.sh 가 없으면 skip. set -e 로 artifact 누락만 fail.
#
set -euo pipefail

ARTIFACT_PATH="${ARTIFACT_PATH:-./carrot-carrot.ait}"
DOWNLOADS_DIR="${DOWNLOADS_DIR:-/mnt/c/Users/badso.버니즈/Downloads}"
LOG_PATH="${LOG_PATH:-/tmp/last-ait-build.log}"

COMMIT_HASH="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
COMMIT_MSG="$(git log -1 --pretty=%s 2>/dev/null || echo 'no commit msg')"

# deploymentId — build:ait 출력의 "●  deploymentId: <UUID>" 라인에서 추출
DEPLOY_ID="$(grep -oE 'deploymentId: [a-f0-9-]{36}' "$LOG_PATH" 2>/dev/null | head -1 | awk '{print $2}' || echo 'unknown')"

# Artifact 존재 확인
if [ ! -f "$ARTIFACT_PATH" ]; then
  echo "✗ artifact not found: $ARTIFACT_PATH"
  exit 1
fi

ARTIFACT_SIZE="$(du -h "$ARTIFACT_PATH" 2>/dev/null | awk '{print $1}' || echo '?')"

# Downloads 복사
if [ -d "$DOWNLOADS_DIR" ]; then
  cp "$ARTIFACT_PATH" "$DOWNLOADS_DIR/carrot-carrot.ait"
  echo "✓ copied to $DOWNLOADS_DIR/carrot-carrot.ait"

  # R26.5 — WSL 한정: explorer.exe 로 Downloads 열어 사용자가
  # 바로 .ait 를 끌어다 Apps-in-Toss 콘솔에 업로드할 수 있게 한다.
  # explorer.exe 가 없는 환경(순수 Linux/Mac)에선 skip.
  if command -v explorer.exe >/dev/null 2>&1; then
    # explorer.exe 는 윈도 경로 인자가 필요. wslpath 로 변환.
    WIN_PATH="$(wslpath -w "$DOWNLOADS_DIR" 2>/dev/null || echo "")"
    if [ -n "$WIN_PATH" ]; then
      # explorer.exe 는 폴더를 열면 exit code 1 을 자주 반환 — 무시.
      explorer.exe "$WIN_PATH" >/dev/null 2>&1 || true
      echo "✓ opened Downloads in Explorer ($WIN_PATH)"
    fi
  fi
else
  echo "⚠ Downloads 폴더 없음 ($DOWNLOADS_DIR) — 복사 skip"
fi

# Telegram 알림 (실패해도 exit 0)
if [ -x "$HOME/tg-notify.sh" ]; then
  "$HOME/tg-notify.sh" "🍄 ait push ($COMMIT_HASH) — $COMMIT_MSG. deploymentId: $DEPLOY_ID. Downloads 폴더 준비 완료. (.ait $ARTIFACT_SIZE)" || echo "⚠ Telegram notify 실패"
else
  echo "⚠ tg-notify.sh 없음 ($HOME/tg-notify.sh) — Telegram skip"
fi

echo ""
echo "═══════════════════════════════════════"
echo "✓ commit:       $COMMIT_HASH"
echo "✓ message:      $COMMIT_MSG"
echo "✓ deploymentId: $DEPLOY_ID"
echo "✓ artifact:     $ARTIFACT_PATH ($ARTIFACT_SIZE)"
echo "✓ ready:        $DOWNLOADS_DIR/carrot-carrot.ait"
echo "═══════════════════════════════════════"
