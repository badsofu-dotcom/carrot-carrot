import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bunny } from "../components/Bunny";
import { BottomSheet, Card, Switch, toast, Button } from "../design-system/ui";
import { useTheme, type ThemeMode } from "../design-system/ThemeProvider";
import { useUserStore } from "../store/userStore";
import { haptic } from "../design-system/haptic";
import { loginWithToss, logout as authLogout } from "../services/authService";
import {
  enablePush,
  disablePush,
  getPushSnapshot,
  PUSH_REMINDER_TEXT,
  type PushSnapshot,
} from "../services/pushService";
import {
  PRESETS,
  type Preset,
  useTimerStore,
  loadShowCustomSlot,
  saveShowCustomSlot,
  loadAutoBreak,
  saveAutoBreak,
} from "../store/timerStore";
import { useOwnedCount } from "../features/collection/collectionStore";
import { DevActionsGroup } from "../features/dev/DevActionsGroup";
import { FriendInviteGroup } from "../features/friends/FriendInviteGroup";
import { safeStorage } from "../lib/safeStorage";
import { useSoundStore } from "../store/soundStore";
import { useNotificationsStore } from "../features/notifications/notificationsStore";
import {
  notificationPermission,
  requestNotificationPermission,
} from "../lib/webNotify";
import { ONBOARDING_KEY } from "../features/collection/FarmOnboarding";
import { reopenOnboarding } from "../features/collection/BunnyOnboardingModal";
import { FARM_BG_AUTO_KEY, autoFromStorageValue } from "../lib/farmBackground";
import appIcon120 from "../assets/app-icon-120.png";

const APP_VERSION = "1.0.0 · phase-7";

// `isDev` helper removed in PR-19 — replaced by inline
// `import.meta.env.DEV` checks so Vite can dead-code-eliminate the
// DevActionsGroup tree from production builds.

/** 도감 보유 수에서 프로필 레벨/타이틀 도출. 빈 컬렉션이면 LV.0 / 새내기 토끼. */
function deriveProfileTier(ownedCount: number): { level: number; title: string; cheer: string } {
  const level = ownedCount;
  let title = "새내기 토끼";
  if (ownedCount >= 12) title = "전설의 도둑";
  else if (ownedCount >= 9) title = "베테랑 도둑";
  else if (ownedCount >= 6) title = "노련한 도둑";
  else if (ownedCount >= 3) title = "견습 도둑";
  else if (ownedCount >= 1) title = "당근 새싹";
  const cheer =
    ownedCount === 0
      ? "첫 당근부터 같이 가자"
      : ownedCount >= 12
      ? "도감 마스터, 흐흐"
      : "흐흐 잘하고 있어";
  return { level, title, cheer };
}

