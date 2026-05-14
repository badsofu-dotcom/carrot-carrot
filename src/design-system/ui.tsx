/**
 * 디자인 시스템 v2 — 공통 UI 프리미티브.
 * Button / Card / Chip / Toast / BottomSheet / ProgressRing / Sparkles 등
 * 모든 색상은 CSS 토큰 참조. 다크/라이트 자동.
 */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "./haptic";

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/* -------------------- Button -------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  haptics?: boolean;
}

const sizeStyle: Record<ButtonSize, { px: number; py: number; font: string; min: number }> = {
  sm: { px: 14, py: 8, font: "var(--text-caption)", min: 36 },
  md: { px: 18, py: 12, font: "var(--text-body)", min: 44 },
  lg: { px: 22, py: 16, font: "var(--text-h2)", min: 52 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    haptics = true,
    className = "",
    onClick,
    disabled,
    children,
    style,
    ...rest
  },
  ref,
) {
  const s = sizeStyle[size];
  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return {
          background: "var(--accent-carrot)",
          color: "var(--text-on-accent)",
          boxShadow: "var(--shadow-glow-carrot)",
        };
      case "secondary":
        return {
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--border-subtle)",
        };
      case "ghost":
        return {
          background: "transparent",
          color: "var(--text-primary)",
        };
      case "destructive":
        return {
          background: "var(--accent-devil)",
          color: "var(--text-on-accent)",
          boxShadow: "var(--shadow-md)",
        };
    }
  })();

  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 600, damping: 20 }}
      onClick={(e) => {
        if (haptics) haptic("light");
        onClick?.(e);
      }}
      disabled={disabled || loading}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: `${s.py}px ${s.px}px`,
        minHeight: s.min,
        borderRadius: "var(--radius-button)",
        fontWeight: 700,
        fontSize: s.font,
        letterSpacing: "-0.01em",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? "100%" : undefined,
        transition: "background-color var(--dur-fast) var(--ease-smooth), color var(--dur-fast) var(--ease-smooth)",
        ...variantStyle,
        ...style,
      }}
      {...(rest as Record<string, unknown>)}
    >
      {loading ? <Spinner /> : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </motion.button>
  );
});

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

/* -------------------- Card -------------------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  padded?: boolean;
  interactive?: boolean;
  tone?: "neutral" | "carrot" | "sunken";
}

export function Card({
  elevated = false,
  padded = true,
  interactive = false,
  tone = "neutral",
  className = "",
  style,
  children,
  ...rest
}: CardProps) {
  const bg =
    tone === "carrot"
      ? "var(--accent-carrot-soft)"
      : tone === "sunken"
        ? "var(--bg-sunken)"
        : "var(--bg-elevated)";
  return (
    <div
      className={className}
      style={{
        background: bg,
        borderRadius: "var(--radius-card)",
        padding: padded ? "var(--space-5)" : 0,
        boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-sm)",
        border: "1px solid var(--border-subtle)",
        transition: "transform var(--dur-fast) var(--ease-smooth), box-shadow var(--dur-fast) var(--ease-smooth)",
        ...(interactive
          ? { cursor: "pointer" }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* -------------------- Chip -------------------- */

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "neutral" | "carrot";
}

export function Chip({
  active = false,
  tone = "neutral",
  className = "",
  style,
  children,
  ...rest
}: ChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 600, damping: 22 }}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        // 한국어 라벨이 chip 안에서 세로로 줄바꿈되지 않도록 강제 (Phase 7.9 polish).
        whiteSpace: "nowrap",
        wordBreak: "keep-all",
        flexShrink: 0,
        background: active
          ? tone === "carrot"
            ? "var(--accent-carrot)"
            : "var(--text-primary)"
          : "var(--bg-elevated)",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        border: active ? "1px solid transparent" : "1px solid var(--border-subtle)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        cursor: "pointer",
        transition: "background-color var(--dur-fast) var(--ease-smooth), color var(--dur-fast) var(--ease-smooth)",
        ...style,
      }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}

/* -------------------- ProgressRing (SVG) -------------------- */

interface ProgressRingProps {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  trackColor?: string;
  color?: string;
  rounded?: boolean;
  children?: ReactNode;
  ariaLabel?: string;
}

