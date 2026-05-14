/**
 * Phase 2 mock data — Phase 3 에서 Supabase 로 교체.
 * 화면이 빈약해보이지 않도록 합리적인 더미 값 제공.
 */

export interface DayStat {
  date: string; // YYYY-MM-DD
  weekday: string; // 월~일
  carrots: number;
  focusMinutes: number;
}

const TODAY = new Date();
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function daysAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

// 지난 7일치 데이터 (오늘 포함)
export const week7: DayStat[] = Array.from({ length: 7 }).map((_, i) => {
  const d = daysAgo(6 - i);
  // 약간의 패턴 — 주말은 낮음, 오늘은 진행 중
  const weekday = WEEKDAYS[d.getDay()];
  const isToday = i === 6;
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const carrots = isToday ? 3 : isWeekend ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 4);
  const focusMinutes = carrots * 25;
  return { date: fmt(d), weekday, carrots, focusMinutes };
});

export const todayStats = {
  carrots: 3,
  focusMinutes: 75,
  streakDays: 5,
  longestFocusMinutes: 50,
  // 오늘 목표 8개 중 진행 중인 비율 (Phase 4 에서 실시간 계산)
  progress: 3 / 8,
};

export const cumulativeFocus30d: { day: number; minutes: number }[] = Array.from({
  length: 30,
}).map((_, i) => ({
  day: i + 1,
  minutes: Math.round(40 + i * 3 + Math.sin(i / 2) * 18),
}));

export const TODAY_QUOTES = [
  "오늘은 누구 당근부터 훔쳐먹을까 흐흐 킥킥.",
  "한 입만... 아니 다 먹을 거야 사실.",
  "네 시간 내가 야금야금 먹어줄게.",
  "집중해, 내가 다 지켜보고 있으니까 흐흐.",
  "당근 한 개 = 25분. 약속이야 킥킥.",
];

export function pickQuote(seed = 0): string {
  return TODAY_QUOTES[seed % TODAY_QUOTES.length];
}

export function greetingForHour(hour: number): { line: string; bunny: "idle" | "focus" | "sleep" } {
  if (hour >= 5 && hour < 11)
    return { line: "흐흐, 일찍 일어났네. 당근 캐러 갈래?", bunny: "idle" };
  if (hour >= 11 && hour < 14)
    return { line: "점심엔 당근, 알지?", bunny: "focus" };
  if (hour >= 14 && hour < 18)
    return { line: "오후엔 내가 더 배고파져 킥킥.", bunny: "focus" };
  if (hour >= 18 && hour < 22)
    return { line: "저녁이다... 내 눈이 빛나는 시간.", bunny: "idle" };
  return { line: "밤이네. 너 졸리지? 그래도 한 판 더 가자.", bunny: "sleep" };
}

export function todayLabel(): string {
  const d = TODAY;
  const w = WEEKDAYS[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${w}요일`;
}