export function SettingsPage() {
  const user = useUserStore((s) => s.user);
  const authMode = useUserStore((s) => s.mode);
  const authHint = useUserStore((s) => s.hint);
  const setAuth = useUserStore((s) => s.setAuth);
  const { mode, resolved, setMode } = useTheme();
  const ownedCount = useOwnedCount();
  const tier = deriveProfileTier(ownedCount);
  const [resetSheetOpen, setResetSheetOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const handleConnectToss = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const snap = await loginWithToss();
      setAuth({ user: snap.user, mode: snap.mode, hint: snap.hint });
      if (snap.mode === "toss") toast("토스 연결됨 흐흐");
      else if (snap.mode === "mock") toast("게스트 모드로 연결");
      else toast("아직 게스트 — 나중에 다시 시도해 봐");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    const snap = authLogout();
    setAuth({ user: snap.user, mode: snap.mode, hint: snap.hint });
    toast("로그아웃 됨. 게스트로 계속 쓸 수 있어.");
  };

  return (
    <main className="app-screen" data-testid="page-me" style={{ paddingTop: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          내 정보
        </h1>
      </header>

      {/* Profile card — mock ID 노출 금지. */}
      <Card
        elevated
        padded
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "var(--gradient-mesh)",
          borderRadius: 26,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Phase 7.8 — 최종 앱 아이콘 뱃지 (top-right) */}
        <img
          src={appIcon120}
          alt="버니타임"
          width={20}
          height={20}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 20,
            height: 20,
            borderRadius: 5,
            display: "block",
            boxShadow: "var(--shadow-sm)",
          }}
          data-testid="settings-app-icon-badge"
        />
        <Bunny
          variant="rare_king"
          size={84}
          frame="circle"
          breathe={false}
          alt="프로필 토끼"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="t-micro" style={{ margin: 0, marginBottom: 2 }} data-testid="profile-tier">
            LV.{tier.level} · {tier.title}
          </p>
          <h2
            className="t-h1"
            style={{
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user?.nickname ?? "토끼 친구"}
          </h2>
          <p
            className="t-caption"
            style={{
              margin: 0,
              marginTop: 2,
              color: "var(--text-secondary)",
            }}
            data-testid="profile-badge-count"
          >
            획득 뱃지 {ownedCount}개 · {tier.cheer}
          </p>
        </div>
      </Card>

      {/* PR-101 — IA 재구성. 사용 빈도 기준 reorder + 압축.
          집중 > 알림 > 소리 > 외관 > 친구초대 > 계정 > 고급. */}

      {/* 1. 집중 (가장 자주) */}
      <SettingsGroup title="집중" emoji="🎯">
        <TimerPresetRow />
      </SettingsGroup>

      {/* 2. 알림 (마스터만 — 세부는 고급) */}
      <SettingsGroup title="알림" emoji="🔔">
        <NotifyMasterRow />
      </SettingsGroup>

      {/* 3. 소리 (효과음 + BGM) */}
      <SettingsGroup title="소리" emoji="🔊">
        <SfxMutedRow />
        <FarmBgmToggleRow />
      </SettingsGroup>

      {/* 4. 외관 (다크 모드만 — FarmBgAuto 는 고급) */}
      <SettingsGroup title="외관" emoji="🎨">
        <Row
          label="다크 모드"
          right={
            <div style={{ display: "flex", gap: 4 }}>
              {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  data-testid={`theme-${m}`}
                  aria-pressed={mode === m}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      mode === m ? "var(--accent-carrot)" : "var(--bg-sunken)",
                    color:
                      mode === m
                        ? "var(--text-on-accent)"
                        : "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    transition: "background-color 0.18s var(--ease-smooth)",
                  }}
                >
                  {m === "light" ? "라이트" : m === "dark" ? "다크" : "시스템"}
                </button>
              ))}
            </div>
          }
          sub={`현재: ${resolved === "dark" ? "다크" : "라이트"}`}
          last
        />
      </SettingsGroup>

      {/* 5. 친구 초대 (발견성 위해 visible) */}
      <FriendInviteGroup />

      {/* 6. 계정 (가장 아래) */}
      <SettingsGroup title="계정" emoji="👤">
        <Row
          label="로그인 상태"
          right={<AuthBadge mode={authMode} />}
          sub={authHint}
        />
        {authMode !== "toss" ? (
          <Row
            label={authBusy ? "연결 중..." : "토스로 로그인"}
            right={
              <span style={{ color: "var(--accent-carrot)", fontWeight: 800, fontSize: 13 }}>
                연결 →
              </span>
            }
            onClick={handleConnectToss}
            last
            testId="row-connect-toss"
          />
        ) : (
          <Row
            label="토스 연결 끊기"
            right={<span style={{ color: "var(--accent-devil)", fontWeight: 700, fontSize: 13 }}>로그아웃</span>}
            onClick={handleLogout}
            last
            testId="row-logout"
          />
        )}
      </SettingsGroup>

      {/* 7. 고급 설정 — 모든 rare actions */}
      <SettingsGroup title="고급 설정" emoji="⚙">
        <AdvancedDisclosure>
          {/* 알림 세부 */}
          <PushReminderRow />
          <NotifyKindRow kind="drop" label="농장 드랍" sub="아이템이 떨어졌을 때" />
          <NotifyKindRow kind="session" label="집중 완료" sub="25분 / 50분 완료" />
          <NotifyKindRow kind="mission" label="오늘의 목표" sub="미션 안내" />
          <NotifyKindRow kind="treasure" label="주간 보물상자" sub="진행 7 충족 시" />
          <EndAlertRow />
          {/* 집중 세부 */}
          <CustomSlotToggleRow />
          <AutoBreakToggleRow />
          {/* 외관 세부 */}
          <FarmBgAutoToggleRow />
          {/* 데이터 */}
          <Row
            label="캐시 비우기"
            right={<Chevron />}
            onClick={() => toast("캐시는 다음 단계에서 비울 수 있어")}
          />
          <Row
            label="온보딩 다시 보기"
            sub="농장 안내 4단계 다시 보기"
            right={<Chevron />}
            onClick={() => {
              haptic("light");
              safeStorage.set(ONBOARDING_KEY, "false");
              reopenOnboarding();
              toast("온보딩을 다시 시작했어요");
            }}
            testId="row-reset-onboarding"
          />
          <Row
            label="데이터 초기화"
            right={<span style={{ color: "var(--accent-devil)", fontWeight: 700, fontSize: 13 }}>위험</span>}
            onClick={() => {
              haptic("warning");
              setResetSheetOpen(true);
            }}
            testId="row-data-reset"
          />
          {/* 정보 */}
          <Row label="버전" right={<span className="t-caption" style={{ color: "var(--text-tertiary)" }}>{APP_VERSION}</span>} />
          <Row label="이미지 크레딧" right={<span className="t-caption" style={{ color: "var(--text-tertiary)" }}>illustrated by carrot team</span>} />
          <Row label="개발자" right={<span className="t-caption" style={{ color: "var(--text-tertiary)" }}>주식회사 버니즈농장</span>} last />
        </AdvancedDisclosure>
      </SettingsGroup>

      {/* DEV 모드 전용 — 고급 밖에 별도 그룹 (env gate). */}
      {(import.meta.env.DEV || import.meta.env.VITE_TIMER_DEBUG === "true") && (
        <DevActionsGroup />
      )}


      <BottomSheet
        open={resetSheetOpen}
        onClose={() => setResetSheetOpen(false)}
        title="진심? 다 지울거야?"
      >
        <div style={{ textAlign: "center", padding: "4px 0 12px" }}>
          <div style={{ display: "inline-block", animation: "cry-shake 0.6s ease-in-out 2" }}>
            <AnimatePresence>
              <motion.div
                key="cry"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              >
                <Bunny
                  variant="cry"
                  size={140}
                  frame="circle"
                  breathe={false}
                  alt="울먹이는 토끼"
                />
              </motion.div>
            </AnimatePresence>
          </div>
          <p
            className="t-h2"
            style={{ marginTop: 14, marginBottom: 6, color: "var(--text-primary)" }}
          >
            흐ㅣㅣ... 증말?
          </p>
          <p
            className="t-body"
            style={{ marginTop: 0, marginBottom: 18, color: "var(--text-secondary)" }}
          >
            그동안 모은 당근... 다 사라져버리는데 진짜 괜찮겠어?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              variant="secondary"
              fullWidth
              size="md"
              onClick={() => {
                haptic("light");
                setResetSheetOpen(false);
              }}
              data-testid="button-reset-cancel"
            >
              아니야 미안해
            </Button>
            <Button
              variant="ghost"
              fullWidth
              size="sm"
              onClick={() => {
                haptic("warning");
                setResetSheetOpen(false);
                toast("진짜 지우기는 Phase 3 에서 서버 연동 후 흐흐");
              }}
              style={{ color: "var(--accent-devil)" }}
              data-testid="button-reset-confirm"
            >
              그래도 지울래 (Phase 3)
            </Button>
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}

