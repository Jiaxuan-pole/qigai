import { px } from './pixel.js';

export const STOREFRONTS = {
  convenience: { name: '便利店', wall: '#879278', trim: '#d7c65c' },
  breakfast: { name: '早餐摊', wall: '#876f54', trim: '#c58c55' },
  recycle_shop: { name: '电子回收', wall: '#687878', trim: '#a5ad9c' },
  lottery_kiosk: { name: '彩票亭', wall: '#b65147', trim: '#e4ded0' },
  tavern: { name: '小酒馆', wall: '#77654f', trim: '#d5aa69' },
  clinic: { name: '诊所', wall: '#bdc5bd', trim: '#7fa3a5' },
  pharmacy: { name: '药房', wall: '#b4c3b0', trim: '#64a775' },
  bathhouse: { name: '公共浴室', wall: '#85a8ad', trim: '#c3dad6' },
  art_hardware: { name: '五金店', wall: '#8b806e', trim: '#d8ac60' },
  cinema: { name: '旧影院', wall: '#776975', trim: '#d7bc79' },
  studio: { name: '画室', wall: '#978776', trim: '#cdb795' },
  service: { name: '服务站', wall: '#aab5aa', trim: '#769692' },
  furniture_store: { name: '营地家具城', wall: '#8f8069', trim: '#d7b66e' },
  bus: { name: '候车厅', wall: '#798c8b', trim: '#b4c6bc' },
  camp: { name: '桥下旧铺', wall: '#697575', trim: '#9c9c80' },
  produce: { name: '果蔬摊', wall: '#927952', trim: '#b1b875' },
  salvage: { name: '旧电器仓', wall: '#667676', trim: '#91a49d' },
};

const layouts = {
  market: [['convenience', 18, 288], ['breakfast', 330, 295], ['produce', 650, 286]],
  recycle: [['recycle_shop', 18, 384], ['salvage', 430, 506]],
  station: [['bus', 18, 300], ['tavern', 338, 290], ['lottery_kiosk', 686, 246]],
  cinema: [['cinema', 18, 455], ['studio', 487, 225], ['art_hardware', 726, 210]],
  service: [['service', 18, 220], ['pharmacy', 254, 220], ['clinic', 490, 220], ['bathhouse', 726, 210]],
  camp: [['camp', 18, 288], ['camp', 330, 295], ['camp', 650, 286]],
  furniture: [['furniture_store', 150, 660]],
};

function shelf(c, x, y, w, h, trim, night) {
  px(c, x, y, w, h, '#26383c');
  px(c, x + 4, y + 4, w - 8, h - 8, night ? '#746a59' : '#587176');
  for (let j = 0; j < 3; j++) {
    px(c, x + 6, y + 14 + j * 17, w - 12, 3, '#3b4d4b');
    for (let i = 0; i < Math.floor((w - 18) / 15); i++) px(c, x + 9 + i * 15, y + 5 + j * 17, 8, 9, [trim, '#ce9270', '#95ad9d', '#e3cf99'][i % 4]);
  }
  px(c, x + 16, y + 3, 2, h - 6, '#aac0b6');
}
function door(c, x, y, w, h, glass = '#526a6d') {
  px(c, x, y, w, h, '#1e2b2e');
  px(c, x + 4, y + 4, w - 8, h - 10, glass);
  px(c, x + w - 10, y + 35, 3, 13, '#dbce9b');
  px(c, x + 10, y + 5, 3, h - 17, '#a0b3ad');
}
function sign(c, x, y, w, text, trim) {
  px(c, x - 3, y - 3, w + 6, 34, '#253137');
  px(c, x, y, w, 28, trim);
  c.fillStyle = '#273237'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
  c.fillText(text, x + w / 2, y + 20);
}
function crate(c, x, y, color = '#967756') {
  px(c, x, y, 36, 27, '#2c3533'); px(c, x + 3, y + 2, 30, 23, color);
  px(c, x + 5, y + 8, 26, 3, '#bc9a6c'); px(c, x + 16, y + 2, 3, 22, '#69583e');
}
function poster(c, x, y, color) {
  px(c, x - 3, y - 3, 67, 91, '#2b3034'); px(c, x, y, 61, 85, color);
  px(c, x + 10, y + 8, 40, 28, '#d8c39b');
  px(c, x + 19, y + 16, 22, 21, '#403a47');
  px(c, x + 11, y + 48, 39, 3, '#eee1bd'); px(c, x + 11, y + 58, 28, 3, '#eee1bd');
  px(c, x + 41, y + 75, 17, 10, '#6b625f');
}

