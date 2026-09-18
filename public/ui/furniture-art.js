import { px } from './pixel.js';

const OUT = '#141a1f';
const WOOD = '#876a48';
const EDGE = '#c7ad7c';
const PAPER = '#d7cbb1';

const SIZE = {
  bed_basic: [130, 44], bed_comfort: [130, 44], legacy_bed: [130, 44],
  dining_table: [148, 52], chair: [46, 45], sofa: [140, 55],
  cabinet: [70, 70], lamp: [30, 35], rug: [110, 65],
};

function bed(c, comfort, legacy) {
  const frame = legacy ? '#62594d' : WOOD;
  px(c, 0, 10, 130, 27, OUT); px(c, 3, 13, 124, 21, frame);
  px(c, 5, 7, 11, 33, OUT); px(c, 7, 9, 7, 28, legacy ? '#827565' : EDGE);
  px(c, 15, 13, 107, 19, comfort ? '#779092' : legacy ? '#797c70' : '#a09b83');
  px(c, 17, 14, 102, 3, comfort ? '#a2b6b1' : '#c4b8a0');
  px(c, 19, 18, 25, 11, PAPER); px(c, 20, 18, 22, 2, '#eee0bf');
  if (comfort) {
    px(c, 12, 1, 17, 15, OUT); px(c, 15, 3, 12, 10, '#9c7166');
    px(c, 47, 20, 68, 10, '#879d99'); px(c, 51, 20, 62, 2, '#b8c9be');
    px(c, 48, 31, 71, 4, '#5d7779');
  } else if (legacy) {
    for (let x = 49; x < 120; x += 16) px(c, x, 23, 6, 2, '#b8af98');
    px(c, 113, 12, 8, 23, '#6b6254');
  } else {
    px(c, 112, 12, 9, 24, '#ad8f62'); px(c, 119, 16, 3, 13, '#d0b77f');
    px(c, 10, 36, 8, 6, '#5d4935'); px(c, 113, 36, 8, 6, '#5d4935');
  }
}

function diningTable(c) {
  for (const x of [11, 126]) { px(c, x, 26, 10, 24, OUT); px(c, x + 2, 27, 6, 20, '#655035'); }
  px(c, 0, 11, 148, 25, OUT); px(c, 3, 13, 142, 19, WOOD);
  px(c, 4, 13, 139, 4, EDGE); px(c, 10, 28, 128, 2, '#674d34');
  for (const x of [31, 78, 119]) {
    px(c, x - 8, 17, 23, 12, '#eee2c6'); px(c, x - 5, 19, 17, 7, '#b6bbb1');
    px(c, x + 2, 20, 4, 3, '#a97143');
  }
  px(c, 56, 17, 12, 14, '#c9b39b'); px(c, 59, 13, 6, 5, '#e7d4b5');
}

function chair(c) {
  px(c, 5, 1, 36, 12, OUT); px(c, 8, 3, 30, 7, WOOD); px(c, 11, 4, 24, 2, EDGE);
  px(c, 7, 10, 6, 22, '#513f2d'); px(c, 34, 10, 6, 22, '#513f2d');
  px(c, 2, 25, 42, 12, OUT); px(c, 5, 27, 36, 7, '#a17a51');
  px(c, 6, 36, 6, 8, '#51402f'); px(c, 35, 36, 6, 8, '#51402f');
}

function sofa(c) {
  px(c, 0, 13, 140, 36, OUT); px(c, 4, 16, 132, 28, '#566c72');
  px(c, 9, 3, 122, 22, OUT); px(c, 12, 6, 116, 16, '#6e8586');
  px(c, 6, 20, 16, 25, '#455c61'); px(c, 118, 20, 16, 25, '#455c61');
  px(c, 25, 26, 43, 16, '#879a94'); px(c, 72, 26, 43, 16, '#879a94');
  px(c, 67, 24, 4, 19, '#324a50');
  px(c, 13, 46, 13, 8, '#493d35'); px(c, 114, 46, 13, 8, '#493d35');
}