/* ----------------------- Sound & notify settings ----------------------- */

const END_ALERT_KEY = "cc.push.endAlert.v1";
// PR-78 — HAPTIC_KEY 제거 (haptic() stub no-op).
const ADVANCED_OPEN_KEY = "cc.settings.advanced.open.v1";

function loadFlag(key: string, fallback: boolean): boolean {
  const raw = safeStorage.get(key);
  if (raw === null || raw === undefined) return fallback;
  return raw === "1";
}
function saveFlag(key: string, v: boolean) {
  try { safeStorage.set(key, v ? "1" : "0"); } catch { /* ignore */ }
}

/**
 * PR-69 — 알림 & 소리 통합 섹션.
 *
 * Master 4종 + 고급 disclosure 6종.
 * Master:
 *   - 🔔 알림 받기 (notificationsStore master + active counter)
 *   - 🔊 효과음 + 볼륨 (같은 카드)
 *   - 🎵 농장 BGM + 볼륨
 *   - 📳 진동
 * 고급 (default collapsed, safeStorage 영속):
 *   - 매일 22시 리마인더 (Toss push)
 *   - 농장 드랍 / 집중 완료 / 오늘의 목표 / 주간 보물상자 (NotifyKind, master OFF 시 disabled)
 *   - 집중 끝났을 때 깨워줘 (timer end alert)
 */
