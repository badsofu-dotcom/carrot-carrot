/**
 * FriendInviteGroup (PR-62) — Settings 페이지의 "친구 초대" 섹션.
 *
 * inviteStore (PR-54) 의 client stub 를 사용. 백엔드 `/economy/invite`
 * 라우트 wire 전까지는 클라 형식 검증 + safeStorage 영속 만.
 *
 * 구성:
 *   - 내 코드 표시 + 복사 / 공유 버튼
 *   - 친구 코드 입력 폼 + 적용 버튼 (이미 사용했으면 disabled)
 *
 * SettingsGroup / Row 는 SettingsPage 내부 컴포넌트라 직접 import 안 됨
 * → 자체 inline styling (digne look) 으로 self-contained.
 */
import { useState } from "react";
import { Card, toast } from "../../design-system/ui";
import { haptic } from "../../design-system/haptic";
import { useInviteStore } from "./inviteStore";

export function FriendInviteGroup() {
  const myCode = useInviteStore((s) => s.myCode);
  const usedCode = useInviteStore((s) => s.usedCode);
  const applyInviteCode = useInviteStore((s) => s.applyInviteCode);
  const shareIntent = useInviteStore((s) => s.shareIntent);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const onCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(myCode);
        haptic("light");
        toast(`초대 코드 복사: ${myCode}`);
        return;
      }
    } catch {
      /* fall through */
    }
    toast(`초대 코드: ${myCode}`);
  };

  const onShare = async () => {
    const text = shareIntent();
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (
          navigator as Navigator & {
            share: (data: { text: string }) => Promise<void>;
          }
        ).share({ text });
        haptic("light");
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast("공유 텍스트 복사됨 — 메신저에 붙여넣어 주세요");
        return;
      }
    } catch {
      /* ignore */
    }
    toast(text);
  };

  const onApply = () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    const result = applyInviteCode(input);
    setBusy(false);
    switch (result) {
      case "ok":
        haptic("success");
        toast("🎉 친구 초대 적용 — 캔디당근 +2, 보석 +5");
        setInput("");
        break;
      case "self":
        toast("내 코드는 입력할 수 없어요");
        break;
      case "already":
        toast("이미 다른 코드를 적용했어요");
        break;
      case "invalid":
        toast("코드 형식이 올바르지 않아요 (4~12자 영숫자)");
        break;
    }
  };

  return (
    <section style={{ marginBottom: 16 }}>
      <p
        className="t-micro"
        style={{ margin: "0 0 6px 12px", color: "var(--text-tertiary)" }}
      >
        👥 친구 초대
      </p>
      <Card padded={false} style={{ overflow: "hidden", padding: 0 }}>
        {/* 내 코드 row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
          }}
          data-testid="row-invite-self"
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              내 초대 코드
            </p>
            <p
              className="t-caption"
              style={{
                margin: "2px 0 0",
                color: "var(--text-tertiary)",
                lineHeight: 1.3,
              }}
            >
              친구에게 공유
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <span
              data-testid="my-invite-code"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.06)",
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.08em",
              }}
            >
              {myCode}
            </span>
            <button
              type="button"
              onClick={onCopy}
              aria-label="초대 코드 복사"
              data-testid="invite-copy"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent-carrot)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              복사
            </button>
            <button
              type="button"
              onClick={onShare}
              aria-label="초대 코드 공유"
              data-testid="invite-share"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--accent-carrot)",
                background: "transparent",
                color: "var(--accent-carrot)",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              공유
            </button>
          </div>
        </div>

        {/* 친구 코드 입력 row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            background: "var(--bg-elevated)",
          }}
          data-testid="row-invite-input"
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              친구 코드 입력
            </p>
            <p
              className="t-caption"
              style={{
                margin: "2px 0 0",
                color: "var(--text-tertiary)",
                lineHeight: 1.3,
              }}
            >
              {usedCode ? `사용 완료: ${usedCode}` : "보상 받기 (1회)"}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              data-testid="invite-code-input"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              disabled={!!usedCode}
              placeholder="ABCDEF"
              maxLength={12}
              style={{
                width: 110,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-medium, rgba(0,0,0,0.12))",
                fontSize: 13,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: usedCode ? 0.5 : 1,
                background: "var(--bg-elevated)",
              }}
            />
            <button
              type="button"
              onClick={onApply}
              disabled={!input.trim() || busy || !!usedCode}
              aria-label="친구 코드 적용"
              data-testid="invite-apply"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background:
                  input.trim() && !usedCode && !busy
                    ? "var(--accent-carrot)"
                    : "rgba(0,0,0,0.08)",
                color:
                  input.trim() && !usedCode && !busy ? "#fff" : "#888",
                fontSize: 11,
                fontWeight: 800,
                cursor:
                  input.trim() && !usedCode && !busy
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              적용
            </button>
          </div>
        </div>
      </Card>
    </section>
  );
}