export function ProgressRing({
  size = 220,
  stroke = 12,
  progress,
  trackColor = "var(--border-subtle)",
  color = "var(--accent-carrot)",
  rounded = true,
  children,
  ariaLabel,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = c * (1 - clamped);
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="img"
      aria-label={ariaLabel ?? `진행률 ${Math.round(clamped * 100)}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap={rounded ? "round" : "butt"}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

/* -------------------- BottomSheet -------------------- */

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              // Phase 7.9 — backdrop-filter:blur 제거. Chromium 합성 경로에서
              // overflow:hidden + border-radius 로 hard-clip 된 timer stage 가
              // backdrop blur 위에서 사각 artifact 로 누출되는 버그를 회피한다.
              // 단순 어두운 scrim 만 사용 — 충분히 모달감을 준다.
              background: "rgba(15, 12, 8, 0.6)",
              zIndex: 200,
            }}
            aria-hidden
          />
          <div
            key="bs-wrap"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              zIndex: 201,
              pointerEvents: "none",
            }}
          >
          <motion.div
            key="bs-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80) onClose();
            }}
            style={{
              width: "100%",
              maxWidth: "var(--app-max-width)",
              background: "var(--bg-elevated)",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              boxShadow: "var(--shadow-lg)",
              padding: "12px 20px calc(24px + env(safe-area-inset-bottom)) 20px",
              maxHeight: "85vh",
              overflowY: "auto",
              pointerEvents: "auto",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                background: "var(--border-medium)",
                margin: "4px auto 16px",
              }}
            />
            {title && (
              <h2 id={titleId} className="t-h1" style={{ margin: 0, marginBottom: 8 }}>
                {title}
              </h2>
            )}
            {children}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </Portal>
  );
}

/* -------------------- Toast (lightweight) -------------------- */

export interface ToastMessage {
  id: number;
  text: string;
  tone?: "default" | "success" | "warning";
  duration?: number;
}

interface ToastApi {
  show: (text: string, opts?: Partial<Omit<ToastMessage, "id" | "text">>) => void;
}

let toastApiRef: ToastApi | null = null;
export function toast(text: string, opts?: Partial<Omit<ToastMessage, "id" | "text">>) {
  toastApiRef?.show(text, opts);
}

const TOAST_MAX_VISIBLE = 3;

export function ToastViewport() {
  const [items, setItems] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Map<number, number>>(new Map());
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const timers = timersRef.current;
    const scheduleDismiss = (id: number, dur: number) => {
      const prev = timers.get(id);
      if (prev !== undefined) window.clearTimeout(prev);
      const handle = window.setTimeout(() => {
        timers.delete(id);
        setItems((s) => s.filter((i) => i.id !== id));
      }, dur);
      timers.set(id, handle);
    };

    toastApiRef = {
      show: (text, opts) => {
        const dur = opts?.duration ?? 2400;
        const tone = opts?.tone;
        setItems((s) => {
          // Coalesce duplicate text already on screen: refresh its timer instead of stacking.
          const dupe = s.find((i) => i.text === text);
          if (dupe) {
            scheduleDismiss(dupe.id, dur);
            return s.map((i) =>
              i.id === dupe.id ? { ...i, tone, duration: dur } : i,
            );
          }
          const id = Date.now() + Math.random();
          scheduleDismiss(id, dur);
          const next = [...s, { id, text, tone, duration: dur }];
          // Cap visible toasts: drop oldest beyond the limit so newest stay on top.
          if (next.length > TOAST_MAX_VISIBLE) {
            const drop = next.slice(0, next.length - TOAST_MAX_VISIBLE);
            for (const d of drop) {
              const handle = timers.get(d.id);
              if (handle !== undefined) {
                window.clearTimeout(handle);
                timers.delete(d.id);
              }
            }
            return next.slice(-TOAST_MAX_VISIBLE);
          }
          return next;
        });
      },
    };
    return () => {
      toastApiRef = null;
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-live="polite"
      data-cc-toast="1"
      // Drop the bottom from inline style so the stylesheet rule for
      // body[data-farm-view="1"] can win (inline style has higher
      // specificity than a class selector). The base.css rule covers
      // both default and farm-view positioning.
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 300,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "min(360px, calc(100% - 32px))" }}>
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            data-cc-toast-pill="1"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{
              // Only props that should never differ between screens.
              // Every visual chrome bit (background, border, blur,
              // shadow, radius, padding) is set in base.css so the
              // farm-view rule can flip them off cleanly without
              // fighting inline-style specificity. See
              // base.css → `[data-cc-toast-pill="1"]` (default)
              //         and `body[data-farm-view="1"] …` (farm).
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------- SpeechBubble (말풍선 pop-in) -------------------- */

interface SpeechBubbleProps {
  visible: boolean;
  children: ReactNode;
  side?: "top" | "bottom";
}

export function SpeechBubble({ visible, children, side = "top" }: SpeechBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: side === "top" ? 8 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 520, damping: 24 }}
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            [side]: side === "top" ? "auto" : "auto",
            top: side === "top" ? -10 : "auto",
            bottom: side === "bottom" ? -10 : "auto",
            background: "var(--text-primary)",
            color: "var(--bg-primary)",
            padding: "8px 14px",
            borderRadius: 16,
            fontSize: "var(--text-caption)",
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-md)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {children}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              [side === "top" ? "bottom" : "top"]: -5,
              transform: "translateX(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              background: "var(--text-primary)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------- Switch -------------------- */

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic("light");
        onChange(!checked);
      }}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        background: checked ? "var(--accent-carrot)" : "var(--border-medium)",
        position: "relative",
        transition: "background-color var(--dur-fast) var(--ease-smooth)",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 28 }}
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}

/* -------------------- Spinner CSS keyframe injection -------------------- */
/* (in tokens) */

export const __keyframes_spin = `
@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
`;