// PR-101 — SoundNotifyGroup 제거. 알림/소리 분리 + AdvancedDisclosure
// 를 top-level 그룹으로 승격.

/**
 * AdvancedDisclosure — 고급 설정 접힘 트리거 + 영속.
 * default collapsed, 한 번 펼치면 safeStorage 에 저장 → 다음 방문 유지.
 */
function AdvancedDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<boolean>(
    () => safeStorage.get(ADVANCED_OPEN_KEY) === "1",
  );
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      safeStorage.set(ADVANCED_OPEN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    haptic("light");
  };
  return (
    <>
      <Row
        label="고급 설정"
        sub={open ? "접으려면 다시 탭" : "리마인더 / 알림 종류 등 (6개)"}
        right={
          <span
            data-testid="advanced-toggle-icon"
            aria-hidden
            style={{
              fontSize: 14,
              color: "var(--text-tertiary)",
              fontWeight: 800,
            }}
          >
            {open ? "▲" : "▼"}
          </span>
        }
        onClick={toggle}
        last={!open}
        testId="row-advanced-toggle"
      />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="advanced-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
            data-testid="advanced-body"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PushReminderRow() {
  const [snap, setSnap] = useState<PushSnapshot>(() => getPushSnapshot());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSnap(getPushSnapshot());
  }, []);
  const onToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    haptic(next ? "light" : "warning");
    try {
      const result = next ? await enablePush() : await disablePush();
      setSnap(result);
      if (next && result.status === "ready") toast("알림 준비 완료 — 밤 22시에 만나");
      else if (next && result.status === "no_sdk") toast("토스 앱 안에서만 푸시 동작");
      else if (next && result.status === "permission_denied") toast("권한 거부 — OS 설정에서 허용해 줘");
      else if (next && result.status === "error") toast("토큰 발급 실패");
      else if (!next) toast("리마인더 끔");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Row
      label="매일 22시 리마인더"
      sub={`"${PUSH_REMINDER_TEXT}"`}
      right={
        <Switch
          checked={snap.enabled}
          onChange={onToggle}
          label="22시 리마인더"
          disabled={busy}
        />
      }
      testId="row-push-toggle"
    />
  );
}

function EndAlertRow({ last }: { last?: boolean }) {
  const [on, setOn] = useState<boolean>(() => loadFlag(END_ALERT_KEY, true));
  const toggle = (v: boolean) => {
    setOn(v);
    saveFlag(END_ALERT_KEY, v);
    haptic(v ? "light" : "warning");
    toast(v ? "집중 끝나면 깨워줄게" : "끝 알림 끔");
  };
  return (
    <Row
      label="집중 끝났을 때 깨워줘"
      sub="타이머 종료 알림 — 토스 안에서만"
      right={
        <Switch checked={on} onChange={toggle} label="집중 종료 알림" />
      }
      last={last}
      testId="row-end-alert-toggle"
    />
  );
}

// PR-78 — HapticToggleRow / HAPTIC_KEY 제거. haptic() 자체가 stub
// no-op 이 되어서 토글 불필요. 향후 mission/session 클리어 햅틱이
// 의도된 UX 로 다시 필요해지면 별도 PR.

/* ---------------------- PR-61 알림 토글 ---------------------- */

function NotifyMasterRow() {
  const masterEnabled = useNotificationsStore((s) => s.masterEnabled);
  const setMaster = useNotificationsStore((s) => s.setMaster);
  const byKind = useNotificationsStore((s) => s.byKind);
  const [permission, setPermission] = useState(
    () => notificationPermission(),
  );
  const onToggle = async (v: boolean) => {
    setMaster(v);
    haptic(v ? "light" : "warning");
    if (v && permission === "default") {
      const next = await requestNotificationPermission();
      setPermission(next);
      if (next === "granted") toast("알림 권한 허용됨");
      else if (next === "denied") toast("권한 거부 — 앱 안에서 보여줌");
      else toast("알림 ON");
    } else {
      toast(v ? "알림 ON" : "알림 OFF");
    }
  };
  // PR-69 — master ON 시 active 알림 종류 카운터.
  const KINDS = ["drop", "session", "mission", "treasure", "midnight"] as const;
  const activeCount = KINDS.filter((k) => byKind[k] !== false).length;
  const subText = (() => {
    if (!masterEnabled) return "꺼짐";
    if (permission === "granted") return `권한 OK · ${activeCount}개 활성`;
    if (permission === "denied") return `권한 거부 — 앱 안에서 보여줌 · ${activeCount}개 활성`;
    if (permission === "unsupported") return `미지원 — 앱 안에서 보여줌 · ${activeCount}개 활성`;
    return `탭하면 권한 요청 · ${activeCount}개 활성`;
  })();
  return (
    <Row
      label="알림 받기"
      sub={subText}
      right={
        <Switch
          checked={masterEnabled}
          onChange={onToggle}
          label="알림 받기"
        />
      }
      testId="row-notify-master"
    />
  );
}

