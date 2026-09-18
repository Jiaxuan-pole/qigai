import { px } from './pixel.js';

const OUT = '#141a1f';
const INK = '#1c2026';
const COLORS = {
  xuan: { hair: '#1e1a1c', skin: '#ecc19a', skinD: '#d9a577', skinL: '#f3d3b2', top: '#252b2e', light: '#3c4548', dark: '#161b1e', shirt: '#30383c', pants: '#2c3138', seam: '#20242a', shoe: '#1f2226', sole: '#7b8081' },
  fan: { hair: '#d8b35d', skin: '#b98358', skinD: '#986747', skinL: '#d9a577', top: '#c69a32', light: '#e0bb57', dark: '#987028', shirt: '#467aa1', pants: '#456784', seam: '#304c67', shoe: '#b8832d', sole: '#79562c' },
  ma: { hair: '#1e1a1c', skin: '#b98358', skinD: '#986747', skinL: '#d9a577', top: '#252b2e', light: '#3c4548', dark: '#161b1e', shirt: '#252b2e', pants: '#626b70', seam: '#465056', shoe: '#d8d6cf', sole: '#737d83', shortSleeve: true },
};

function legs(c, k, pose, frame) {
  const walk = pose.startsWith('walk');
  const crouch = pose === 'crouch' || ['work', 'repair', 'wash'].includes(pose.replace(/[012]$/, ''));
  const sit = pose === 'sit' || pose === 'sitlook' || ['rest', 'fish', 'cook'].includes(pose.replace(/[012]$/, ''));
  if (sit) {
    px(c, 8, 39, 18, 6, OUT); px(c, 9, 39, 16, 5, k.pants);
    px(c, 21, 42, 10, 5, k.pants); px(c, 24, 47, 8, 4, k.shoe); px(c, 24, 51, 8, 1, k.sole);
    px(c, 4, 43, 9, 6, k.pants); px(c, 2, 48, 10, 4, k.shoe); px(c, 2, 51, 10, 1, k.sole);
  } else if (crouch) {
    px(c, 4, 40, 23, 5, OUT); px(c, 6, 41, 19, 3, k.pants);
    px(c, 3, 44, 10, 5, k.pants); px(c, 20, 44, 8, 5, k.pants);
    px(c, 1, 49, 12, 3, k.shoe); px(c, 19, 49, 12, 3, k.shoe);
    px(c, 1, 51, 12, 1, k.sole); px(c, 19, 51, 12, 1, k.sole);
  } else {
    const left = walk ? [0, -3, 2, 4][frame] : 0;
    const right = walk ? [0, 3, -2, -4][frame] : 0;
    px(c, 8 + left, 36, 7, 12, OUT); px(c, 18 + right, 36, 7, 12, OUT);
    px(c, 9 + left, 37, 5, 10, k.pants); px(c, 19 + right, 37, 5, 10, k.pants);
    px(c, 9 + left, 39, 1, 7, k.seam); px(c, 23 + right, 39, 1, 7, k.seam);
    px(c, 7 + left, 47, 10, 5, OUT); px(c, 18 + right, 47, 11, 5, OUT);
    px(c, 8 + left, 48, 9, 3, k.shoe); px(c, 19 + right, 48, 9, 3, k.shoe);
    px(c, 8 + left, 51, 9, 1, k.sole); px(c, 19 + right, 51, 9, 1, k.sole);
  }
  return { crouch, sit };
}

function face(c, id, k, x, y) {
  const width = id === 'ma' ? 18 : id === 'fan' ? 16 : 15;
  px(c, x - 1, y + 2, width + 2, 16, OUT);
  px(c, x, y + 4, width, 12, k.skin);
  px(c, x, y + 12, width, 4, k.skinD);
  px(c, x + 2, y + 6, 4, 2, k.skinL);
  if (id === 'xuan') {
    px(c, x - 1, y, width + 2, 6, k.hair); px(c, x - 2, y + 2, 3, 7, k.hair);
    px(c, x + 3, y + 9, 2, 2, INK); px(c, x + 11, y + 9, 2, 2, INK);
    px(c, x + 7, y + 14, 3, 1, '#ad7560');
  } else if (id === 'fan') {
    px(c, x - 1, y + 1, width + 2, 6, k.hair); px(c, x - 3, y + 3, 4, 7, k.hair);
    px(c, x + width - 1, y + 2, 4, 5, k.hair); px(c, x + 3, y - 2, 5, 3, k.hair);
    px(c, x + 11, y - 1, 5, 2, k.hair); px(c, x + 4, y + 9, 2, 2, INK);
    px(c, x + 11, y + 9, 2, 2, INK); px(c, x + 7, y + 14, 4, 1, '#8f6a4c');
  } else {
    px(c, x - 1, y, width + 2, 6, k.hair);
    px(c, x - 2, y + 3, 3, 6, k.hair); px(c, x + width - 1, y + 3, 3, 5, k.hair);
    px(c, x + 3, y + 2, 5, 1, '#353439');
    px(c, x + 3, y + 9, 2, 2, INK); px(c, x + 12, y + 9, 2, 2, INK);
    px(c, x + 3, y + 13, 11, 2, '#805b48');
    for (const sx of [4, 7, 10, 13]) px(c, x + sx, y + 14 + sx % 2, 1, 1, '#593f32');
  }
}

