/**
 * Phase 8.1 — 백색소음 player hook.
 *
 * - HTML5 Audio + loop + volume.
 * - lazy: 'none' 이거나 timer 가 idle 인 동안 fetch 하지 않는다.
 * - sound 변경 시 300ms fade out → swap → fade in.
 * - timer FOCUSING 진입 시 자동 재생, IDLE/PAUSED 진입 시 자동 일시정지 (with fade).
 * - tab visibility / autoplay 정책에 의해 play() 가 reject 되면 silently 무시.
 * - 60s licensed MP3 — `audio.loop=true` 로 native looping. 처리 파이프라인이
 *   더 이상 boundary 0.5s fade-in/fade-out 을 굽지 않으므로 (mp3 끝~시작이
 *   풀 진폭이라) 사용자에게 들리는 seam 은 없다. MP3 encoder padding 이 남길
 *   수 있는 ms 단위 gap 은 가청 임계 이하다. ended → 0 점프 fallback 만 유지.
 *
 * Reliability fixes (intermittent playback bug):
 * - Generation token: 매 play 요청에 token 부여, 비동기 promise 가 resolve 되었을 때
 *   token 이 stale 이거나 shouldPlay 가 더 이상 true 가 아니면 fade-in 을 중단한다.
 *   → fadeOut 이 새 play() 직후 들어와도 stale fade-in 이 되살아나지 않는다.
 * - First-gesture audio unlock: 사용자가 처음으로 클릭/탭/key 했을 때
 *   muted-empty Audio 한 번 play→pause 로 unlock. 이후 play() 가 user-gesture
 *   chain 밖에서 호출되어도 모바일/in-app webview 에서 차단되지 않는다.
 * - play() 직전에 readyState 가 부족하면 load() 를 명시적으로 호출.
 * - play() 가 reject 되면 한번 더 retry (load 후) — 같은 user activation 안에서
 *   가능한 만큼.
 *
 * Manual QA:
 * - Mobile Safari 에서 cold load → 3분 타이머 시작 → 화이트노이즈가 ~300ms fade-in
 *   하면서 들리는지.
 * - 시작 직후 빠르게 pause → 다시 시작을 5회 반복했을 때 항상 소리가 다시 재생되는지.
 * - 음원 변경 (드롭다운) 직후 즉시 timer 시작 → 새 src 로 재생되는지.
 * - 무음 선택 시 audio element 가 생성되지 않고 에러도 없어야 함.
 */

import { useEffect, useRef } from "react";
import { useTimerStore } from "../store/timerStore";
import { useSoundStore } from "../store/soundStore";
import { findSound, soundUrl } from "../data/sounds";

const FADE_MS = 300;

// 1x1 무음 wav (43 bytes) — autoplay unlock 용. 실제 fetch 없이 data URI 로 사용.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";

let audioUnlockArmed = false;
let audioUnlocked = false;

/**
 * 첫 user gesture 에서 muted Audio 한 번을 play→pause 로 unlock.
 * 이후 비동기 boundary 너머의 play() 도 모바일/webview 에서 차단되지 않는다.
 */
function armAudioUnlock() {
  if (audioUnlockArmed || typeof window === "undefined") return;
  audioUnlockArmed = true;
  const events: Array<keyof DocumentEventMap> = [
    "touchstart",
    "touchend",
    "mousedown",
    "click",
    "keydown",
  ];
  const unlock = () => {
    if (audioUnlocked) return;
    try {
      const a = new Audio();
      a.src = SILENT_WAV;
      a.muted = true;
      // playsInline 은 video 전용 표준이지만, iOS WKWebView 에서 audio 에도
      // 효과가 있어 setAttribute 로 안전하게 부여.
      a.setAttribute("playsinline", "true");
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          try {
            a.pause();
          } catch {
            /* ignore */
          }
          audioUnlocked = true;
        }).catch(() => {
          // 첫 시도 실패 — 다음 gesture 에서 재시도 가능.
          audioUnlockArmed = false;
        });
      } else {
        audioUnlocked = true;
      }
    } catch {
      audioUnlockArmed = false;
    } finally {
      events.forEach((e) => window.removeEventListener(e, unlock, true));
    }
  };
  events.forEach((e) =>
    window.addEventListener(e, unlock, { capture: true, passive: true }),
  );
}