function NotifyKindRow({
  kind,
  label,
  sub,
  last,
}: {
  kind: "drop" | "session" | "mission" | "treasure" | "midnight";
  label: string;
  sub?: string;
  last?: boolean;
}) {
  const byKind = useNotificationsStore((s) => s.byKind);
  const setKind = useNotificationsStore((s) => s.setKind);
  const master = useNotificationsStore((s) => s.masterEnabled);
  const value = byKind[kind] !== false;
  return (
    <Row
      label={label}
      sub={sub}
      right={
        <Switch
          checked={master && value}
          onChange={(v) => {
            setKind(kind, v);
            haptic("light");
          }}
          disabled={!master}
          label={label}
        />
      }
      last={last}
      testId={`row-notify-${kind}`}
    />
  );
}

function SfxMutedRow() {
  const sfxMuted = useSoundStore((s) => s.sfxMuted);
  const setSfxMuted = useSoundStore((s) => s.setSfxMuted);
  const toggle = (next: boolean) => {
    // `next` is whether the row Switch is checked.  Row label asks the
    // user "효과음" (= "play SFX") — checked = on, unchecked = muted.
    setSfxMuted(!next);
    haptic(next ? "light" : "warning");
    toast(next ? "효과음 켬" : "효과음 끔");
  };
  return (
    <Row
      label="효과음"
      sub="씨앗 · 물뿌리개 · 바구니 탭 사운드"
      right={
        <Switch
          checked={!sfxMuted}
          onChange={toggle}
          label="효과음"
        />
      }
      testId="row-sfx-toggle"
    />
  );
}

function FarmBgmToggleRow() {
  const enabled = useSoundStore((s) => s.farmBgmEnabled);
  const setEnabled = useSoundStore((s) => s.setFarmBgmEnabled);
  const toggle = (next: boolean) => {
    setEnabled(next);
    haptic(next ? "light" : "warning");
    toast(next ? "농장 BGM 켬" : "농장 BGM 끔");
  };
  return (
    <Row
      label="농장 BGM"
      sub="하늘에 맞춰 자동 재생"
      right={
        <Switch checked={enabled} onChange={toggle} label="농장 BGM" />
      }
      testId="row-farm-bgm-toggle"
    />
  );
}

/* DEV actions moved to src/features/dev/DevActionsGroup.tsx (PR-19) */

interface SettingsGroupProps {
  title: string;
  /** PR-69 — 섹션 헤더 emoji prefix (시각 스캔 속도 ↑). */
  emoji?: string;
  children: ReactNode;
}

function SettingsGroup({ title, emoji, children }: SettingsGroupProps) {
  return (
    <section style={{ marginBottom: 16 }}>
      <p
        className="t-micro"
        style={{ margin: "0 0 6px 12px", color: "var(--text-tertiary)" }}
      >
        {emoji ? `${emoji} ${title}` : title}
      </p>
      <Card padded={false} style={{ overflow: "hidden", padding: 0 }}>
        {children}
      </Card>
    </section>
  );
}

interface RowProps {
  label: string;
  sub?: string;
  right?: ReactNode;
  onClick?: () => void;
  last?: boolean;
  testId?: string;
}

