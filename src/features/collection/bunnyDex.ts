/**
 * Bunny Dex (PR-50) — 도감 100마리 풀 정의.
 *
 * `collectionData.CHARACTERS` / `SLOTS` 는 이미 100-slot 그리드 구조
 * 보유. 본 파일은 **확장된 dex metadata** — name / rarity / season /
 * theme / lore / iconRel 을 100개 모두 정의.
 *
 * 분포:
 *   - rarity: common 60 / rare 25 / sr 10 / legendary 5 = 100
 *   - season: spring 25 / summer 25 / autumn 25 / winter 25 = 100
 *
 * 자산 fallback: 실제 PNG asset 이 부재할 수 있음. UI 소비자는
 * iconRel 의 onError 로 silhouette fallback (PR-49 패턴 차용).
 *
 * 향후 wire: `collectionData.CHARACTERS` 와 통합 / 교체 시 본 dex 가
 * SoT 가 됨. 현 시점은 metadata-only 레이어.
 */

export type DexRarity = "common" | "rare" | "sr" | "legendary";
export type DexSeason = "spring" | "summer" | "autumn" | "winter";

export interface BunnyDexEntry {
  id: string;
  name: string;
  rarity: DexRarity;
  season: DexSeason;
  theme: string;
  iconRel: string;
  lore: string;
}

// ─── Helper to keep entries readable ────────────────────────────────
const e = (
  id: string,
  name: string,
  rarity: DexRarity,
  season: DexSeason,
  theme: string,
  lore: string,
  iconRel: string = `assets/farm/bunnies/${id}.png`,
): BunnyDexEntry => ({ id, name, rarity, season, theme, iconRel, lore });

