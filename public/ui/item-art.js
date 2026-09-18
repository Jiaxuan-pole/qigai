// 物品像素图：每个可取得物品登记一种实体，而非用文字或符号代替。
const DARK = '#141a1f';
const LIGHT = '#e6dfcc';
const PAPER = '#d7cbb1';
const GOLD = '#e3bb72';
const BLUE = '#71bfc3';
const GREEN = '#9cbd83';
const RED = '#e57e6b';
const BROWN = '#9a6d45';
const TAN = '#c8945d';
const GRAY = '#819098';

const ART = Object.freeze({
  meal: ['bento'], bread: ['bread'], hot_soup: ['soup'], tea: ['tea'], coffee: ['coffee'], espresso: ['espresso'], americano: ['americano'], latte: ['latte'], cappuccino: ['cappuccino'], mocha: ['mocha'], cold_brew: ['coldBrew'], soda: ['can'], cigarette: ['cigarettes'], cigarette_regular: ['cigarettesRegular'], cigarette_premium: ['cigarettesPremium'], lighter: ['lighter'], beer: ['beer'], beer_bottle: ['beerBottle'], spirit: ['bottle'], baijiu: ['baijiu'], vodka: ['vodka'],
  soap: ['soap'], towel: ['towel'], wipes: ['wipes'], toothbrush: ['toothbrush'], toothpaste: ['toothpaste'], detergent: ['detergent'], socks: ['socks'], clean_clothes: ['clothes'], trash_bag: ['bag'], rain_cover: ['cover'],
  bandage: ['bandage'], cleaning_care: ['careKit'], rehydration: ['rehydration'], symptom_relief: ['relief'], care_course: ['careCourse'], thermometer: ['thermometer'],
  paper_set: ['paperSet'], paint: ['paint'], cards: ['cards'], headphones: ['headphones'], keyboard: ['keyboard'], electronic_part: ['part'], tape: ['tape'], ticket: ['ticket'], ticket_10: ['ticket10'], ticket_20: ['ticket20'], bath_service: ['bath'], clinical_visit: ['clinic'], shoes: ['shoes'], blanket: ['blanket'], camera: ['camera'], underwear: ['underwear'],
  fishing_rod_simple: ['rodSimple'], fishing_rod: ['rodNormal'], fishing_rod_pro: ['rodPro'], fish_bait: ['bait'], fish_common: ['fishCommon'], fish_rare: ['fishRare'], fish_common_cooked: ['fishCommonCooked'], fish_rare_cooked: ['fishRareCooked'], meal_hot: ['mealHot'], bread_toasted: ['breadToasted'], hot_soup_heated: ['soupHeated'], charcoal_cheap: ['charcoalCheap'], charcoal_quality: ['charcoalQuality'], charcoal_smokeless: ['charcoalSmokeless'],
  broken_phone: ['brokenPhone'], broken_radio: ['brokenRadio'], broken_headphones: ['brokenHeadphones'], broken_tv: ['brokenTv'], phone: ['phone'], radio: ['radio'], tv: ['tv'], gloves: ['gloves'], toolkit: ['toolkit'], cart: ['cart'], studio_pass: ['studioPass'], thermos: ['thermos'], promo_video: ['video'], butts: ['butts'], old_camera: ['oldCamera'], old_computer: ['computer'],
  bed_basic: ['bedBasic'], bed_comfort: ['bedComfort'], legacy_bed: ['legacyBed'], dining_table: ['diningTable'], chair: ['chair'], sofa: ['sofa'], cabinet: ['cabinet'], lamp: ['lamp'], rug: ['rug'],
});

export const itemArtIds = Object.freeze(Object.keys(ART));

export function missingItemArtIds(ids) {
  return ids.filter((id) => !ART[id]);
}

export function itemArtMarkup(id) {
  return `<canvas class="item-art" width="32" height="32" data-item-art="${id}" aria-hidden="true"></canvas>`;
}

