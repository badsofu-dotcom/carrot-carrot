/**
 * Items store — single source of truth for the 13-item inventory shown
 * in the bag modal. Lives in session memory + safeStorage (so non-zero
 * counts survive tab reload) and feeds:
 *   - InventoryModal grid count + locked overlay
 *   - Bag-button species-count badge in the farm header
 *   - Use-item hooks (hourglass / bolt / juice / soup / cake) — wired
 *     through `useItem(code)` which mirrors any side-effect into the
 *     existing stores (farmStore.seeds, toolStore, etc.).
 *
 * The Worker route `POST /items/use` is the canonical SoT once 0006
 * lands; until then the local store is what the UI reads.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import {
  countsFromRemote,
  loadInventory,
  useItemOnServer,
  type ItemsSyncResult,
} from "./itemsSync";

/**
 * The 13 inventory item codes shown in the bag, grouped by tab.
 * `resources` shows alongside the header chips (read-only). `tools`
 * are usable buffs. `collection` is keepsake currency (medals/stars).
 */
export type ItemCode =
  // resources
  | "carrot"
  | "candy"
  | "golden"
  | "carrot_coin"
  // tool items (usable)
  | "hourglass"
  | "bolt"
  | "juice"
  | "soup"
  | "cake"
  // collection (keepsake)
  | "medal"
  | "star"
  | "gem"
  | "heart";

export type ItemTab = "resources" | "tools" | "collection";

interface ItemDef {
  code: ItemCode;
  ko: string;
  tab: ItemTab;
  /** Public/asset path resolved via BASE_URL at render time. */
  iconRel: string;
  /** What does using/owning this item do? Used in IMPLEMENTATION_REPORT.md. */
  effect: string;
  /** True if `useItem(code)` does something — drives "사용" button on grid. */
  usable: boolean;
  /** Where the player gets it; surfaced as "획득 방법" copy when count===0. */
  acquisition: string;
  /**
   * Minimum stack size required to spend one charge of this item. The
   * "사용" button stays hidden until `count >= minToUse`. Default 1.
   * `gem` uses 5 (5 gems → +1 seed), `carrot_coin` 50 (PR-24 trade).
   */
  minToUse?: number;
  /**
   * Optional hard cap on the stack size (PR-24). `add()` clamps; the
   * cap is the only way to express a "max 3 hearts daily but can be
   * pushed to 5 via friend wave" pattern. Default unlimited.
   */
  maxStack?: number;
}