export const BUNNY_DEX: readonly BunnyDexEntry[] = [
  // ── SPRING (25: common 15 / rare 6 / sr 3 / legendary 1) ───────
  e("kkomul-spring", "꼬물이", "common", "spring", "forest", "이른 봄 풀잎 사이에서 꼬물거리는 어린 토끼"),
  e("polljjak-spring", "폴짝이", "common", "spring", "farm", "처음 점프를 배워 신난 봄날 토끼"),
  e("dotori-spring", "도토리", "common", "spring", "forest", "지난 가을 묻어둔 도토리 꺼내러 온 토끼"),
  e("ssatdal-spring", "쌋달", "common", "spring", "farm", "당근밭 사이 달리기 좋아하는 토끼"),
  e("nadari-spring", "나달이", "common", "spring", "forest", "이파리 사이 햇살 좇는 부지런한 토끼"),
  e("bombi-spring", "봄비", "common", "spring", "water", "보슬비 좋아하는 촉촉한 털 토끼"),
  e("byeotsal-spring", "볕살이", "common", "spring", "sky", "햇살에 누워 낮잠 자는 토끼"),
  e("ipparam-spring", "잎바람", "common", "spring", "forest", "이파리 흔드는 바람에 귀가 펄럭이는 토끼"),
  e("morak-spring", "모락이", "common", "spring", "farm", "아지랑이 모락모락 피는 들판 토끼"),
  e("nasal-spring", "나살이", "common", "spring", "forest", "고운 봄날 풀을 처음 맛본 토끼"),
  e("ggotnit-spring", "꽃닢", "common", "spring", "forest", "꽃잎 위에서 잠드는 작은 토끼"),
  e("eorina-spring", "어리나", "common", "spring", "farm", "이름도 어린 봄날의 새 친구"),
  e("songgo-spring", "송고리", "common", "spring", "forest", "송홧가루 묻은 노란 코 토끼"),
  e("dolimi-spring", "도리미", "common", "spring", "farm", "도리도리 고개를 흔드는 토끼"),
  e("makdongi-spring", "막동이", "common", "spring", "farm", "막내라 응석부리는 가족 막내 토끼"),
  e("byeotchu-spring", "벗추기", "rare", "spring", "forest", "벚꽃 길에서 사진 찍는 인스타 토끼"),
  e("haenul-spring", "햇늘이", "rare", "spring", "sky", "햇살 따라다니며 그림자 사라지는 신비 토끼"),
  e("kotnae-spring", "꽃내음", "rare", "spring", "forest", "장미 향을 가진 향수 토끼"),
  e("nairmaeul-spring", "나리마을", "rare", "spring", "farm", "동네 토끼들의 이장님"),
  e("baramje-spring", "바람제", "rare", "spring", "sky", "바람을 마음대로 부르는 어린 도사"),
  e("biyahi-spring", "비야히", "rare", "spring", "water", "비가 오면 무지개를 끌고 오는 토끼"),
  e("yeongchun-spring", "영춘이", "sr", "spring", "magic", "영원한 봄을 가진 마을 수호 토끼"),
  e("buksaegk-spring", "북새기", "sr", "spring", "magic", "꽃을 피우는 손길의 정원사 토끼"),
  e("piriri-spring", "피리리", "rare", "spring", "magic", "버드나무 피리로 새들을 부르는 토끼"),
  e("sapphire-spring", "사파이어 토끼", "legendary", "spring", "myth", "전설의 봄 정령. 마을의 첫 새싹과 함께 깨어남"),

  // ── SUMMER (25: common 15 / rare 6 / sr 3 / legendary 1) ───────
  e("ttobang-summer", "또방이", "common", "summer", "water", "물웅덩이에서 또방또방 뛰는 토끼"),
  e("haengbyeong-summer", "햇병이", "common", "summer", "sky", "햇볕에 익은 작은 토끼"),
  e("isulchae-summer", "이슬채", "common", "summer", "forest", "아침 이슬 모으는 부지런이 토끼"),
  e("matami-summer", "맛아미", "common", "summer", "farm", "수박 즙 잘 짜는 토끼"),
  e("susuyeop-summer", "수수엽", "common", "summer", "farm", "수수밭에서 숨바꼭질하는 토끼"),
  e("naetga-summer", "냇가", "common", "summer", "water", "냇가에서 발 담그는 시원이 토끼"),
  e("baemmae-summer", "뱀매", "common", "summer", "forest", "여름 풀숲 무서워하지 않는 용감 토끼"),
  e("oraeya-summer", "오래야", "common", "summer", "farm", "오랫동안 햇살 받아 까매진 토끼"),
  e("paranmuldul-summer", "파란물들이", "common", "summer", "water", "물장난이 너무 신난 파란 토끼"),
  e("hwasong-summer", "화송이", "common", "summer", "farm", "화초 옆에 누워 자는 토끼"),
  e("kkwakbyeol-summer", "꽉별이", "common", "summer", "sky", "별이 가득한 밤하늘 좋아하는 토끼"),
  e("bidol-summer", "비돌이", "common", "summer", "water", "소나기에 몸 흔드는 신난 토끼"),
  e("doraji-summer", "도라지", "common", "summer", "forest", "보라색 도라지꽃 곁 토끼"),
  e("haengbok-summer", "행복이", "common", "summer", "farm", "여름밤 옥수수 익는 냄새 좋아하는 토끼"),
  e("sappal-summer", "삽팔이", "common", "summer", "farm", "팔뚝이 자랑인 일꾼 토끼"),
  e("seongryu-summer", "성류이", "rare", "summer", "water", "장맛비 그치면 무지개를 만드는 토끼"),
  e("baekha-summer", "백하", "rare", "summer", "sky", "흰 구름 위에 누워 자는 신비 토끼"),
  e("hyangbol-summer", "향볼이", "rare", "summer", "forest", "솔향 가득 안고 다니는 산속 토끼"),
  e("yongki-summer", "용기", "rare", "summer", "fire", "한여름 불꽃놀이에 가장 가까이 가는 토끼"),
  e("danjam-summer", "단잠이", "rare", "summer", "forest", "오후 낮잠 시간 만드는 도사 토끼"),
  e("hwawan-summer", "화완이", "rare", "summer", "fire", "장작불 옆 꾸벅이는 따뜻한 토끼"),
  e("baramnori-summer", "바람놀이", "legendary", "summer", "myth", "전설의 한여름 바람 정령. 큰 태풍을 잠재우는 수호자"),
  e("eolemmul-summer", "얼음물", "sr", "summer", "water", "얼음 마법으로 더위를 식히는 토끼"),
  e("muji-summer", "무지", "sr", "summer", "magic", "사라진 무지개를 다시 그리는 화가 토끼"),
  e("ruby-summer", "루비 토끼", "legendary", "summer", "myth", "전설의 여름 정령. 가장 뜨거운 한낮의 수호자"),

  // ── AUTUMN (25: common 15 / rare 6 / sr 3 / legendary 1) ───────
  e("anjo-autumn", "안조이", "common", "autumn", "forest", "낙엽 더미 위 안전제일 토끼"),
  e("dotori2-autumn", "도토리이", "common", "autumn", "forest", "겨우내 먹을 도토리 모으는 토끼"),
  e("danpung-autumn", "단풍이", "common", "autumn", "forest", "단풍잎 색깔 같은 털을 가진 토끼"),
  e("nakyeop-autumn", "낙엽이", "common", "autumn", "forest", "낙엽 위에서 미끄럼타는 토끼"),
  e("baramgi-autumn", "바람기", "common", "autumn", "sky", "가을바람에 귀가 펄럭이는 토끼"),
  e("seunjong-autumn", "선중이", "common", "autumn", "farm", "벼 베기 도와주는 부지런 토끼"),
  e("bomulbox-autumn", "보물박스", "common", "autumn", "farm", "겨울 식량을 차곡차곡 쌓는 토끼"),
  e("nuriut-autumn", "누리웃이", "common", "autumn", "forest", "잘 웃는 가을 한가운데 토끼"),
  e("ggomppi-autumn", "꼼피", "common", "autumn", "farm", "수확 끝나면 꼼지락대는 토끼"),
  e("hayang-autumn", "하양이", "common", "autumn", "forest", "단풍 사이 흰 털이 도드라지는 토끼"),
  e("dolmae-autumn", "돌매이", "common", "autumn", "forest", "돌멩이 모으는 수집가 토끼"),
  e("baramsori-autumn", "바람소리", "common", "autumn", "sky", "가을바람 소리에 귀 기울이는 토끼"),
  e("eobji-autumn", "엎지", "common", "autumn", "farm", "도토리 가득 모은 항아리 엎지른 토끼"),
  e("naebusan-autumn", "내부산", "common", "autumn", "fire", "낙엽 태우는 모닥불 옆 토끼"),
  e("ganggang-autumn", "강강이", "common", "autumn", "forest", "수확 축제 강강술래에 끼는 토끼"),
  e("hyang-autumn", "향이", "rare", "autumn", "forest", "솔잎 향수 잘 만드는 향수 토끼"),
  e("munja-autumn", "문자이", "rare", "autumn", "farm", "글자를 알아보는 똑똑이 토끼"),
  e("guno-autumn", "구노", "rare", "autumn", "fire", "모닥불 지키는 야간 경비 토끼"),
  e("eumak-autumn", "음악", "rare", "autumn", "forest", "단풍잎 부딪는 소리를 음악으로 연주하는 토끼"),
  e("jangsu-autumn", "장수", "rare", "autumn", "farm", "오래 살아 마을 어른 대접 받는 토끼"),
  e("seonbi-autumn", "선비", "rare", "autumn", "forest", "글공부 하다 잠드는 학자 토끼"),
  e("dansaek-autumn", "단색이", "sr", "autumn", "magic", "단풍 색을 바꿔주는 변색 마법사 토끼"),
  e("noeuldam-autumn", "노을담", "sr", "autumn", "sky", "노을빛을 병에 담아 파는 상인 토끼"),
  e("babomeori-autumn", "바보머리", "sr", "autumn", "magic", "기억 마법 도와주는 멍한 도사 토끼"),
  e("topaz-autumn", "토파즈 토끼", "legendary", "autumn", "myth", "전설의 가을 정령. 수확의 풍요를 부르는 수호자"),

  // ── WINTER (25: common 15 / rare 6 / sr 3 / legendary 1) ───────
  e("nunsei-winter", "눈세이", "common", "winter", "ice", "첫눈 오면 가장 먼저 뛰어나오는 토끼"),
  e("eorum-winter", "어름이", "common", "winter", "ice", "얼음판 위 미끄러져도 웃는 토끼"),
  e("nunsaram-winter", "눈사람", "common", "winter", "ice", "직접 만든 작은 눈사람 옆 토끼"),
  e("dombae-winter", "동배이", "common", "winter", "ice", "동백나무 아래 빨간 코 토끼"),
  e("mokdoli-winter", "목도리", "common", "winter", "ice", "긴 목도리 두른 멋쟁이 토끼"),
  e("sseonggeop-winter", "썽겁이", "common", "winter", "ice", "추워서 살짝 떨고 있는 토끼"),
  e("ttatteut-winter", "따뜻이", "common", "winter", "fire", "벽난로 옆 자리 차지한 토끼"),
  e("eollanim-winter", "얼라님", "common", "winter", "ice", "얼음 위 어린 토끼"),
  e("seollal-winter", "설랄이", "common", "winter", "farm", "설날 떡국 좋아하는 토끼"),
  e("jjingangae-winter", "찡깡이", "common", "winter", "ice", "콧등이 빨갛게 찡한 토끼"),
  e("haetsal-winter", "햇살이", "common", "winter", "sky", "겨울 햇살 좋아하는 토끼"),
  e("bokjori-winter", "복조리", "common", "winter", "farm", "복을 모으는 정월 토끼"),
  e("ssalbap-winter", "쌀밥", "common", "winter", "farm", "김 모락 쌀밥 옆 토끼"),
  e("milgam-winter", "밀감", "common", "winter", "farm", "겨울 귤 좋아하는 토끼"),
  e("hwaroh-winter", "화로이", "common", "winter", "fire", "화로 옆 손 녹이는 토끼"),
  e("nuncake-winter", "눈케이크", "rare", "winter", "ice", "눈으로 만든 케이크를 굽는 제빵 토끼"),
  e("eorumssa-winter", "얼음사", "rare", "winter", "ice", "얼음 조각으로 동상 만드는 조각가 토끼"),
  e("byeolbit-winter", "별빛", "rare", "winter", "sky", "별빛을 마시고 사는 신비 토끼"),
  e("santakclear-winter", "산타클리어", "rare", "winter", "farm", "산타 모자 쓴 선물 배달 토끼"),
  e("bukppung-winter", "북풍이", "rare", "winter", "ice", "북풍을 견디는 강인한 털 토끼"),
  e("dongji-winter", "동지", "rare", "winter", "fire", "팥죽 한 그릇 다 비우는 토끼"),
  e("seolun-winter", "설운이", "sr", "winter", "magic", "눈을 자유롭게 부리는 눈의 마법사 토끼"),
  e("eolumje-winter", "얼음제", "sr", "winter", "ice", "얼음 칼을 휘두르는 검사 토끼"),
  e("byeolja-winter", "별자리", "sr", "winter", "sky", "겨울 별자리를 자유롭게 그리는 천문 토끼"),
  e("diamond-winter", "다이아몬드 토끼", "legendary", "winter", "myth", "전설의 겨울 정령. 첫눈과 함께 강림하는 수호자"),
];

export function dexRarityCounts(): Record<DexRarity, number> {
  const out: Record<DexRarity, number> = {
    common: 0,
    rare: 0,
    sr: 0,
    legendary: 0,
  };
  for (const b of BUNNY_DEX) out[b.rarity]++;
  return out;
}

export function dexSeasonCounts(): Record<DexSeason, number> {
  const out: Record<DexSeason, number> = {
    spring: 0,
    summer: 0,
    autumn: 0,
    winter: 0,
  };
  for (const b of BUNNY_DEX) out[b.season]++;
  return out;
}

export const DEX_BY_ID: Record<string, BunnyDexEntry> = Object.fromEntries(
  BUNNY_DEX.map((b) => [b.id, b]),
);