const rect = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
const line = (c, color, x, y, w, h) => rect(c, color, x, y, w, h);
const frame = (c, color = DARK) => { rect(c, color, 6, 6, 20, 20); };
const shine = (c, color = LIGHT) => { rect(c, color, 9, 9, 4, 3); rect(c, color, 13, 8, 7, 2); };
const fish = (c, body, fin, rare) => { rect(c, DARK, 6, 13, 17, 8); rect(c, body, 8, 12, 13, 10); rect(c, fin, 22, 14, 5, 6); rect(c, fin, 4, 15, 4, 4); rect(c, LIGHT, 10, 14, 2, 2); rect(c, DARK, 11, 15, 1, 1); if (rare) { rect(c, GOLD, 15, 13, 2, 2); rect(c, GOLD, 18, 18, 2, 2); } else rect(c, BLUE, 16, 18, 4, 1); };
const rod = (c, shaft, grip, reel) => { rect(c, DARK, 4, 4, 4, 24); rect(c, shaft, 6, 4, 2, 21); rect(c, grip, 5, 24, 5, 5); rect(c, LIGHT, 24, 4, 3, 2); if (reel) { rect(c, DARK, 10, 19, 7, 7); rect(c, reel, 11, 20, 5, 5); rect(c, GOLD, 12, 21, 2, 2); } };
const device = (c, body, screen, buttons = true) => { frame(c); rect(c, body, 8, 8, 16, 16); rect(c, screen, 10, 10, 12, 8); if (buttons) { rect(c, DARK, 11, 20, 2, 2); rect(c, DARK, 16, 20, 2, 2); rect(c, DARK, 21, 20, 1, 2); } };
const pack = (c, body, label, band = DARK) => { frame(c); rect(c, body, 8, 8, 16, 16); rect(c, band, 8, 11, 16, 3); rect(c, label, 13, 16, 6, 5); };