function clothes(c, id, k, y, lean, breath) {
  const left = id === 'ma' ? 3 : id === 'fan' ? 5 : 6;
  const width = id === 'ma' ? 27 : id === 'fan' ? 23 : 21;
  px(c, left + lean - 1, y, width + 2, 18, OUT);
  px(c, left + lean, y + 1, width, 16, k.top);
  px(c, left + lean, y + 1, 5, 11, k.light);
  px(c, left + lean + width - 5, y + 1, 5, 15, k.dark);
  px(c, left + lean + 4, y + 13, width - 8, 2, k.dark);
  px(c, left + lean + 7, y + 10, 3, 1, k.light);
  px(c, left + lean + width - 10, y + 12, 3, 1, k.light);
  px(c, left + lean + 2, y + 16, 3 + breath, 2, k.dark);
  if (id === 'xuan') {
    px(c, 10 + lean, y + 1, 5, 3, '#778387'); px(c, 18 + lean, y + 1, 5, 3, '#778387');
    px(c, 15 + lean, y + 3, 3, 13, k.shirt);
    px(c, 16 + lean, y + 7, 1, 1, '#778387'); px(c, 16 + lean, y + 11, 1, 1, '#778387');
    px(c, 8 + lean, y + 11, 4, 1, k.dark);
  } else if (id === 'fan') {
    px(c, 12 + lean, y + 1, 10, 14, k.shirt);
    px(c, 9 + lean, y + 1, 4, 13, k.light);
    px(c, 22 + lean, y + 1, 4, 13, k.dark);
    px(c, 8 + lean, y + 10, 4, 2, k.dark); px(c, 24 + lean, y + 10, 3, 2, k.dark);
    px(c, 16 + lean, y + 5, 3, 1, '#6a9ab8');
  } else {
    px(c, 12 + lean, y, 10, 2, k.dark);
    px(c, 15 + lean, y + 2, 5, 2, k.skinD);
    px(c, 9 + lean, y + 8, 3, 1, k.light);
    px(c, 21 + lean, y + 9, 3, 1, k.light);
    px(c, 10 + lean, y + 15, 15, 2, k.dark);
  }
}

function arms(c, k, pose, frame, y, lean) {
  const walk = pose.startsWith('walk');
  const action = pose.replace(/[012]$/, '');
  const leftY = y + 2 + (walk ? [0, 3, 0, -3][frame] : 0);
  const rightY = y + 2 + (walk ? [0, -3, 0, 3][frame] : 0);
  const hand = (x, hy) => px(c, x, hy, 4, 3, k.skin);
  const sleeve = (x, sy, w, h, color) => {
    px(c, x - 1, sy - 1, w + 2, h + 2, OUT);
    px(c, x, sy, w, h, k.shortSleeve ? k.skin : color);
    if (k.shortSleeve) { px(c, x, sy, w, Math.min(5, h), color); px(c, x, sy + Math.min(4, h - 1), w, 1, k.dark); }
    else px(c, x, sy + h - 2, w, 2, k.dark);
  };
  if (action === 'carry') {
    sleeve(4 + lean, y + 1, 5, 9, k.light); sleeve(25 + lean, y + 1, 5, 9, k.dark);
    px(c, 2 + lean, y - 12 + frame, 30, 11, OUT); px(c, 3 + lean, y - 11 + frame, 28, 9, '#c9b389');
    px(c, 10 + lean, y - 10 + frame, 2, 8, '#a8926c'); hand(5 + lean, y - 2 + frame); hand(25 + lean, y - 2 + frame);
    return;
  }
  if (action === 'cook') {
    sleeve(4 + lean, y + 6, 8, 5, k.light);
    sleeve(25 + lean, y + 4 - frame * 2, 7, 5, k.dark);
    hand(11 + lean, y + 8); hand(31 + lean, y + 6 - frame * 2);
  } else if (['sit', 'sitlook', 'rest', 'fish'].includes(action)) {
    sleeve(3 + lean, y + 6, 5, 10, k.light); sleeve(26 + lean, y + 5 - frame * 2, 5, 10, k.dark);
    hand(5 + lean, y + 15); hand(26 + lean, y + 14 - frame * 2);
  } else if (['work', 'repair', 'wash', 'sketch'].includes(action)) {
    sleeve(3 + lean, y + 7, 8, 5, k.light); sleeve(23 + lean, y + 5 + frame * 2, 8, 5, k.dark);
    hand(10 + lean, y + 9); hand(22 + lean, y + 7 + frame * 2);
  } else if (['phone', 'smoke'].includes(action)) {
    sleeve(3 + lean, leftY, 5, 11, k.light); hand(4 + lean, leftY + 11);
    sleeve(25 + lean, y + 2, 5, 7, k.dark); sleeve(20 + lean, y + 3 - frame * 2, 8, 4, k.dark);
    hand(18 + lean, y + 1 - frame * 2);
  } else if (action === 'talk' || action === 'beg' || action === 'stall') {
    sleeve(3 + lean, y + 2 - frame * 3, 5, 10, k.light); hand(4 + lean, y + 11 - frame * 3);
    sleeve(25 + lean, y + 3 + frame * 2, 5, 9, k.dark); hand(26 + lean, y + 12 + frame * 2);
  } else {
    sleeve(3 + lean, leftY, 5, 11, k.light); hand(4 + lean, leftY + 11);
    sleeve(25 + lean, rightY, 5, 11, k.dark); hand(26 + lean, rightY + 11);
  }
}