function cabinet(c) {
  px(c, 3, 0, 64, 68, OUT); px(c, 6, 3, 58, 60, WOOD); px(c, 8, 5, 54, 4, EDGE);
  px(c, 9, 13, 25, 45, '#9b7850'); px(c, 37, 13, 25, 45, '#795c40');
  px(c, 34, 10, 3, 51, '#3b3028');
  px(c, 27, 34, 5, 7, '#d1ba82'); px(c, 40, 34, 5, 7, '#d1ba82');
  px(c, 8, 64, 8, 6, '#4c392b'); px(c, 54, 64, 8, 6, '#4c392b');
}

function lamp(c, night) {
  if (night) px(c, -24, -16, 78, 62, 'rgba(236,184,91,0.18)');
  px(c, 3, 1, 24, 18, OUT); px(c, 6, 3, 18, 14, '#dbb972');
  px(c, 10, 4, 10, 4, night ? '#f9e8aa' : '#eee0bf');
  px(c, 14, 19, 3, 11, '#566469'); px(c, 7, 30, 17, 4, OUT);
  px(c, 10, 31, 11, 2, '#8c825e');
}

function rug(c) {
  px(c, 0, 3, 110, 58, OUT); px(c, 3, 6, 104, 52, '#9d6e57');
  px(c, 8, 11, 94, 42, '#c29c76'); px(c, 13, 16, 84, 32, '#865e53');
  px(c, 19, 22, 72, 20, '#ae8469');
  for (let x = 5; x < 108; x += 9) {
    px(c, x, 0, 3, 5, '#d0ae83'); px(c, x, 59, 3, 5, '#d0ae83');
    px(c, x + 3, 28, 3, 3, '#dbb58b');
  }
}

export function drawFurnitureSprite(c, itemId, x, y, rotation = 0, { night = false } = {}) {
  const size = SIZE[itemId];
  if (!size) return false;
  const quarter = (((rotation / 90) % 4) + 4) % 4;
  const [w, h] = size;
  c.save();
  c.translate(Math.round(x + (quarter % 2 ? h : w) / 2), Math.round(y + (quarter % 2 ? w : h) / 2));
  c.rotate(quarter * Math.PI / 2);
  c.translate(-w / 2, -h / 2);
  if (itemId === 'bed_basic' || itemId === 'bed_comfort' || itemId === 'legacy_bed') bed(c, itemId === 'bed_comfort', itemId === 'legacy_bed');
  else if (itemId === 'dining_table') diningTable(c);
  else if (itemId === 'chair') chair(c);
  else if (itemId === 'sofa') sofa(c);
  else if (itemId === 'cabinet') cabinet(c);
  else if (itemId === 'lamp') lamp(c, night);
  else rug(c);
  c.restore();
  return true;
}

export function drawParcel(c, x, y, count = 1) {
  const n = Math.max(1, Math.min(3, count));
  for (let i = n - 1; i >= 0; i--) {
    const xx = x + i * 12, yy = y - i * 9;
    px(c, xx, yy, 43, 34, OUT); px(c, xx + 3, yy + 3, 37, 28, '#a78253');
    px(c, xx + 3, yy + 3, 37, 5, '#c5a16d');
    px(c, xx + 18, yy + 3, 7, 28, PAPER); px(c, xx + 5, yy + 15, 34, 2, '#775b3d');
    px(c, xx + 29, yy + 21, 7, 5, '#d6c69e');
  }
}

export function drawFloorSheet(c, x, y, who = 'xuan') {
  const cloth = who === 'fan' ? '#97816a' : who === 'ma' ? '#788b81' : '#84959a';
  px(c, x, y + 6, 111, 27, OUT); px(c, x + 3, y + 8, 105, 22, cloth);
  px(c, x + 6, y + 9, 98, 3, '#b7b4a1');
  px(c, x + 10, y + 12, 24, 14, PAPER); px(c, x + 11, y + 13, 21, 2, '#eee0bf');
  px(c, x + 36, y + 15, 65, 2, '#6a7774');
  px(c, x + 7, y + 30, 97, 2, '#596b6b');
}