export function drawItemArt(canvas, id) {
  const c = canvas?.getContext?.('2d');
  if (!c) return false;
  if (canvas.width !== 32) canvas.width = 32;
  if (canvas.height !== 32) canvas.height = 32;
  c.clearRect?.(0, 0, 32, 32);
  const kind = ART[id]?.[0] || 'unknown';
  if (kind === 'bento') { frame(c); rect(c, RED, 8, 9, 16, 13); rect(c, PAPER, 10, 10, 7, 5); rect(c, GREEN, 18, 10, 4, 5); rect(c, GOLD, 10, 17, 10, 3); }
  else if (kind === 'bread') { rect(c, DARK, 6, 11, 20, 12); rect(c, TAN, 8, 10, 16, 13); rect(c, GOLD, 10, 9, 9, 3); rect(c, PAPER, 12, 14, 8, 2); }
  else if (kind === 'soup') { rect(c, DARK, 7, 14, 18, 9); rect(c, RED, 9, 15, 14, 6); rect(c, GOLD, 10, 13, 12, 3); rect(c, LIGHT, 11, 7, 2, 5); rect(c, LIGHT, 17, 6, 2, 6); }
  else if (kind === 'tea') { pack(c, GREEN, PAPER); rect(c, GOLD, 14, 20, 4, 4); }
  else if (kind === 'coffee') { pack(c, BROWN, GOLD); rect(c, LIGHT, 19, 16, 2, 3); }
  else if (kind === 'espresso') { rect(c, DARK, 8, 15, 17, 10); rect(c, PAPER, 10, 17, 12, 6); rect(c, DARK, 22, 17, 5, 5); rect(c, '#402719', 11, 15, 10, 3); rect(c, GOLD, 13, 15, 5, 1); rect(c, PAPER, 7, 25, 21, 2); }
  else if (kind === 'americano') { rect(c, DARK, 7, 10, 18, 17); rect(c, PAPER, 9, 12, 13, 13); rect(c, DARK, 23, 13, 5, 10); rect(c, PAPER, 25, 16, 2, 4); rect(c, '#301e18', 10, 11, 11, 4); rect(c, '#795135', 12, 13, 7, 1); }
  else if (kind === 'latte') { rect(c, DARK, 9, 8, 16, 20); rect(c, '#c7d2ce', 11, 10, 12, 16); rect(c, '#8b5c3a', 12, 17, 10, 8); rect(c, '#efdcba', 12, 12, 10, 7); rect(c, PAPER, 14, 10, 6, 4); rect(c, LIGHT, 11, 27, 13, 2); }
  else if (kind === 'cappuccino') { rect(c, DARK, 7, 14, 19, 12); rect(c, PAPER, 9, 16, 15, 8); rect(c, DARK, 25, 17, 4, 6); rect(c, '#f4e3c4', 10, 11, 13, 6); rect(c, LIGHT, 13, 8, 8, 5); rect(c, '#9e6941', 15, 14, 4, 2); rect(c, PAPER, 7, 26, 22, 2); }
  else if (kind === 'mocha') { rect(c, DARK, 8, 9, 18, 18); rect(c, '#efe3cc', 10, 11, 14, 14); rect(c, '#593827', 11, 16, 12, 8); rect(c, '#d2ad88', 12, 12, 10, 5); rect(c, '#543021', 12, 10, 2, 3); rect(c, '#543021', 17, 11, 3, 2); rect(c, '#543021', 22, 10, 2, 4); rect(c, PAPER, 7, 27, 21, 2); }
  else if (kind === 'coldBrew') { rect(c, DARK, 10, 7, 16, 22); rect(c, '#a6cbd1', 12, 9, 12, 18); rect(c, '#5b4235', 13, 14, 10, 12); rect(c, '#d6e8e5', 13, 12, 4, 4); rect(c, '#d6e8e5', 19, 18, 4, 4); rect(c, '#b6d9d8', 17, 4, 2, 10); rect(c, LIGHT, 11, 27, 14, 2); }
  else if (kind === 'can' || kind === 'beer') { frame(c); rect(c, kind === 'beer' ? '#bf9344' : BLUE, 10, 7, 12, 18); rect(c, LIGHT, 11, 8, 10, 2); rect(c, kind === 'beer' ? GOLD : '#487f9a', 12, 15, 8, 6); }
  else if (kind === 'cigarettes') { pack(c, PAPER, RED); rect(c, LIGHT, 10, 5, 2, 5); rect(c, LIGHT, 16, 5, 2, 5); rect(c, LIGHT, 22, 5, 2, 5); }
  else if (kind === 'cigarettesRegular') { pack(c, BLUE, PAPER, DARK); rect(c, LIGHT, 8, 7, 16, 3); rect(c, DARK, 9, 8, 14, 1); rect(c, GOLD, 13, 16, 6, 2); }
  else if (kind === 'cigarettesPremium') { pack(c, '#4b3f63', GOLD, '#2b2638'); rect(c, GOLD, 7, 7, 18, 2); rect(c, GOLD, 10, 5, 12, 2); rect(c, PAPER, 15, 15, 2, 7); }
  else if (kind === 'beerBottle') { rect(c, DARK, 11, 6, 10, 20); rect(c, BROWN, 13, 7, 6, 17); rect(c, GOLD, 11, 5, 10, 3); rect(c, PAPER, 12, 15, 8, 5); }
  else if (kind === 'baijiu') { rect(c, DARK, 10, 7, 12, 19); rect(c, PAPER, 12, 9, 8, 14); rect(c, RED, 12, 16, 8, 4); rect(c, DARK, 13, 5, 6, 3); }
  else if (kind === 'vodka') { rect(c, DARK, 10, 10, 12, 16); rect(c, '#d7eaf0', 12, 11, 8, 13); rect(c, DARK, 13, 3, 6, 9); rect(c, '#d7eaf0', 14, 5, 4, 6); rect(c, BLUE, 12, 18, 8, 3); rect(c, LIGHT, 14, 12, 2, 5); }
  else if (kind === 'lighter') { rect(c, DARK, 10, 8, 12, 18); rect(c, RED, 12, 10, 8, 14); rect(c, GRAY, 13, 6, 6, 4); rect(c, GOLD, 15, 3, 2, 3); }
  else if (kind === 'bottle') { rect(c, DARK, 11, 5, 10, 21); rect(c, '#845a75', 13, 9, 6, 14); rect(c, PAPER, 14, 5, 4, 4); rect(c, GOLD, 14, 14, 4, 4); }
  else if (kind === 'soap') { rect(c, DARK, 7, 12, 18, 11); rect(c, BLUE, 9, 13, 14, 8); shine(c); }
  else if (kind === 'towel' || kind === 'blanket') { rect(c, DARK, 6, 8, 20, 17); rect(c, kind === 'towel' ? BLUE : '#8b7d9b', 8, 10, 16, 13); line(c, LIGHT, 9, 12, 14, 2); line(c, DARK, 9, 18, 14, 1); }
  else if (kind === 'wipes') { pack(c, BLUE, LIGHT); rect(c, PAPER, 15, 6, 3, 4); }
  else if (kind === 'toothbrush') { rect(c, DARK, 5, 18, 22, 4); rect(c, BLUE, 7, 18, 16, 2); rect(c, LIGHT, 23, 15, 4, 5); }
  else if (kind === 'toothpaste') { rect(c, DARK, 7, 11, 19, 10); rect(c, LIGHT, 9, 13, 13, 6); rect(c, BLUE, 12, 14, 7, 2); rect(c, GRAY, 23, 13, 3, 6); }
  else if (kind === 'detergent') { rect(c, DARK, 9, 7, 14, 19); rect(c, BLUE, 11, 10, 10, 14); rect(c, LIGHT, 13, 6, 6, 4); rect(c, PAPER, 13, 15, 6, 5); }
  else if (kind === 'socks') { rect(c, DARK, 9, 7, 7, 16); rect(c, PAPER, 11, 9, 3, 11); rect(c, DARK, 15, 18, 8, 6); rect(c, RED, 17, 20, 4, 2); }
  else if (kind === 'clothes' || kind === 'underwear') { rect(c, DARK, 7, 8, 18, 17); rect(c, kind === 'clothes' ? GREEN : RED, 10, 10, 12, 13); rect(c, kind === 'clothes' ? GREEN : RED, 7, 11, 4, 7); rect(c, kind === 'clothes' ? GREEN : RED, 21, 11, 4, 7); rect(c, LIGHT, 14, 9, 4, 3); }
  else if (kind === 'bag') { rect(c, DARK, 8, 9, 16, 17); rect(c, '#596e78', 10, 12, 12, 12); rect(c, LIGHT, 12, 8, 8, 4); rect(c, DARK, 14, 16, 6, 2); }
  else if (kind === 'cover') { rect(c, DARK, 6, 8, 20, 16); rect(c, '#507e97', 8, 10, 16, 12); line(c, LIGHT, 10, 12, 12, 2); line(c, BLUE, 12, 15, 8, 5); }
  else if (kind === 'bandage') { rect(c, PAPER, 6, 13, 20, 7); rect(c, RED, 13, 10, 6, 13); rect(c, PAPER, 10, 14, 12, 5); }
  else if (kind === 'careKit') { pack(c, LIGHT, RED); rect(c, RED, 14, 14, 4, 8); rect(c, RED, 12, 16, 8, 4); }
  else if (kind === 'rehydration') { rect(c, DARK, 11, 6, 11, 20); rect(c, BLUE, 13, 10, 7, 13); rect(c, LIGHT, 14, 6, 5, 4); rect(c, PAPER, 14, 15, 5, 4); }
  else if (kind === 'relief') { pack(c, RED, PAPER); rect(c, LIGHT, 14, 15, 4, 5); }
  else if (kind === 'careCourse') { rect(c, DARK, 8, 6, 16, 20); rect(c, PAPER, 10, 8, 12, 16); rect(c, RED, 12, 11, 8, 2); rect(c, BLUE, 12, 16, 8, 2); }
  else if (kind === 'thermometer') { rect(c, DARK, 14, 5, 5, 20); rect(c, LIGHT, 15, 7, 2, 13); rect(c, RED, 15, 14, 2, 7); rect(c, RED, 12, 21, 8, 6); }
  else if (kind === 'paperSet') { rect(c, DARK, 7, 7, 16, 19); rect(c, PAPER, 9, 9, 12, 15); rect(c, BLUE, 12, 12, 7, 2); rect(c, RED, 12, 17, 5, 2); rect(c, DARK, 21, 5, 3, 18); }
  else if (kind === 'paint') { rect(c, DARK, 7, 8, 18, 17); rect(c, TAN, 9, 10, 14, 13); rect(c, RED, 11, 12, 3, 3); rect(c, BLUE, 17, 12, 3, 3); rect(c, GREEN, 14, 18, 3, 3); }
  else if (kind === 'cards') { rect(c, DARK, 7, 7, 14, 19); rect(c, PAPER, 9, 9, 10, 15); rect(c, RED, 12, 12, 4, 5); rect(c, DARK, 14, 5, 11, 18); }
  else if (kind === 'headphones' || kind === 'brokenHeadphones') { rect(c, DARK, 7, 8, 18, 16); rect(c, kind === 'brokenHeadphones' ? GRAY : BLUE, 10, 9, 12, 4); rect(c, DARK, 8, 16, 5, 8); rect(c, DARK, 20, 16, 5, 8); rect(c, RED, 20, 20, kind === 'brokenHeadphones' ? 4 : 0, 2); }
  else if (kind === 'keyboard') { rect(c, DARK, 5, 11, 22, 13); rect(c, GRAY, 7, 13, 18, 8); for (let x = 8; x < 24; x += 4) line(c, LIGHT, x, 14, 2, 2); }
  else if (kind === 'part') { rect(c, DARK, 8, 8, 16, 16); rect(c, GRAY, 11, 11, 10, 10); rect(c, GOLD, 14, 7, 4, 18); rect(c, GOLD, 7, 14, 18, 4); }
  else if (kind === 'tape') { rect(c, DARK, 7, 9, 18, 16); rect(c, GOLD, 9, 11, 14, 12); rect(c, DARK, 13, 14, 6, 6); rect(c, PAPER, 14, 15, 4, 4); }
  else if (kind === 'ticket') { rect(c, DARK, 6, 10, 20, 13); rect(c, RED, 8, 12, 16, 9); rect(c, GOLD, 10, 14, 4, 5); rect(c, PAPER, 16, 14, 5, 2); }
  else if (kind === 'ticket10') { rect(c, GOLD, 5, 9, 22, 15); rect(c, BROWN, 7, 11, 18, 11); rect(c, PAPER, 9, 13, 14, 7); rect(c, GOLD, 11, 15, 3, 3); rect(c, GOLD, 18, 15, 3, 3); }
  else if (kind === 'ticket20') { rect(c, BLUE, 4, 8, 24, 17); rect(c, DARK, 6, 10, 20, 13); rect(c, '#dfe8ea', 8, 12, 16, 9); rect(c, BLUE, 10, 14, 4, 5); rect(c, BLUE, 17, 14, 5, 2); }
  else if (kind === 'bath') { rect(c, DARK, 7, 13, 18, 11); rect(c, BLUE, 9, 15, 14, 7); rect(c, LIGHT, 10, 10, 2, 3); rect(c, LIGHT, 16, 7, 2, 6); rect(c, LIGHT, 21, 10, 2, 3); }
  else if (kind === 'clinic') { rect(c, DARK, 8, 7, 16, 19); rect(c, LIGHT, 10, 9, 12, 15); rect(c, RED, 14, 12, 4, 8); rect(c, RED, 12, 14, 8, 4); }
  else if (kind === 'shoes') { rect(c, DARK, 6, 17, 20, 9); rect(c, BROWN, 8, 18, 11, 5); rect(c, TAN, 18, 21, 6, 2); rect(c, LIGHT, 9, 16, 6, 2); }
  else if (kind === 'camera' || kind === 'oldCamera') { device(c, kind === 'oldCamera' ? GRAY : '#435562', BLUE, false); rect(c, DARK, 13, 12, 7, 7); rect(c, LIGHT, 15, 14, 3, 3); rect(c, RED, 9, 9, 3, 3); }
  else if (kind === 'rodSimple') rod(c, TAN, BROWN, null);
  else if (kind === 'rodNormal') rod(c, BLUE, DARK, GRAY);
  else if (kind === 'rodPro') { rod(c, '#d6ad45', '#384958', RED); rect(c, LIGHT, 7, 7, 2, 5); }
  else if (kind === 'bait') { pack(c, BROWN, GREEN); rect(c, GOLD, 10, 18, 2, 2); rect(c, GOLD, 19, 17, 2, 2); }
  else if (kind === 'fishCommon') fish(c, '#5c94a2', '#3d6878', false);
  else if (kind === 'fishRare') fish(c, '#b87558', '#7b4e78', true);
  else if (kind === 'fishCommonCooked') { fish(c, '#b87545', '#75462f', false); rect(c, BROWN, 4, 23, 24, 2); rect(c, GOLD, 13, 14, 2, 6); rect(c, GOLD, 18, 14, 2, 6); rect(c, LIGHT, 9, 7, 2, 4); rect(c, LIGHT, 17, 5, 2, 5); }
  else if (kind === 'fishRareCooked') { fish(c, '#d29b54', '#8f5538', true); rect(c, BROWN, 4, 23, 24, 2); rect(c, RED, 13, 14, 2, 6); rect(c, RED, 18, 14, 2, 6); rect(c, LIGHT, 9, 7, 2, 4); rect(c, LIGHT, 17, 5, 2, 5); }
  else if (kind === 'mealHot') { frame(c); rect(c, BROWN, 8, 10, 16, 13); rect(c, GOLD, 10, 12, 7, 5); rect(c, GREEN, 18, 12, 4, 5); rect(c, RED, 10, 19, 12, 2); rect(c, LIGHT, 11, 5, 2, 5); rect(c, LIGHT, 18, 6, 2, 4); }
  else if (kind === 'breadToasted') { rect(c, DARK, 6, 11, 20, 12); rect(c, BROWN, 8, 10, 16, 13); rect(c, TAN, 10, 9, 9, 3); rect(c, GOLD, 11, 14, 8, 2); rect(c, DARK, 12, 18, 8, 1); rect(c, LIGHT, 9, 6, 2, 4); }
  else if (kind === 'soupHeated') { rect(c, DARK, 7, 14, 18, 10); rect(c, BROWN, 9, 15, 14, 7); rect(c, GOLD, 10, 13, 12, 3); rect(c, LIGHT, 11, 7, 2, 5); rect(c, LIGHT, 17, 5, 2, 6); rect(c, RED, 14, 16, 3, 3); rect(c, PAPER, 6, 17, 2, 4); }
  else if (kind === 'charcoalCheap') { rect(c, DARK, 6, 10, 20, 15); rect(c, '#24272a', 8, 12, 16, 11); rect(c, '#0b0d0f', 10, 15, 5, 4); rect(c, '#3d4142', 17, 13, 4, 5); rect(c, '#121517', 19, 19, 4, 3); rect(c, '#545250', 8, 21, 5, 2); rect(c, BROWN, 11, 8, 10, 2); }
  else if (kind === 'charcoalQuality') { rect(c, DARK, 6, 9, 20, 16); rect(c, BROWN, 8, 11, 16, 12); rect(c, TAN, 9, 12, 14, 2); rect(c, '#2c3232', 10, 16, 5, 4); rect(c, '#2c3232', 17, 16, 5, 4); rect(c, '#515a58', 10, 20, 5, 2); rect(c, '#515a58', 17, 20, 5, 2); rect(c, GOLD, 11, 7, 10, 2); }
  else if (kind === 'charcoalSmokeless') { frame(c); rect(c, '#b9c6bf', 8, 8, 16, 16); rect(c, '#d4ddd5', 10, 10, 12, 4); rect(c, GREEN, 10, 16, 12, 6); rect(c, LIGHT, 13, 17, 6, 2); rect(c, '#6f8279', 13, 20, 6, 1); rect(c, '#65716e', 8, 24, 16, 2); }
  else if (kind === 'brokenPhone' || kind === 'phone') { device(c, kind === 'phone' ? '#3c5665' : GRAY, BLUE, false); rect(c, kind === 'brokenPhone' ? RED : LIGHT, 12, 14, 8, 1); }
  else if (kind === 'brokenRadio' || kind === 'radio') { device(c, kind === 'radio' ? BROWN : GRAY, GOLD, false); rect(c, DARK, 11, 14, 5, 5); rect(c, DARK, 18, 14, 3, 3); rect(c, kind === 'brokenRadio' ? RED : LIGHT, 10, 7, 10, 1); }
  else if (kind === 'brokenTv' || kind === 'tv') { rect(c, DARK, 5, 7, 22, 17); rect(c, kind === 'tv' ? '#435562' : GRAY, 7, 9, 18, 12); rect(c, kind === 'brokenTv' ? RED : BLUE, 9, 11, 14, 8); rect(c, DARK, 10, 24, 3, 3); rect(c, DARK, 20, 24, 3, 3); }
  else if (kind === 'gloves') { rect(c, DARK, 8, 9, 7, 16); rect(c, GOLD, 10, 11, 3, 11); rect(c, DARK, 17, 8, 7, 17); rect(c, GOLD, 19, 10, 3, 12); }
  else if (kind === 'toolkit') { frame(c, DARK); rect(c, BROWN, 8, 13, 16, 11); rect(c, TAN, 12, 9, 8, 5); rect(c, LIGHT, 11, 17, 10, 2); }
  else if (kind === 'cart') { rect(c, DARK, 7, 8, 4, 16); rect(c, BROWN, 10, 12, 14, 10); rect(c, GRAY, 12, 22, 4, 4); rect(c, GRAY, 20, 22, 4, 4); }
  else if (kind === 'studioPass') { rect(c, DARK, 8, 7, 16, 19); rect(c, '#8a6f99', 10, 9, 12, 15); rect(c, PAPER, 13, 12, 6, 7); }
  else if (kind === 'thermos') { rect(c, DARK, 11, 6, 10, 20); rect(c, RED, 13, 9, 6, 14); rect(c, LIGHT, 14, 6, 4, 3); rect(c, GOLD, 13, 15, 6, 2); }
  else if (kind === 'video') { device(c, '#3b4f59', BLUE, false); rect(c, RED, 15, 12, 4, 7); }
  else if (kind === 'butts') { rect(c, PAPER, 7, 15, 14, 3); rect(c, RED, 19, 15, 3, 3); rect(c, PAPER, 11, 21, 12, 3); rect(c, BROWN, 20, 21, 3, 3); }
  else if (kind === 'computer') { rect(c, DARK, 6, 7, 20, 14); rect(c, GRAY, 8, 9, 16, 10); rect(c, BLUE, 10, 11, 12, 6); rect(c, DARK, 4, 21, 24, 4); }
  else if (kind === 'bedBasic') { rect(c, DARK, 3, 11, 26, 14); rect(c, BROWN, 4, 12, 24, 11); rect(c, PAPER, 6, 13, 7, 5); rect(c, BLUE, 14, 13, 12, 8); rect(c, DARK, 5, 25, 3, 3); rect(c, DARK, 24, 25, 3, 3); }
  else if (kind === 'bedComfort') { rect(c, DARK, 3, 8, 26, 18); rect(c, TAN, 4, 9, 24, 16); rect(c, LIGHT, 6, 11, 8, 6); rect(c, RED, 15, 11, 11, 12); rect(c, GOLD, 15, 11, 11, 3); rect(c, DARK, 5, 26, 3, 2); rect(c, DARK, 24, 26, 3, 2); }
  else if (kind === 'legacyBed') { rect(c, DARK, 4, 13, 24, 11); rect(c, GRAY, 5, 14, 22, 8); rect(c, PAPER, 6, 15, 6, 4); rect(c, GREEN, 13, 15, 12, 5); rect(c, BROWN, 4, 24, 3, 4); rect(c, BROWN, 25, 24, 3, 4); }
  else if (kind === 'diningTable') { rect(c, DARK, 4, 11, 24, 7); rect(c, TAN, 6, 12, 20, 4); rect(c, BROWN, 7, 18, 4, 9); rect(c, BROWN, 22, 18, 4, 9); rect(c, PAPER, 13, 9, 7, 3); }
  else if (kind === 'chair') { rect(c, DARK, 8, 6, 5, 17); rect(c, BROWN, 9, 7, 3, 13); rect(c, DARK, 10, 20, 16, 5); rect(c, TAN, 12, 21, 12, 3); rect(c, BROWN, 11, 25, 3, 4); rect(c, BROWN, 22, 25, 3, 4); }
  else if (kind === 'sofa') { rect(c, DARK, 3, 9, 26, 17); rect(c, '#8a626f', 5, 11, 22, 13); rect(c, RED, 7, 15, 18, 7); rect(c, PAPER, 14, 15, 5, 5); rect(c, BROWN, 5, 26, 4, 2); rect(c, BROWN, 23, 26, 4, 2); }
  else if (kind === 'cabinet') { rect(c, DARK, 7, 4, 18, 24); rect(c, BROWN, 9, 6, 14, 20); rect(c, TAN, 10, 7, 12, 8); rect(c, TAN, 10, 17, 12, 8); rect(c, GOLD, 17, 13, 2, 2); rect(c, GOLD, 17, 23, 2, 2); }
  else if (kind === 'lamp') { rect(c, GOLD, 12, 4, 8, 5); rect(c, PAPER, 9, 9, 14, 9); rect(c, DARK, 11, 18, 10, 2); rect(c, GRAY, 15, 20, 2, 8); rect(c, DARK, 10, 28, 12, 2); }
  else if (kind === 'rug') { rect(c, DARK, 3, 12, 26, 13); rect(c, RED, 5, 14, 22, 9); rect(c, GOLD, 8, 16, 16, 5); rect(c, BROWN, 12, 17, 8, 3); for (let x = 5; x < 28; x += 5) { rect(c, PAPER, x, 10, 2, 2); rect(c, PAPER, x, 25, 2, 2); } }
  else { frame(c, DARK); rect(c, GRAY, 8, 8, 16, 16); rect(c, PAPER, 14, 11, 4, 10); }
  return true;
}

export function mountItemArt(root) {
  root?.querySelectorAll?.('canvas[data-item-art]').forEach((canvas) => {
    if (!canvas.dataset.itemArtMounted) {
      drawItemArt(canvas, canvas.dataset.itemArt);
      canvas.dataset.itemArtMounted = 'true';
    }
  });
}
