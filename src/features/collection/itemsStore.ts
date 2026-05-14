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
  | "carrot_bag"
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
    code: "carrot_bag",
    ko: "당근 주머니",
    tab: "resources",
    iconRel: "assets/farm/items/item_bag.png",
    effect: "가방 자체 — 보유 종 개수만큼 헤더 뱃지에 표시",
    usable: false,
    acquisition: "기본 지급",
  },
  {
    code: "carrot_coin",
    ko: "당근 코인",
    tab: "resources",
    iconRel: "assets/farm/icons/icon_coin.png",
    effect: "보상함 토스포인트 환산 시각 표시",
    usable: false,
    acquisition: "수확/보상",
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
    effect: "미구현 — 차후 상점 화폐",
    usable: false,
    acquisition: "미구현",
  },
  {
    code: "heart",
    ko: "하트",
    tab: "collection",
    iconRel: "assets/farm/icons/icon_heart_hp.png",
    effect: "미구현 — 차후 친구 시스템",
    usable: false,
    acquisition: "미구현",
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
  add: (code: ItemCode, n?: number) => void;
  consume: (code: ItemCode, n?: number) => boolean;
  speciesOwned: () => number;
  reset: () => void;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  counts: loadCounts(),

  add: (code, n = 1) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const next = { ...get().counts };
    next[code] = (next[code] ?? 0) + Math.floor(n);
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
}));