export const ITEMS: readonly ItemDef[] = [
  // resources
  {
    code: "carrot",
    ko: "당근",
    tab: "resources",
    iconRel: "assets/farm/currency/carrot.png",
    effect: "1 P (수확 시 자동 증가)",
    usable: false,
    acquisition: "수확",
  },
  {
    code: "candy",
    ko: "캔디 당근",
    tab: "resources",
    iconRel: "assets/farm/currency/candy_carrot.png",
    effect: "5 P (수확 가챠 4% 또는 콤보 12%)",
    usable: false,
    acquisition: "수확 가챠",
  },
  {
    code: "golden",
    ko: "황금 당근",
    tab: "resources",
    iconRel: "assets/farm/currency/golden_carrot.png",
    effect: "10 P (수확 가챠 1%)",
    usable: false,
    acquisition: "수확 가챠",
  },
  {
    code: "carrot_coin",
    ko: "당근 코인",
    tab: "resources",
    iconRel: "assets/farm/icons/icon_coin.png",
    // PR-24 — 광고 채널 보상 통화. 50 coin → 캔디 당근 1 교환.
    effect: "50개 사용 시 캔디 당근 1개",
    usable: true,
    minToUse: 50,
    acquisition: "광고 보상 (채널당 +5 coin)",
  },

  // tool items (usable)
  {
    code: "hourglass",
    ko: "모래시계",
    tab: "tools",
    iconRel: "assets/farm/icons/icon_timer.png",
    effect: "심은 작물 1단계 성장 (1회)",
    usable: true,
    acquisition: "주간 보물상자",
  },
  {
    code: "bolt",
    ko: "번개",
    tab: "tools",
    iconRel: "assets/farm/icons/icon_energy.png",
    effect: "물뿌리개 +3 충전 (1회)",
    usable: true,
    acquisition: "광고 보상",
  },
  {
    code: "juice",
    ko: "당근 주스",
    tab: "tools",
    iconRel: "assets/farm/foods/food_carrot_juice.png",
    effect: "다음 수확 캔디 확률 +5%p (1회, 다음 수확까지)",
    usable: true,
    acquisition: "오늘의 선물상자",
  },
  {
    code: "soup",
    ko: "당근 수프",
    tab: "tools",
    iconRel: "assets/farm/foods/food_carrot_soup.png",
    effect: "물뿌리개 사용 횟수 +1 (1회, 다음 충전까지)",
    usable: true,
    acquisition: "오늘의 선물상자",
  },
  {
    code: "cake",
    ko: "당근 케이크",
    tab: "tools",
    iconRel: "assets/farm/foods/food_carrot_cake.png",
    effect: "포커스 완료 시 씨앗 +1 (1회)",
    usable: true,
    acquisition: "오늘의 선물상자",
  },

  // collection
  {
    code: "medal",
    ko: "훈장",
    tab: "collection",
    iconRel: "assets/farm/rewards/medal_gold.png",
    effect: "도감/이정표 달성으로 적립",
    usable: false,
    acquisition: "이정표 달성",
  },
  {
    code: "star",
    ko: "별",
    tab: "collection",
    iconRel: "assets/farm/icons/icon_xp_star.png",
    effect: "100개 모으면 레전더리 토끼 1마리",
    usable: false,
    acquisition: "수확 가챠 / 보물상자",
  },
  {
    code: "gem",
    ko: "보석",
    tab: "collection",
    iconRel: "assets/farm/icons/icon_gem.png",
    effect: "5개 사용 시 씨앗 1개 추가",
    usable: true,
    acquisition: "오늘의 선물상자 (2% 확률)",
    minToUse: 5,
  },
  {
    code: "heart",
    ko: "하트",
    tab: "collection",
    iconRel: "assets/farm/icons/icon_heart_hp.png",
    // PR-24 — 광고 시청 토큰. KST 자정 리필 (현재 < 3 이면 3 으로
    // 채움, 이상이면 유지). 친구 wave +1 (cap 5). AdRewardChannel
    // claim 시 1 consume.
    effect: "광고 시청 토큰 (max 5, 자정 리필 3개)",
    usable: false,
    acquisition: "자정 리필 + 이웃 토끼 wave",
    maxStack: 5,
  },
];

const STORAGE_KEY = "cc.items.v1";

function loadCounts(): Record<ItemCode, number> {
  const raw = safeStorage.get(STORAGE_KEY);
  const blank = Object.fromEntries(ITEMS.map((i) => [i.code, 0])) as Record<
    ItemCode,
    number
  >;
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const c of Object.keys(blank) as ItemCode[]) {
        const v = parsed[c];
        if (typeof v === "number" && v >= 0) blank[c] = Math.floor(v);
      }
    }
  } catch {
    /* corrupted, reset */
  }
  return blank;
}

function saveCounts(counts: Record<ItemCode, number>) {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    /* ignore */
  }
}

interface ItemsState {
  counts: Record<ItemCode, number>;
  /** True once an initial hydrate attempt has resolved (ok or noop). */
  hydrated: boolean;
  /** KST day key (`YYYY-MM-DD`) for the last heart rollover (PR-24). */
  heartDayKey: string | null;
  add: (code: ItemCode, n?: number) => void;
  consume: (code: ItemCode, n?: number) => boolean;
  speciesOwned: () => number;
  reset: () => void;
  /**
   * Pull canonical inventory from the worker (`/items/inventory`).
   * No-op for guest/mock. Server is SoT for codes it returns; codes
   * absent from the response keep their local count (worker may not
   * yet persist every code — local pre-0006 inventory shouldn't get
   * zeroed).
   */
  hydrate: () => Promise<void>;
  /**
   * PR-24 — KST 자정 리필. heart count < HEART_DAILY_REFILL (3) 이면
   * HEART_DAILY_REFILL 로 bump. 이상이면 유지 (친구 wave 누적 보호).
   * 처음 호출 시 heartDayKey 비어 있으면 무조건 채움 (신규 사용자
   * 시작 3 hearts 보장). 동일 KST 일자 재호출은 no-op.
   */
  rolloverHeartsIfNeeded: () => void;
}