export function drawStorefront(c, id, x, w, night = false, tick = 0) {
  const def = STOREFRONTS[id];
  const y = id === 'lottery_kiosk' ? 238 : 188;
  px(c, x + 5, y + 8, w, 192 - (y - 188), '#1d2b30');
  px(c, x, y, w, 187 - (y - 188), def.wall);
  px(c, x, y, w, 10, '#35474b');
  for (let i = 0; i < w - 20; i += 39) {
    px(c, x + 9 + i, y + 13, 20, 5, '#c6c8ad');
    px(c, x + 9 + i, y + 42, 22, 2, '#4e6062');
  }
  sign(c, x + 10, y + 24, w - 20, def.name, def.trim);
  const ix = x + 18, bottom = 376;
  if (id === 'convenience') {
    shelf(c, ix, y + 75, 93, 84, def.trim, night);
    door(c, x + 124, y + 67, 69, 119, '#769295');
    shelf(c, x + 206, y + 75, 66, 84, '#7e9c69', night);
    px(c, x + 7, y + 60, w - 14, 11, '#548960');
    for (let i = 0; i < w - 15; i += 30) px(c, x + 8 + i, y + 71, 15, 8, '#dfcb57');
    px(c, x + 215, 341, 52, 35, '#cdd3c9'); px(c, x + 220, 345, 42, 14, '#80b5c0');
    for (let i = 0; i < 4; i++) px(c, x + 225 + i * 9, 363, 5, 10, ['#b2664e','#a7b97f','#d3b477','#758ca0'][i]);
  } else if (id === 'breakfast') {
    px(c, x + 12, y + 59, w - 24, 12, '#b96d4e');
    for (let i = 0; i < w - 26; i += 34) px(c, x + 14 + i, y + 71, 17, 10, '#e2b581');
    px(c, x + 24, 331, 204, 10, '#5c4938'); px(c, x + 31, 340, 5, 35, '#514739'); px(c, x + 210, 340, 5, 35, '#514739');
    for (let i = 0; i < 3; i++) { const bx = x + 50 + i * 48; px(c, bx, 308 - i * 8, 41, 24, '#9eaeaa'); px(c, bx + 3, 307 - i * 8, 35, 4, '#d4d6be'); px(c, bx + 15, 300 - i * 8, 8, 7, '#bdcbc5'); }
    px(c, x + 249, 352, 29, 5, '#c19d6c'); px(c, x + 253, 357, 3, 22, '#60503e'); px(c, x + 273, 357, 3, 22, '#60503e');
    px(c, x + 84 + tick % 3, 278, 2, 14, '#c6d1ca');
  } else if (id === 'recycle_shop') {
    door(c, x + 18, y + 70, 83, 116, '#414e4e');
    px(c, x + 124, 342, 120, 11, '#8a8b78'); px(c, x + 132, 353, 7, 26, '#505b58'); px(c, x + 233, 353, 7, 26, '#505b58');
    px(c, x + 156, 333, 51, 9, '#b9beb1'); px(c, x + 172, 326, 19, 8, '#677877');
    for (let i = 0; i < 4; i++) { px(c, x + 260 + i * 24, 283, 17, 54, '#36474b'); px(c, x + 262 + i * 24, 298, 13, 8, '#9a7e62'); }
    crate(c, x + 264, 348); crate(c, x + 307, 348, '#6d7974');
    for (let i = 0; i < 5; i++) px(c, x + 266 + i * 11, 339, 7, 4, '#92a68b');
  } else if (id === 'salvage') {
    px(c, x + 14, 263, w - 28, 9, '#394c4f');
    for (let i = 0; i < 4; i++) {
      const sx = x + 26 + i * 112;
      px(c, sx, 280, 81, 72, '#293b42'); px(c, sx + 5, 285, 71, 47, '#738986');
      px(c, sx + 13, 291, 54, 33, ['#a5b2a8', '#665f55', '#7997a0', '#8a907c'][i]);
      px(c, sx + 15, 354, 66, 7, '#54615c');
    }
    px(c, x + 36, 362, 144, 8, '#695f50'); px(c, x + 55, 370, 7, 17, '#514a40');
    px(c, x + 151, 370, 7, 17, '#514a40');
    for (let i = 0; i < 6; i++) px(c, x + 225 + i * 31, 354, 15, 19, '#444b48');
  } else if (id === 'produce') {
    px(c, x + 11, y + 60, w - 22, 12, '#a76f50');
    for (let i = 0; i < 8; i++) px(c, x + 18 + i * 31, y + 72, 16, 9, '#c3ac72');
    px(c, x + 24, 329, w - 48, 10, '#75654b');
    for (let i = 0; i < 6; i++) {
      const bx = x + 28 + i * 39;
      px(c, bx, 340, 34, 27, '#765a3c');
      for (let j = 0; j < 4; j++) px(c, bx + 4 + j * 7, 337 + j % 2 * 4, 6, 7, ['#b2bd64', '#ce8f5c', '#73985e'][i % 3]);
    }
    px(c, x + 36, 372, 5, 13, '#544d3f'); px(c, x + w - 42, 372, 5, 13, '#544d3f');
  } else if (id === 'lottery_kiosk') {
    px(c, x + 9, y + 62, w - 18, 22, '#efe7d6');
    for (let i = 0; i < 11; i++) px(c, x + 12 + i * 20, y + 64, 10, 3, '#b85049');
    px(c, x + 20, y + 92, w - 40, 61, '#2a3f43');
    for (let i = 0; i < 7; i++) px(c, x + 31 + i * 25, y + 103, 18, 25, '#ede0c4');
    px(c, x + 31, y + 137, w - 62, 8, '#d7cbb1');
    px(c, x + 24, 365, w - 48, 11, '#853d3b');
  } else if (id === 'tavern') {
    door(c, x + 20, y + 81, 69, 106, '#59463e');
    px(c, x + 111, y + 78, w - 132, 83, '#263339');
    px(c, x + 116, y + 83, w - 142, 72, night ? '#c09258' : '#b39870');
    for (const tx of [x + 137, x + 208]) { px(c, tx, 321, 42, 6, '#604b38'); px(c, tx + 17, 327, 5, 34, '#604b38'); px(c, tx + 4, 350, 11, 6, '#43392e'); }
    px(c, x + 98, 360, 44, 16, '#6b503a'); px(c, x + 105, 354, 31, 7, '#a67b4d');
    for (let i = 0; i < 5; i++) px(c, x + 101 + i * 8, 361, 3, 9, '#b18d5d');
  } else if (id === 'pharmacy') {
    shelf(c, x + 14, y + 78, 112, 89, '#e7e8dc', night);
    door(c, x + 144, y + 76, 60, 110, '#8ca8a4');
    px(c, x + 150, y + 1, 11, 29, '#428c65'); px(c, x + 142, y + 9, 27, 11, '#428c65');
    for (let i = 0; i < 3; i++) { px(c, x + 29 + i * 29, 341, 16, 19, '#b6c5af'); px(c, x + 32 + i * 29, 337, 10, 5, '#e3e3ca'); }
    px(c, x + 25, 363, 95, 9, '#4c655b');
  } else if (id === 'clinic') {
    door(c, x + 13, y + 79, 74, 108, '#a3bdb9');
    px(c, x + 97, y + 77, w - 109, 101, '#394a4c'); px(c, x + 102, y + 82, w - 119, 91, '#d6ded1');
    px(c, x + 111, 313, 79, 11, '#839da0'); px(c, x + 108, 305, 16, 9, '#faf0d9');
    px(c, x + 124, 303, 63, 10, '#9dc0b9'); px(c, x + 115, 325, 5, 23, '#687b7a'); px(c, x + 183, 325, 5, 23, '#687b7a');
    px(c, x + 166, 271, 3, 34, '#809596'); px(c, x + 159, 269, 17, 3, '#809596'); px(c, x + 173, 272, 5, 10, '#c4d1b9');
    px(c, x + 174, y + 8, 9, 21, '#b95b57'); px(c, x + 168, y + 14, 21, 9, '#b95b57');
    px(c, x + 14, 366, 72, 7, '#6f9292');
  } else if (id === 'service') {
    px(c, x + 15, y + 76, w - 30, 105, '#354c51');
    px(c, x + 20, y + 80, 70, 89, '#a6b6a6');
    for (let i = 0; i < 4; i++) { px(c, x + 26 + i % 2 * 30, 277 + Math.floor(i / 2) * 30, 25, 23, '#e4d4ad'); px(c, x + 30 + i % 2 * 30, 284 + Math.floor(i / 2) * 30, 17, 2, '#788977'); }
    px(c, x + 112, 295, w - 134, 14, '#8caa9b'); px(c, x + 111, 326, w - 130, 12, '#bfaa7e');
    px(c, x + 119, 338, 6, 35, '#67766a'); px(c, x + w - 28, 338, 6, 35, '#67766a');
    for (let i = 0; i < 3; i++) { px(c, x + 23 + i * 29, 354, 24, 6, '#92a4a0'); px(c, x + 27 + i * 29, 360, 4, 16, '#536969'); }
  } else if (id === 'bathhouse') {
    for (let tx = x + 12; tx < x + w - 10; tx += 23) for (let ty = y + 67; ty < 372; ty += 22) px(c, tx, ty, 20, 19, (tx + ty) % 2 ? '#9ac0c3' : '#bad6d3');
    door(c, x + 92, y + 81, 90, 106, '#759ea9');
    px(c, x + w - 43, 284, 7, 64, '#f2e3cc'); px(c, x + w - 34, 284, 13, 43, '#e2c88f'); px(c, x + w - 19, 284, 13, 43, '#b9ddd4');
    px(c, x + 212 + tick % 3, 262, 3, 15, '#d7e4df');
  } else if (id === 'art_hardware') {
    door(c, x + 22, y + 77, 97, 109, '#57635e');
    px(c, x + 142, y + 80, w - 168, 107, '#655b4a');
    for (let j = 0; j < 3; j++) { px(c, x + 151, y + 90 + j * 31, w - 168, 4, '#b8a583'); for (let i = 0; i < Math.floor((w - 160) / 22); i++) px(c, x + 159 + i * 22, y + 96 + j * 31, 9, 18, ['#646d6e','#b99457','#6c8585'][j]); }
    for (let i = 0; i < Math.floor((w - 158) / 28); i++) { px(c, x + 158 + i * 28, 351, 19, 25, ['#c4974e','#9b6850','#778b86'][i % 3]); px(c, x + 161 + i * 28, 346, 13, 5, '#ddd0a0'); }
  } else if (id === 'cinema') {
    for (let i = 0; i < 3; i++) poster(c, x + 30 + i * 85, 267, ['#a66561','#63868b','#b69865'][i]);
    door(c, x + 314, 263, 115, 114, '#554d50');
    px(c, x + 305, 375, 134, 7, '#9a8d82'); px(c, x + 310, 382, 124, 6, '#6b6164');
    px(c, x + 268, 300, 27, 77, '#584b47'); px(c, x + 271, 305, 21, 46, '#d7c9a2');
  } else if (id === 'studio') {
    door(c, x + 20, y + 80, 76, 107, '#635f58');
    for (let i = 0; i < 3; i++) { const fx = x + 120 + i * 84; px(c, fx, 259, 66, 79, '#333b3b'); px(c, fx + 4, 263, 58, 71, '#dccab0'); px(c, fx + 13, 276, 19, 34, ['#8b6650','#698187','#a88764'][i]); }
    px(c, x + 212, 347, 30, 30, '#6b5b4a');
  } else {
    door(c, x + 32, y + 73, 76, 114, '#687a79');
    shelf(c, x + 133, y + 79, w - 155, 80, '#9b9f80', night);
    crate(c, x + 154, 350);
  }
  px(c, x, bottom, w, 6, '#4b5a59');
}

export function drawDistrictStorefronts(c, district, night, tick) {
  for (const [id, x, w] of layouts[district] || []) drawStorefront(c, id, x, w, night, tick);
}
