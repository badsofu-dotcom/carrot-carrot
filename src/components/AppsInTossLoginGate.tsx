/**
 * 앱 시작 시 Apps in Toss 로그인 게이트.
 *
 * 의도:
 *   - mount 즉시 Apps in Toss `appLogin()` 흐름을 시작하고, 통과한 뒤에야 children(=홈) 을 렌더한다.
 *   - 통과 전에는 어떤 홈 컨트롤도 노출되지 않는다.
 *   - 실패/취소 시에는 다시 시도 버튼을 보여준다.
 *   - reduced-motion 친화적이고 토스 톤의 따뜻한 미니 화면.
 *
 * 보안 주의:
 *   - 본 컴포넌트 자체에는 client_secret / mTLS 인증서 / DECRYPTION_KEY 가 없다.
 *   - 검증 결과는 sessionStorage 에만 짧게 보관 — 매 앱 실행마다 다시 로그인.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  startAppsInTossLogin,
  appsInTossLoginSession,
  LOGIN_DIAG_BUILD,
  type LoginErrorCode,
  type LoginNetworkDiag,
  type LoginResult,
} from "../lib/appsInTossLogin";

const BASE = import.meta.env.BASE_URL;
const ICON_1X = `${BASE}icons/app-icon-splash-240.webp`;
const ICON_2X = `${BASE}icons/app-icon-splash-480.webp`;
const ICON_PNG = `${BASE}icons/app-icon-192.png`;

type GateState =
  | { phase: "verifying" }
  | { phase: "ok"; via: string }
  | { phase: "fail"; code: LoginErrorCode; detail?: string; networkDiag?: LoginNetworkDiag }
  | { phase: "cancelled"; code: LoginErrorCode }
  | { phase: "unavailable"; code: LoginErrorCode; detail?: string };

interface Props {
  children: React.ReactNode;
}

export function AppsInTossLoginGate({ children }: Props) {
  const [verified, setVerified] = useState<boolean>(() =>
    appsInTossLoginSession.isVerified(),
  );
  const [state, setState] = useState<GateState>({ phase: "verifying" });

  const [trigger, setTrigger] = useState(0);

  const retry = useCallback(() => {
    setState({ phase: "verifying" });
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (verified) return;
    let cancelled = false;
    void (async () => {
      const r: LoginResult = await startAppsInTossLogin();
      if (cancelled) return;
      if (r.kind === "ok") {
        appsInTossLoginSession.markVerified();
        setState({ phase: "ok", via: r.via });
        setTimeout(() => {
          if (!cancelled) setVerified(true);
        }, 280);
        return;
      }
      if (r.kind === "cancelled") {
        setState({ phase: "cancelled", code: r.code });
        return;
      }
      if (r.kind === "unavailable") {
        setState({ phase: "unavailable", code: r.code, detail: r.detail });
        return;
      }
      setState({
        phase: "fail",
        code: r.code,
        detail: r.detail,
        networkDiag: r.networkDiag,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [verified, trigger]);

  if (verified) return <>{children}</>;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apps in Toss 로그인"
      data-testid="apps-in-toss-login-gate"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "var(--surface-base, #FFF8E7)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(255, 153, 64, 0.28), rgba(255,153,64,0) 70%)",
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          position: "relative",
          width: 132,
          height: 132,
          marginBottom: 20,
        }}
      >
        <picture>
          <source type="image/webp" srcSet={`${ICON_1X} 1x, ${ICON_2X} 2x`} />
          <img
            src={ICON_PNG}
            alt="버니타임"
            width={132}
            height={132}
            decoding="async"
            draggable={false}
            style={{
              width: 132,
              height: 132,
              borderRadius: 32,
              objectFit: "contain",
              background: "var(--accent-carrot, #FF9940)",
              boxShadow: "0 16px 32px rgba(199, 62, 29, 0.18)",
            }}
          />
        </picture>
      </motion.div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          color: "var(--text-primary, #2A1810)",
        }}
      >
        버니타임
      </h1>

      <p
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 15,
          lineHeight: 1.5,
          color: "var(--text-secondary, #6B5847)",
          maxWidth: 320,
          whiteSpace: "pre-line",
        }}
      >
        {bodyCopy(state)}
      </p>

      {(state.phase === "fail" ||
        state.phase === "cancelled" ||
        state.phase === "unavailable") && (
        <p
          data-testid="apps-in-toss-login-diag"
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 12,
            color: "var(--text-tertiary, #A78B7A)",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            maxWidth: 320,
            wordBreak: "break-word",
          }}
        >
          {state.code}
          {"detail" in state && state.detail ? ` · ${state.detail}` : ""}
        </p>
      )}

      {state.phase === "fail" &&
        state.code === "NETWORK_ERROR" &&
        state.networkDiag && (
          <pre
            data-testid="apps-in-toss-login-network-diag"
            style={{
              marginTop: 12,
              marginBottom: 0,
              padding: "10px 12px",
              fontSize: 11,
              lineHeight: 1.45,
              color: "var(--text-secondary, #6B5847)",
              background: "rgba(255, 153, 64, 0.08)",
              border: "1px solid rgba(255, 153, 64, 0.24)",
              borderRadius: 10,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              maxWidth: 320,
              width: "100%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              textAlign: "left",
              overflow: "hidden",
            }}
          >
            {formatNetworkDiag(state.networkDiag)}
          </pre>
        )}

      {(state.phase === "fail" ||
        state.phase === "cancelled" ||
        state.phase === "unavailable") && (
        <button
          type="button"
          onClick={retry}
          style={{
            marginTop: 24,
            background: "var(--accent-carrot, #FF6B35)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "12px 28px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(255, 107, 53, 0.28)",
          }}
        >
          다시 시도
        </button>
      )}

      {state.phase === "verifying" && (
        <motion.div
          aria-hidden
          style={{
            marginTop: 24,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "3px solid rgba(255, 107, 53, 0.18)",
            borderTopColor: "var(--accent-carrot, #FF6B35)",
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      )}

      {state.phase === "ok" && state.via === "mock" && (
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "var(--text-tertiary, #A78B7A)",
          }}
          data-testid="apps-in-toss-login-mock-note"
        >
          개발/테스트 모드 — 실제 토스 로그인이 아닙니다.
        </p>
      )}
    </div>
  );
}

function bodyCopy(s: GateState): string {
  switch (s.phase) {
    case "verifying":
      return "토스 로그인을 준비하고 있어요.\n잠시만 기다려 주세요.";
    case "ok":
      return "확인됐어요. 곧 홈으로 이동합니다.";
    case "cancelled":
      return "로그인이 취소되었어요.\n다시 시도해 주세요.";
    case "fail":
      switch (s.code) {
        case "TOKEN_EXCHANGE_FAILED":
          return "토스 토큰 교환에 실패했어요.\n잠시 후 다시 시도해 주세요.";
        case "USERINFO_FAILED":
          return "토스 사용자 정보를 불러오지 못했어요.\n다시 시도해 주세요.";
        case "DECRYPT_FAILED":
          return "사용자 정보 복호화에 실패했어요.\n잠시 후 다시 시도해 주세요.";
        case "MTLS_HANDSHAKE_FAILED":
          return "토스 서버 연결에 실패했어요.\n잠시 후 다시 시도해 주세요.";
        case "AUTHORIZE_FAILED":
          return "토스 로그인 화면에서 문제가 발생했어요.\n다시 시도해 주세요.";
        case "NETWORK_ERROR":
          return "로그인 서버에 연결할 수 없어요.\n네트워크 상태를 확인하고 다시 시도해 주세요.";
        default:
          return "로그인에 실패했어요.\n잠시 후 다시 시도해 주세요.";
      }
    case "unavailable":
      switch (s.code) {
        case "ENV_NOT_APPS_IN_TOSS":
          return "Apps in Toss 환경에서만 로그인을 진행할 수 있어요.\n토스 앱에서 다시 열어 주세요.";
        case "SERVER_ENV_MISSING":
          return "로그인 서버 설정이 아직 준비되지 않았어요.\n잠시 후 다시 시도해 주세요.";
        case "SDK_NOT_FOUND":
          return "토스 로그인 모듈을 불러올 수 없어요.\n토스 앱을 최신 버전으로 업데이트해 주세요.";
        default:
          return "지금은 토스 로그인을 사용할 수 없어요.\n다시 시도하시거나 잠시 후 접속해 주세요.";
      }
  }
}

function formatNetworkDiag(d: LoginNetworkDiag): string {
  const lines: string[] = [];
  lines.push(`빌드: ${LOGIN_DIAG_BUILD}`);
  lines.push(`Worker URL: ${d.workerUrl || "<empty>"}`);
  lines.push(`요청 URL: ${d.attemptedUrl}`);
  lines.push(`인가코드 수신: ${d.hasAuthCode === "yes" ? "예" : "아니오"}`);
  if (d.fetchErrorName || d.fetchErrorMessage) {
    lines.push(
      `fetch 오류: ${d.fetchErrorName ?? ""}${
        d.fetchErrorMessage ? ` / ${d.fetchErrorMessage}` : ""
      }`,
    );
  }
  if (typeof d.healthStatus === "number") {
    lines.push(
      `health: ${d.healthStatus} ${d.healthOk ? "ok" : "fail"}${
        d.healthBody ? ` · ${d.healthBody}` : ""
      }`,
    );
  } else if (d.healthErrorName || d.healthErrorMessage) {
    lines.push(
      `health 오류: ${d.healthErrorName ?? ""}${
        d.healthErrorMessage ? ` / ${d.healthErrorMessage}` : ""
      }`,
    );
  }
  return lines.join("\n");
}