const STORAGE_KEY_HEART_DAY = "cc.items.heartDay.v1";
const HEART_DAILY_REFILL = 3;

function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function loadHeartDayKey(): string | null {
  return safeStorage.get(STORAGE_KEY_HEART_DAY);
}
function saveHeartDayKey(v: string) {
  try {
    safeStorage.set(STORAGE_KEY_HEART_DAY, v);
  } catch {
    /* ignore */
  }
}

const ITEM_CODES: readonly ItemCode[] = ITEMS.map((i) => i.code);

function applySingleRemote(
  set: (p: Partial<ItemsState>) => void,
  get: () => ItemsState,
  r: ItemsSyncResult,
) {
  if (!r.ok || r.mode !== "remote" || !("item" in r)) return;
  const code = r.item.code;
  if (!ITEM_CODES.includes(code as ItemCode)) return;
  const next = { ...get().counts };
  next[code as ItemCode] = Math.max(0, Math.floor(r.item.count));
  saveCounts(next);
  set({ counts: next });
}

const ITEM_BY_CODE: Record<ItemCode, (typeof ITEMS)[number]> =
  Object.fromEntries(ITEMS.map((i) => [i.code, i])) as Record<
    ItemCode,
    (typeof ITEMS)[number]
  >;

export const useItemsStore = create<ItemsState>((set, get) => ({
  counts: loadCounts(),
  hydrated: false,
  heartDayKey: loadHeartDayKey(),

  add: (code, n = 1) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const next = { ...get().counts };
    let nextCount = (next[code] ?? 0) + Math.floor(n);
    // PR-24 — per-item maxStack cap.
    const cap = ITEM_BY_CODE[code]?.maxStack;
    if (typeof cap === "number") nextCount = Math.min(nextCount, cap);
    next[code] = nextCount;
    saveCounts(next);
    set({ counts: next });
  },

  consume: (code, n = 1) => {
    const cur = get().counts[code] ?? 0;
    if (cur < n) return false;
    const next = { ...get().counts };
    next[code] = cur - Math.floor(n);
    saveCounts(next);
    set({ counts: next });
    // Mirror to server (fire-and-forget). For n>1 we issue n calls so
    // each consumption is auditable on the worker side. Today every
    // call site consumes 1, so this is usually a single POST.
    for (let i = 0; i < Math.floor(n); i++) {
      void useItemOnServer(code).then((r) => applySingleRemote(set, get, r));
    }
    return true;
  },

  speciesOwned: () => {
    let count = 0;
    for (const v of Object.values(get().counts)) if (v > 0) count++;
    return count;
  },

  reset: () => {
    const blank = Object.fromEntries(ITEMS.map((i) => [i.code, 0])) as Record<
      ItemCode,
      number
    >;
    saveCounts(blank);
    set({ counts: blank });
  },

  rolloverHeartsIfNeeded: () => {
    const today = kstDayKey();
    if (get().heartDayKey === today) return;
    // 신규 일자 — current < 3 이면 3 으로 채움. 이상이면 유지.
    const cur = get().counts.heart ?? 0;
    const next = { ...get().counts };
    if (cur < HEART_DAILY_REFILL) {
      next.heart = HEART_DAILY_REFILL;
      saveCounts(next);
      set({ counts: next, heartDayKey: today });
    } else {
      set({ heartDayKey: today });
    }
    saveHeartDayKey(today);
  },

  hydrate: async () => {
    const r = await loadInventory();
    if (r.ok && r.mode === "remote" && "inventory" in r) {
      const remote = countsFromRemote(r.inventory, ITEM_CODES);
      const next = { ...get().counts };
      for (const [code, count] of Object.entries(remote)) {
        if (typeof count === "number") {
          next[code as ItemCode] = Math.max(0, Math.floor(count));
        }
      }
      saveCounts(next);
      set({ counts: next });
    }
    set({ hydrated: true });
  },
}));