function tool(c, action, frame, y, lean) {
  if (action === 'work' || action === 'repair') {
    px(c, 12 + lean, y + 17, 18, 7, OUT); px(c, 13 + lean, y + 18, 16, 5, '#4d5b60');
    px(c, 24 + lean, y + 5 + frame * 2, 2, 12, '#8a969b'); px(c, 21 + lean, y + 4 + frame * 2, 8, 2, '#8a969b');
  } else if (action === 'wash') {
    px(c, 13 + lean, y + 17, 11, 6, '#d7cbb1');
    px(c, 9 + lean + frame * 3, y + 13, 2, 3, '#8fc3e6'); px(c, 24 + lean - frame * 3, y + 15, 2, 3, '#8fc3e6');
  } else if (action === 'sketch') {
    px(c, 4 + lean, y + 14, 18, 13, OUT); px(c, 5 + lean, y + 15, 16, 11, '#d7cbb1');
    px(c, 8 + lean, y + 18, 7, 1, '#6b8490'); px(c, 25 + lean, y + 8 + frame * 2, 1, 9, '#5a4633');
  } else if (action === 'phone') {
    px(c, 16 + lean, y - 7 - frame * 2, 7, 12, OUT);
    px(c, 17 + lean, y - 6 - frame * 2, 5, 9, '#9fd6ff');
  } else if (action === 'smoke') {
    px(c, 18 + lean, y - 1 - frame * 2, 7, 1, '#ece4d3');
    px(c, 25 + lean, y - 1 - frame * 2, 2, 1, '#ff7a3a');
    if (frame) px(c, 26 + lean, y - 8, 1, 2, '#aeb6b6');
  } else if (action === 'fish') {
    const handY = y + 14 - frame * 2;
    for (let i = 0; i < 6; i++) {
      px(c, 29 + lean + i * 4, handY - i * (frame ? 4 : 2), 5, 2, '#7a8a8f');
    }
    const tipX = 53 + lean, tipY = handY - 5 * (frame ? 4 : 2);
    px(c, tipX, tipY + 2, 1, 15 + frame * 8, '#d8e6df');
    px(c, tipX - 1, tipY + 16 + frame * 8, 3, 2, '#e05a4f');
    px(c, tipX, tipY + 18 + frame * 8, 1, 2, '#f2efe6');
  } else if (action === 'beg') {
    px(c, 3 + lean, y + 19, 29, 12, OUT); px(c, 4 + lean, y + 20, 27, 10, '#c9b389');
    px(c, 8 + lean, y + 23, 17, 1, '#5a4633');
  } else if (action === 'stall') {
    px(c, -4 + lean, y + 18, 43, 3, OUT); px(c, -3 + lean, y + 19, 41, 2, '#8e6049');
    px(c, 2 + lean, y + 21, 2, 12, '#5a4633'); px(c, 32 + lean, y + 21, 2, 12, '#5a4633');
    for (const itemX of [2, 13, 24]) { px(c, itemX + lean, y + 14, 7, 3, '#c5b08a'); px(c, itemX + 2 + lean, y + 12, 3, 2, '#8a969b'); }
  } else if (action === 'cook') {
    const skewerY = y + 8 - frame * 2;
    px(c, 31 + lean, skewerY, 28, 1, '#a8926c');
    px(c, 40 + lean, skewerY - 3, 11, 7, OUT);
    px(c, 41 + lean, skewerY - 2, 9, 5, '#b87545');
    px(c, 51 + lean, skewerY - 2, 5, 4, '#75462f');
    px(c, 38 + lean, skewerY - 1, 4, 3, '#75462f');
    px(c, 44 + lean, skewerY - 1 + frame, 2, 1, '#e3bb72');
    px(c, 31 + lean, y + 18, 20, 6, OUT);
    px(c, 33 + lean, y + 19, 16, 4, '#4d5b60');
    px(c, 37 + lean, y + 18, 9, 2, '#b87545');
    px(c, 48 + lean, y + 16, 5, 2, '#8a969b');
    px(c, 33 + lean + frame * 2, y + 11, 2, 8, '#8a969b');
    px(c, 35 + lean + frame * 2, y + 10, 3, 2, '#8a969b');
    px(c, 37 + lean + frame * 2, y + 13, 1, 3, '#e6dfcc');
    px(c, 42 + lean - frame, y + 13 - frame * 2, 1, 3, '#e6dfcc');
    px(c, 44 + lean - frame, y + 9 - frame * 2, 1, 2, '#e6dfcc');
  } else if (action === 'talk') {
    px(c, 34 + lean, y + 1 + frame, 4, 2, '#e3bb72');
  }
}

