import { px } from './pixel.js';
import { drawFurnitureSprite } from './furniture-art.js';
import { drawStreetNpc } from './npc-art.js';

function sample(c, itemId, x, y, rotation, night) {
  if (typeof c.rotate === 'function') return drawFurnitureSprite(c, itemId, x, y, rotation, { night });
  const traceCanvas = {
    save: c.save, restore: c.restore, translate: c.translate, rotate: () => {}, fillRect: c.fillRect,
    get fillStyle() { return c.fillStyle; }, set fillStyle(value) { c.fillStyle = value; },
  };
  return drawFurnitureSprite(traceCanvas, itemId, x, y, rotation, { night });
}

function priceTag(c, x, y, label) {
  px(c, x - 2, y - 2, 48, 21, '#293339');
  px(c, x, y, 44, 17, '#d7cbb1');
  px(c, x + 3, y + 3, 38, 2, '#927354');
  c.fillStyle = '#453d34'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
  c.fillText(label, x + 22, y + 14);
}

function window(c, x, night, wet, tick) {
  const outside = night ? '#263e4c' : wet ? '#738e91' : '#a4bab2';
  px(c, x - 5, 76, 192, 164, '#29343a');
  px(c, x, 81, 182, 154, outside);
  px(c, x, 197, 182, 38, night ? '#314b54' : '#63868a');
  px(c, x + 88, 81, 6, 154, '#d6bd87');
  px(c, x, 155, 182, 5, '#d6bd87');
  for (let i = 0; i < 5; i++) px(c, x + 17 + i * 31, 104 + (i % 3) * 9, 14, 22, night ? '#52666b' : '#718486');
  if (wet) for (let i = 0; i < 15; i++) px(c, x + 9 + (i * 17 + tick * 3) % 164, 91 + (i * 29 + tick * 5) % 96, 2, 12, '#c2d6d1');
}

function door(c, x, night) {
  px(c, x, 246, 74, 158, '#1e292d');
  px(c, x + 5, 251, 64, 144, night ? '#263d48' : '#66858a');
  px(c, x + 34, 251, 4, 144, '#d8c58e');
  px(c, x + 8, 326, 58, 4, '#d8c58e');
  px(c, x + 57, 328, 5, 13, '#e3bb72');
  if (night) for (let bar = x + 11; bar < x + 67; bar += 11) px(c, bar, 247, 3, 150, '#47585b');
}

function ceilingLamp(c, x, night) {
  px(c, x, 46, 3, 47, '#4c514c');
  px(c, x - 18, 91, 39, 12, '#6d614b');
  px(c, x - 12, 102, 27, 5, night ? '#f3d58b' : '#e7d6a4');
  if (night) { c.fillStyle = 'rgba(227,187,114,.11)'; c.fillRect(x - 66, 107, 133, 184); }
}

function rugAndSofa(c, night) {
  sample(c, 'rug', 493, 344, 0, night);
  sample(c, 'sofa', 478, 314, 0, night);
  sample(c, 'lamp', 616, 291, 0, night);
  priceTag(c, 570, 407, '客厅样品');
}

function counter(c) {
  px(c, 693, 290, 163, 22, '#252f32'); px(c, 698, 294, 153, 14, '#9d7650');
  px(c, 704, 309, 143, 64, '#6f533b');
  for (let x = 712; x < 841; x += 30) px(c, x, 314, 3, 54, '#b28d61');
  px(c, 720, 278, 55, 16, '#27343a'); px(c, 725, 281, 45, 10, '#8faeb0');
  px(c, 789, 277, 18, 16, '#d7cbb1'); px(c, 792, 279, 12, 3, '#8a7354');
  px(c, 684, 372, 181, 6, '#423d36');
}

