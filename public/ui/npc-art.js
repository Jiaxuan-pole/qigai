import { px } from './pixel.js';

const COATS = ['#b48459', '#6d8b81', '#8a758b', '#c6a068', '#587d9a', '#9b725f'];
function hash(value) { let h = 0; for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

export function drawStreetNpc(c, npc, x, y, tick = 0) {
  const kind = `${npc.job || ''}${npc.name || ''}`;
  const h = hash(`${npc.id || kind}`);
  const coat = COATS[h % COATS.length];
  const cleaner = /保洁|清扫/.test(kind), rider = /外卖|快递/.test(kind), elder = /退休|大爷|叔/.test(kind);
  const step = tick && h % 2 ? tick % 2 : 0;
  px(c, x + 2, y + 38, 23, 3, '#303d40');
  px(c, x + 5, y + 26, 6, 13 - step, '#2a343a'); px(c, x + 17, y + 26, 6, 13 + step, '#2a343a');
  px(c, x + 3, y + 10, 23, 20, '#202a2d'); px(c, x + 5, y + 12, 19, 17, coat);
  px(c, x + 8, y + 14, 2, 12, '#dfbd8d'); px(c, x + 16, y + 16, 7, 2, '#d9baa2');
  px(c, x + 8, y + 2, 13, 12, elder ? '#ad825e' : '#c8956d');
  px(c, x + 7, y, 15, 5, elder ? '#9a9890' : '#342e2c');
  px(c, x + 17, y + 8, 2, 2, '#23272a');
  px(c, x + 5, y + 30, 6, 2, '#6d7a7c'); px(c, x + 17, y + 30, 6, 2, '#6d7a7c');
  if (cleaner) {
    px(c, x + 23, y + 18, 3, 26, '#ab9d75'); px(c, x + 21, y + 39, 10, 4, '#707765');
    px(c, x + 4, y + 13, 3, 10, '#d9c676');
  } else if (rider) {
    px(c, x - 6, y + 12, 10, 15, '#bca359'); px(c, x - 4, y + 15, 6, 3, '#e0c47d');
    px(c, x + 6, y - 1, 17, 5, '#d0b45f');
  } else if (elder) {
    px(c, x + 25, y + 19, 2, 25, '#806a4d');
  } else {
    px(c, x - 3, y + 18, 7, 11, '#48535a'); px(c, x - 2, y + 21, 5, 3, '#8ea0a2');
  }
}