export function useSoundPlayer() {
  const status = useTimerStore((s) => s.status);
  const currentSoundId = useSoundStore((s) => s.currentSoundId);
  const volume = useSoundStore((s) => s.volume);
  const setIsPlaying = useSoundStore((s) => s.setIsPlaying);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRafRef = useRef<number | null>(null);
  const desiredVolumeRef = useRef<number>(volume / 100);

  // play 요청 generation — 비동기 promise resolve 시점에 stale 여부 검사.
  const playGenRef = useRef(0);

  // 사용자가 의도하는 "재생되어야 하는가" — FOCUSING 동안 true.
  // PAUSED 도 페어 fade-out 으로 정지. COMPLETED/ABANDONED/IDLE → 정지.
  const shouldPlay = status === "FOCUSING";
  // 항상 최신값을 promise resolve 콜백에서 참조 가능하도록 ref 로도 보관.
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  // 기억할 마지막 src — change 감지용.
  const lastSrcRef = useRef<string | null>(null);

  // 마운트 시 user-gesture audio unlock listener 설치 (idempotent).
  useEffect(() => {
    armAudioUnlock();
  }, []);

  useEffect(() => {
    desiredVolumeRef.current = volume / 100;
    const el = audioRef.current;
    if (el && !el.paused && fadeRafRef.current === null) {
      // fade 중이 아닐 때만 즉시 적용 — fade 진행 중이면 fade target 이 새 값을 사용한다.
      el.volume = desiredVolumeRef.current;
    }
  }, [volume]);

  useEffect(() => {
    const sound = findSound(currentSoundId);
    const url = sound ? soundUrl(sound.file) : null;

    // 'none' 이거나 url 없음 → 기존 audio 정리.
    if (!url) {
      teardown();
      lastSrcRef.current = null;
      return;
    }

    // src 가 같다면 그대로, 아니면 swap (fade).
    if (lastSrcRef.current === url && audioRef.current) {
      // 재생 의도가 바뀌었을 수 있으니 sync.
      syncPlayback();
      return;
    }

    // 새 src — 기존이 있으면 fade out 후 src 교체.
    const swap = () => {
      const newAudio = new Audio();
      newAudio.src = url;
      // native loop — processed MP3 has no boundary fade-to-silence, so the
      // wraparound stays at full amplitude with no audible gap. We keep an
      // `ended` fallback for browsers that ignore `loop=true` on certain
      // sources (some mobile webviews after long-running playback).
      newAudio.loop = true;
      newAudio.preload = "auto";
      newAudio.volume = 0;
      newAudio.setAttribute("playsinline", "true");
      const onEnded = () => {
        try {
          newAudio.currentTime = 0;
          void newAudio.play().catch(() => {});
        } catch {
          /* ignore */
        }
      };
      newAudio.addEventListener("ended", onEnded);
      // load() 를 명시 호출 — preload="auto" 만으로는 일부 모바일에서 늦어진다.
      try {
        newAudio.load();
      } catch {
        /* ignore */
      }
      audioRef.current = newAudio;
      lastSrcRef.current = url;
      syncPlayback();
    };

    if (audioRef.current) {
      fadeOut(audioRef.current, () => {
        teardown();
        swap();
      });
    } else {
      swap();
    }

    return () => {
      // hook 자체 unmount 시에는 teardown.
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSoundId]);

  // status 변화에 따라 play/pause sync.
  useEffect(() => {
    syncPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function syncPlayback() {
    const el = audioRef.current;
    if (!el) {
      setIsPlaying(false);
      return;
    }
    // 어떤 분기로 가든 진행 중이던 fade 는 먼저 취소 — 이게 빠지면 stale fade 가
    // play() 직후 pause 를 호출해 silent 가 된다.
    cancelFade();
    if (shouldPlayRef.current) {
      const gen = ++playGenRef.current;
      // play() 가 첫 시도에서 reject 되면 load() 후 한번 더 시도.
      attemptPlay(el, gen, /* retry */ true);
    } else {
      if (!el.paused) fadeOut(el);
      setIsPlaying(false);
    }
  }

  function attemptPlay(el: HTMLAudioElement, gen: number, retry: boolean) {
    // 시작 볼륨은 0 — fade-in 으로 올림. play() 자체가 즉시 작동.
    try {
      el.volume = 0;
    } catch {
      /* ignore */
    }
    let p: Promise<void> | undefined;
    try {
      p = el.play();
    } catch (err) {
      handlePlayFailure(el, gen, retry, err);
      return;
    }
    if (!p || typeof (p as Promise<void>).then !== "function") {
      // 일부 구형 브라우저는 promise 를 반환하지 않음 — 곧바로 fade-in.
      if (gen === playGenRef.current && shouldPlayRef.current) {
        setIsPlaying(true);
        fadeIn(el);
      }
      return;
    }
    p.then(() => {
      // stale 검사: 더 새 요청이 들어왔거나, 더 이상 재생 의도가 없으면 무시.
      if (gen !== playGenRef.current || !shouldPlayRef.current) {
        // 의도 사라짐 → 조용히 일시정지 (fade 없이 — 이미 새 분기가 처리 중).
        if (gen !== playGenRef.current) return;
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        setIsPlaying(false);
        return;
      }
      setIsPlaying(true);
      fadeIn(el);
    }).catch((err) => handlePlayFailure(el, gen, retry, err));
  }

  function handlePlayFailure(
    el: HTMLAudioElement,
    gen: number,
    retry: boolean,
    err: unknown,
  ) {
    // stale 요청은 무시.
    if (gen !== playGenRef.current) return;
    if (retry && shouldPlayRef.current) {
      // 한번 더 — load() 후 즉시 재시도. 같은 user activation 안에 있으면 통과.
      try {
        el.load();
      } catch {
        /* ignore */
      }
      attemptPlay(el, gen, /* retry */ false);
      return;
    }
    setIsPlaying(false);
    if (import.meta.env.DEV) {
      // 프로덕션에서는 silent — 사용자에게는 무음으로 fallback.
      console.warn("[useSoundPlayer] play() rejected:", err);
    }
  }

  function fadeIn(el: HTMLAudioElement) {
    cancelFade();
    const startGen = playGenRef.current;
    const start = el.volume;
    const t0 = performance.now();
    const step = (now: number) => {
      // 도중에 새 요청이 들어왔거나 stop 의도가 되었으면 중단.
      if (startGen !== playGenRef.current || !shouldPlayRef.current) {
        fadeRafRef.current = null;
        return;
      }
      const target = desiredVolumeRef.current;
      const t = Math.min(1, (now - t0) / FADE_MS);
      try {
        el.volume = start + (target - start) * t;
      } catch {
        /* ignore */
      }
      if (t < 1) fadeRafRef.current = requestAnimationFrame(step);
      else fadeRafRef.current = null;
    };
    fadeRafRef.current = requestAnimationFrame(step);
  }

  function fadeOut(el: HTMLAudioElement, then?: () => void) {
    cancelFade();
    const start = el.volume;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / FADE_MS);
      try {
        el.volume = start * (1 - t);
      } catch {
        /* ignore */
      }
      if (t < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        fadeRafRef.current = null;
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        then?.();
      }
    };
    fadeRafRef.current = requestAnimationFrame(step);
  }

  function cancelFade() {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }

  function teardown() {
    cancelFade();
    // teardown 도 generation 을 무효화 — 진행 중이던 play() promise 는 무시된다.
    playGenRef.current++;
    const el = audioRef.current;
    if (el) {
      try {
        el.pause();
        el.src = "";
      } catch {
        /* ignore */
      }
    }
    audioRef.current = null;
    setIsPlaying(false);
  }
}