export function drawFurnitureOverview(c, x, y, night = false) {
  const wall = night ? '#5e5a54' : '#918069';
  px(c, x - 103, y - 66, 206, 93, '#2d393d');
  px(c, x - 97, y - 60, 194, 80, wall);
  px(c, x - 87, y - 83, 174, 24, '#3a3e3a');
  px(c, x - 82, y - 79, 164, 16, '#d7b66e');
  c.fillStyle = '#343330'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('营地家具城', x, y - 68);
  px(c, x - 78, y - 47, 53, 41, night ? '#d7b66e' : '#78969a');
  px(c, x + 25, y - 47, 53, 41, night ? '#d7b66e' : '#78969a');
  px(c, x - 13, y - 52, 26, 70, '#26343a'); px(c, x - 9, y - 48, 18, 59, night ? '#485e65' : '#6e9093');
  px(c, x - 70, y - 26, 33, 12, '#876a48'); px(c, x - 66, y - 30, 21, 5, '#d7cbb1');
  px(c, x + 36, y - 27, 25, 10, '#566c72'); px(c, x + 40, y - 34, 17, 9, '#6e8586');
  if (night) { c.fillStyle = 'rgba(227,187,114,.16)'; c.fillRect(x - 96, y - 57, 192, 75); }
}

export function drawFurnitureStoreScene(c, { night = false, weatherKind = 'clear', tick = 0 } = {}) {
  const wet = weatherKind === 'rain' || weatherKind === 'storm';
  px(c, 0, 0, 960, 540, night ? '#263941' : '#6f8584');
  px(c, 0, 0, 960, 61, '#263239');
  for (let x = 0; x < 960; x += 80) { px(c, x, 0, 8, 61, '#3c494d'); px(c, x + 11, 50, 59, 4, '#4d5958'); }
  px(c, 0, 61, 960, 272, '#8b795f');
  px(c, 0, 333, 960, 207, '#68645a');
  for (let y = 354; y < 540; y += 29) px(c, 0, y, 960, 2, '#897b66');
  for (let x = 0; x < 960; x += 64) px(c, x, 334, 2, 206, '#5b584f');
  window(c, 103, night, wet, tick); window(c, 672, night, wet, tick);
  for (const x of [236, 480, 724]) ceilingLamp(c, x, night);
  px(c, 325, 68, 308, 35, '#314042'); px(c, 334, 75, 290, 21, '#d7b66e');
  c.fillStyle = '#303333'; c.font = 'bold 19px sans-serif'; c.textAlign = 'center'; c.fillText('营地家具城', 480, 92);
  door(c, 16, night); door(c, 870, night);

  px(c, 82, 257, 189, 9, '#5a4b3a'); px(c, 87, 266, 180, 5, '#b08b5d');
  sample(c, 'bed_basic', 94, 214, 0, night);
  sample(c, 'bed_comfort', 97, 282, 0, night);
  priceTag(c, 188, 205, '床样区'); priceTag(c, 188, 352, '床头标价');

  px(c, 315, 326, 176, 10, '#5f503d'); px(c, 320, 336, 165, 5, '#b18c5e');
  sample(c, 'dining_table', 323, 271, 0, night);
  sample(c, 'chair', 326, 324, 0, night);
  sample(c, 'chair', 438, 324, 0, night);
  priceTag(c, 379, 380, '餐桌餐椅');

  rugAndSofa(c, night);
  sample(c, 'cabinet', 604, 202, 0, night);
  priceTag(c, 615, 275, '储物柜');
  counter(c);
  px(c, 326, 413, 338, 17, '#4b5550'); px(c, 332, 417, 326, 9, '#b0a07a');
  drawStreetNpc(c, { id: 'furniture_clerk', job: '收银员' }, 802, 329, tick);
  drawStreetNpc(c, { id: 'furniture_buyer', job: '挑家具的客人' }, 438 + tick % 32, 360, tick);
  px(c, 0, 430, 960, 10, '#4d544e'); px(c, 0, 440, 960, 100, '#37494d');
  for (let x = 30; x < 960; x += 130) px(c, x, 503, 67, 3, '#97a19b');
  if (night) { c.fillStyle = 'rgba(9,21,33,.17)'; c.fillRect(0, 0, 960, 540); }
}
