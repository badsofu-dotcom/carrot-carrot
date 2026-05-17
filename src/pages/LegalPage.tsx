/**
 * LegalPage (PR-121) — 개인정보 처리방침 / 이용약관 / 보상 정책 표시.
 *
 * Vite `?raw` import 로 markdown 원본 가져와 <pre> 로 표시. 가벼운
 * 의존성 (md-to-html 라이브러리 X). 베타 스코프 적합.
 *
 * Routes:
 *   /privacy   → 개인정보 처리방침
 *   /terms     → 이용약관
 *   /rewards   → 보상 정책 공시
 */
import privacyMd from "../legal/privacy-policy.md?raw";
import termsMd from "../legal/terms-of-service.md?raw";
import rewardsMd from "../legal/reward-disclosure.md?raw";

interface Props {
  kind: "privacy" | "terms" | "rewards";
}

const META: Record<
  Props["kind"],
  { title: string; content: string }
> = {
  privacy: { title: "개인정보 처리방침", content: privacyMd },
  terms: { title: "이용약관", content: termsMd },
  rewards: { title: "보상 정책 공시", content: rewardsMd },
};

export function LegalPage({ kind }: Props) {
  const { title, content } = META[kind];
  return (
    <main
      className="app-screen"
      data-testid={`page-legal-${kind}`}
      style={{ paddingTop: 24, paddingBottom: 96 }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          {title}
        </h1>
      </header>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "keep-all",
          fontFamily: "inherit",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          background: "var(--bg-elevated)",
          padding: 16,
          borderRadius: 12,
          border: "1px solid var(--border-subtle)",
          overflow: "auto",
        }}
      >
        {content}
      </pre>
    </main>
  );
}

export function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
export function TermsPage() {
  return <LegalPage kind="terms" />;
}
export function RewardsPage() {
  return <LegalPage kind="rewards" />;
}