function Row({ label, sub, right, onClick, last, testId }: RowProps) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      data-testid={testId}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--border-subtle)",
        cursor: interactive ? "pointer" : "default",
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{label}</p>
        {sub && (
          <p
            className="t-caption"
            style={{ margin: 0, marginTop: 2, color: "var(--text-tertiary)" }}
          >
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

function Chevron() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TimerPresetRow() {
  const selectedMinutes = useTimerStore((s) => s.selectedMinutes);
  const setPreset = useTimerStore((s) => s.setPreset);
  const status = useTimerStore((s) => s.status);
  const onPick = (p: Preset) => {
    haptic("medium");
    setPreset(p);
    if (status !== "IDLE") {
      toast(`다음 라운드부터 ${p}분으로 적용`);
    } else {
      toast(`집중 시간 ${p}분으로 설정`);
    }
  };
  return (
    <Row
      label="한 판 집중 시간"
      sub="15 / 25 / 50분 중 선택"
      right={
        <div
          style={{ display: "flex", gap: 4 }}
          role="radiogroup"
          aria-label="집중 시간 프리셋"
        >
          {PRESETS.map((p) => {
            const active = selectedMinutes === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPick(p)}
                role="radio"
                aria-checked={active}
                data-testid={`preset-${p}`}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: active
                    ? "var(--accent-carrot)"
                    : "var(--bg-sunken)",
                  color: active
                    ? "var(--text-on-accent)"
                    : "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition:
                    "background-color 0.18s var(--ease-smooth)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {p}분
              </button>
            );
          })}
        </div>
      }
      testId="row-timer-preset"
    />
  );
}

function CustomSlotToggleRow() {
  const [enabled, setEnabled] = useState<boolean>(loadShowCustomSlot);
  const toggle = (next: boolean) => {
    setEnabled(next);
    saveShowCustomSlot(next);
    haptic("light");
    toast(next ? "홈에 ⚙ 커스텀 슬롯 표시" : "커스텀 슬롯 숨김");
  };
  return (
    <Row
      label="시작 화면에 커스텀 슬롯 표시"
      sub="홈 프리셋 옆 ⚙ 커스텀 칩"
      right={
        <Switch
          checked={enabled}
          onChange={toggle}
          label="커스텀 슬롯"
        />
      }
      testId="row-custom-slot-toggle"
    />
  );
}

function FarmBgAutoToggleRow() {
  const [enabled, setEnabled] = useState<boolean>(() =>
    autoFromStorageValue(safeStorage.get(FARM_BG_AUTO_KEY)),
  );
  const toggle = (next: boolean) => {
    setEnabled(next);
    safeStorage.set(FARM_BG_AUTO_KEY, next ? "1" : "0");
    haptic("light");
    toast(next ? "시간에 따라 농장 배경이 바뀌어요" : "농장 배경 고정");
  };
  return (
    <Row
      label="배경 자동 변경"
      sub="아침 · 낮 · 저녁 · 밤 자동"
      right={
        <Switch checked={enabled} onChange={toggle} label="배경 자동 변경" />
      }
      testId="row-farm-bg-auto-toggle"
    />
  );
}

function AutoBreakToggleRow() {
  const [enabled, setEnabled] = useState<boolean>(loadAutoBreak);
  const toggle = (next: boolean) => {
    setEnabled(next);
    saveAutoBreak(next);
    haptic("light");
    toast(
      next
        ? "집중 끝나면 5분 휴식 자동 시작"
        : "휴식 자동 시작 끔",
    );
  };
  return (
    <Row
      label="집중 끝나면 5분 휴식 자동 시작"
      sub="완료 모달 대신 바로 휴식 5분"
      right={
        <Switch checked={enabled} onChange={toggle} label="자동 휴식" />
      }
      last
      testId="row-auto-break-toggle"
    />
  );
}

function AuthBadge({ mode }: { mode: "loading" | "toss" | "mock" | "guest" }) {
  // Phase 7.9 polish — mock 모드는 사용자에게 "게스트" 로만 노출 (DEV 빌드 포함).
  // 개발자 정보가 필요하면 DEV-only DevActionsGroup 에서 별도 확인.
  const map = {
    toss: { label: "토스", bg: "var(--accent-carrot)", fg: "var(--text-on-accent)" },
    mock: { label: "게스트", bg: "var(--bg-sunken)", fg: "var(--text-secondary)" },
    guest: { label: "게스트", bg: "var(--bg-sunken)", fg: "var(--text-secondary)" },
    loading: { label: "...", bg: "var(--bg-sunken)", fg: "var(--text-tertiary)" },
  } as const;
  const m = map[mode];
  return (
    <span
      data-testid={`auth-badge-${mode}`}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        background: m.bg,
        color: m.fg,
      }}
    >
      {m.label}
    </span>
  );
}

/** Phase 8.0-a — `/me` route alias. SettingsPage 내용 그대로 (heading 만 "내 정보"). */
export const MyInfoPage = SettingsPage;