// Keep the 24×38 caller footprint while drawing a 32×52 figure internally.
export function streetSprite(c, x, y, id, scale = 1, pose = 'stand') {
  const k = COLORS[id] || COLORS.xuan;
  const action = pose.replace(/[012]$/, '');
  const frame = Number(pose.match(/[0123]$/)?.[0] || 0);
  const walk = pose.startsWith('walk');
  const bob = walk && frame % 2 ? -1 : 0;
  const crouch = pose === 'crouch' || ['work', 'repair', 'wash'].includes(action);
  const sit = pose === 'sit' || pose === 'sitlook' || ['rest', 'fish', 'cook'].includes(action);
  const lean = crouch ? 2 : action === 'sketch' ? 1 : 0;
  const shift = crouch ? 8 : sit ? 5 : 0;
  const breath = pose === 'idle1' ? 1 : 0;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  const sx = scale * 24 / 32, sy = scale * 38 / 52;
  const p = {
    set fillStyle(value) { c.fillStyle = value; },
    fillRect(rx, ry, rw, rh) {
      const x0 = Math.round(rx * sx), y0 = Math.round(ry * sy);
      c.fillRect(x0, y0, Math.round((rx + rw) * sx) - x0, Math.round((ry + rh) * sy) - y0);
    },
  };
  px(p, 1, 51, 31, 1, 'rgba(10,18,24,0.45)');
  legs(p, k, pose, frame);
  const torsoY = 19 + shift + bob;
  clothes(p, id, k, torsoY, lean, breath);
  arms(p, k, pose, frame % 2, torsoY, lean);
  const headX = id === 'ma' ? 8 : id === 'fan' ? 9 : 10;
  face(p, id, k, headX + lean, 1 + shift + bob);
  if (['work', 'repair', 'wash', 'sketch', 'phone', 'smoke', 'fish', 'beg', 'talk', 'stall', 'cook'].includes(action)) tool(p, action, frame, torsoY, lean);
  if (pose === 'idle1' && id === 'ma') tool(p, 'smoke', 1, torsoY, lean);
  c.restore();
}

// A separate side-on silhouette keeps the established wardrobe while actually lying on the surface.
export function sleepingStreetSprite(c, x, y, id, breath = 0) {
  const k = COLORS[id] || COLORS.xuan;
  const head = id === 'ma' ? 19 : 17;
  px(c, x, y + 19, 91, 3, 'rgba(10,18,24,0.4)');
  px(c, x + 3, y + 5, head + 4, 17, OUT);
  px(c, x + 5, y + 7, head, 13, k.skin);
  px(c, x + 3, y + 4, head + 3, 6, k.hair);
  px(c, x + 9, y + 12, 2, 2, INK);
  if (id === 'ma') px(c, x + 13, y + 17, 8, 2, '#805b48');
  px(c, x + 22, y + 5 - breath, 40, 17 + breath, OUT);
  px(c, x + 23, y + 6 - breath, 37, 15 + breath, k.top);
  px(c, x + 24, y + 7 - breath, 7, 12, k.light);
  px(c, x + 35, y + 9 - breath, 13, 8, k.shirt);
  if (id === 'xuan') px(c, x + 34, y + 6 - breath, 10, 2, '#778387');
  if (id === 'ma') px(c, x + 25, y + 14, 13, 4, k.skin);
  else px(c, x + 25, y + 16, 14, 3, k.dark);
  px(c, x + 60, y + 8, 27, 13, OUT);
  px(c, x + 61, y + 9, 25, 11, k.pants);
  px(c, x + 69, y + 13, 16, 1, k.seam);
  px(c, x + 85, y + 9, 8, 12, OUT);
  px(c, x + 86, y + 10, 6, 9, k.shoe);
  px(c, x + 86, y + 19, 7, 1, k.sole);
}
