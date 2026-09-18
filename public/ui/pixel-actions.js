function px(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

const OUT = '#141a1f';
const BOX = '#c9b389', INK = '#5a4633', METAL = '#8a969b', WATER = '#8fc3e6';

export function actionPose(c, k, action, frame, dy, who) {
  const ty = 13 + dy;
  const sleeve = (x, y, w, h, color) => {
    px(c, x - 1, y - 1, w + 2, h + 2, OUT);
    px(c, x, y, w, h, k.shortSleeve ? k.skin : color);
    if (k.shortSleeve) px(c, x, y, w, Math.min(4, h), color);
  };
  const hand = (x, y) => px(c, x, y, 3, 3, k.skin);
  const rod = (x, y, w = 5, h = 2) => { px(c, x, y, w, h, OUT); px(c, x + 1, y, Math.max(1, w - 2), 1, '#7a8a8f'); };
  const fishingLine = (x, y, h) => px(c, x, y, 1, h, '#d8e6df');
  if (action === 'work') {
    sleeve(1, ty + 2, 4, 8, k.topL); sleeve(19, ty + (frame ? 5 : 1), 4, 9, k.topD);
    hand(3, ty + 10); hand(19, ty + (frame ? 13 : 9));
    px(c, 13, ty + 12, 11, 7, OUT); px(c, 14, ty + 13, 9, 5, '#68777b'); px(c, 17, ty + 10, 3, 3, '#abb9b4');
  } else if (action === 'beg') {
    sleeve(1, ty + 2, 4, 8, k.topL); sleeve(19, ty + 1, 4, 8, k.topD);
    hand(2, ty + 9); hand(20, ty + 8);
    px(c, 0, ty - 8 + frame, 27, 13, OUT); px(c, 1, ty - 7 + frame, 25, 11, BOX);
    px(c, 4, ty - 4 + frame, 19, 2, INK); px(c, 6, ty + frame, 14, 2, INK);
  } else if (action === 'smoke') {
    sleeve(1, ty + 2, 4, 9, k.topL); sleeve(17, ty + (frame ? -1 : 2), 5, 8, k.topD);
    hand(18, ty + (frame ? -3 : 9));
    px(c, 19, ty + (frame ? -5 : 8), 7, 1, '#ece4d3'); px(c, 26, ty + (frame ? -5 : 8), 2, 2, frame ? '#ff9c52' : '#a84e30');
    if (frame) { px(c, 26, ty - 10, 1, 2, '#aeb6b6'); px(c, 28, ty - 13, 1, 2, '#8e9797'); }
  } else if (action === 'phone') {
    sleeve(1, ty + 3, 4, 9, k.topL); sleeve(17, ty + (frame ? -1 : 3), 5, 8, k.topD);
    hand(17, ty + (frame ? -3 : 10)); px(c, 16, ty + (frame ? -12 : 4), 8, 12, OUT); px(c, 17, ty + (frame ? -11 : 5), 6, 9, '#9fd6ff');
    if (frame) px(c, 18, ty - 8, 4, 2, '#d9f2ff');
  } else if (action === 'sketch') {
    sleeve(0, ty + 3, 5, 9, k.topL); sleeve(19, ty + (frame ? 5 : 1), 4, 8, k.topD);
    px(c, 2, ty + 7, 17, 13, OUT); px(c, 3, ty + 8, 15, 11, '#d7cbb1');
    px(c, 6, ty + 11, 8, 1, '#6b8490'); px(c, 9, ty + 14, 6, 1, INK);
    hand(18, ty + (frame ? 12 : 8)); px(c, 19, ty + (frame ? 9 : 4), 1, 7, '#282e31');
  } else if (action === 'repair') {
    sleeve(1, ty + 8, 7, 4, k.topL); sleeve(17, ty + (frame ? 7 : 10), 7, 4, k.topD);
    hand(7, ty + 9); hand(17, ty + (frame ? 8 : 11));
    px(c, 8, ty + 13, 15, 6, OUT); px(c, 9, ty + 14, 13, 4, '#4d5b60');
    px(c, 19, ty + (frame ? 4 : 7), 2, 11, METAL); px(c, 17, ty + (frame ? 3 : 6), 6, 2, METAL);
  } else if (action === 'stall') {
    sleeve(1, ty + 2, 4, 8, k.topL); sleeve(19, ty + (frame ? 5 : 2), 4, 8, k.topD);
    px(c, -5, ty + 15, 37, 3, OUT); px(c, -4, ty + 16, 35, 2, '#8e6049');
    px(c, -2, ty + 18, 2, 9, INK); px(c, 27, ty + 18, 2, 9, INK);
    for (let i = 0; i < 3; i++) { px(c, 1 + i * 9, ty + 12, 5, 3, '#c5b08a'); px(c, 2 + i * 9, ty + 10, 3, 2, METAL); }
    hand(20, ty + (frame ? 12 : 9));
  } else if (action === 'wash') {
    sleeve(0, ty + (frame ? 7 : 4), 7, 5, k.topL); sleeve(17, ty + (frame ? 4 : 7), 7, 5, k.topD);
    hand(6, ty + (frame ? 10 : 7)); hand(16, ty + (frame ? 7 : 10));
    px(c, 9, ty + 13, 9, 5, '#d7cbb1');
    px(c, 6 + frame * 3, ty + 10, 2, 2, WATER); px(c, 19 - frame * 3, ty + 8, 2, 3, WATER);
    px(c, 10, ty + 19, 8, 1, WATER);
  } else if (action === 'rest') {
    sleeve(0, ty + 10, 7, 4, k.topL); sleeve(17, ty + 10, 7, 4, k.topD);
    hand(7, ty + 11); hand(15, ty + 11);
    px(c, 7, ty + 14, 12, 2, '#d7cbb1');
    if (frame) { px(c, 27, ty - 9, 5, 1, '#e6dfcc'); px(c, 29, ty - 8, 1, 2, '#e6dfcc'); }
  } else if (action === 'carry') {
    sleeve(0, ty + 1, 6, 8, k.topL); sleeve(18, ty + 1, 6, 8, k.topD);
    px(c, -5, ty - 11 + frame, 33, 11, OUT); px(c, -4, ty - 10 + frame, 31, 9, BOX);
    px(c, 7, ty - 10 + frame, 2, 9, '#a8926c'); px(c, 20, ty - 10 + frame, 2, 9, '#a8926c');
    hand(2, ty - 1 + frame); hand(20, ty - 1 + frame);
  } else if (action === 'fish') {
    const awkward = who === 'ma' ? 0 : who === 'xuan' ? 1 : 2;
    if (frame === 0) {
      sleeve(1, ty + 7, 5, 6, k.topL); sleeve(17, ty + 9 + awkward, 5, 5, k.topD);
      hand(5, ty + 12); hand(19, ty + 14 + awkward);
      rod(20, ty + 14 + awkward); rod(24, ty + 11 + awkward); rod(28, ty + 8 + awkward); rod(32, ty + 5 + awkward); rod(36, ty + 2 + awkward, 4);
      fishingLine(39, ty + 4 + awkward, 7); fishingLine(40, ty + 10 + awkward, 5);
      px(c, 39, ty + 15 + awkward, 4, 3, OUT); px(c, 40, ty + 15 + awkward, 2, 2, '#e05a4f'); px(c, 40, ty + 17 + awkward, 2, 2, '#f2efe6');
      if (who === 'ma') { px(c, 36, ty + 18, 10, 1, '#8fc3e6'); px(c, 38, ty + 19, 6, 1, '#8fc3e6'); }
    } else if (frame === 1) {
      sleeve(2, ty + 6, 5, 7, k.topL); sleeve(17, ty + 3 + awkward, 5, 8, k.topD);
      hand(5, ty + 11); hand(19, ty + 2 + awkward);
      rod(20, ty + 3 + awkward); rod(23, ty - 1 + awkward); rod(26, ty - 5 + awkward); rod(29, ty - 9 + awkward); rod(32, ty - 13 + awkward, 4);
      fishingLine(35, ty - 11 + awkward, 8); fishingLine(36, ty - 4 + awkward, 8);
      px(c, 34, ty + 4 + awkward, 4, 3, OUT); px(c, 35, ty + 4 + awkward, 2, 2, '#e05a4f'); px(c, 35, ty + 6 + awkward, 2, 2, '#f2efe6');
    } else {
      sleeve(1, ty + 7, 5, 6, k.topL); sleeve(17, ty + 5 + awkward, 5, 7, k.topD);
      hand(5, ty + 12); hand(19, ty + 8 + awkward);
      rod(20, ty + 9 + awkward); rod(24, ty + 7 + awkward); rod(28, ty + 4 + awkward); rod(32, ty + 1 + awkward); rod(36, ty - 2 + awkward); rod(40, ty - 4 + awkward, 4);
      fishingLine(43, ty - 2 + awkward, 4); fishingLine(45, ty + 1 + awkward, 5); fishingLine(47, ty + 5 + awkward, 6);
      px(c, 46, ty + 11 + awkward, 4, 3, OUT); px(c, 47, ty + 11 + awkward, 2, 2, '#e05a4f'); px(c, 47, ty + 13 + awkward, 2, 2, '#f2efe6');
    }
  } else if (action === 'cook') {
    sleeve(1, ty + 5, 6, 5, k.topL); sleeve(18, ty + 4 - frame * 2, 6, 5, k.topD);
    hand(7, ty + 7); hand(22, ty + 6 - frame * 2);
    px(c, 20, ty + 8 - frame * 2, 20, 1, '#a8926c');
    px(c, 27, ty + 5 - frame * 2, 8, 5, OUT);
    px(c, 28, ty + 6 - frame * 2, 6, 3, '#b87545');
    px(c, 35, ty + 6 - frame * 2, 3, 3, '#75462f');
    px(c, 26, ty + 17, 14, 5, OUT); px(c, 27, ty + 18, 12, 3, '#4d5b60');
    px(c, 29 + frame, ty + 11, 2, 7, '#8a969b');
    px(c, 32 + frame, ty + 8 - frame, 1, 3, '#e6dfcc');
    px(c, 36 - frame, ty + 10, 1, 3, '#e6dfcc');
  } else if (action === 'talk') {
    sleeve(0, ty + (frame ? 1 : 4), 5, 9, k.topL); sleeve(18, ty + (frame ? 5 : 2), 5, 8, k.topD);
    hand(2, ty + (frame ? -1 : 12)); hand(20, ty + (frame ? 13 : 10));
    px(c, 26, ty - 10 + frame, 4, 2, '#e3bb72'); px(c, 31, ty - 8 + frame, 2, 2, '#e3bb72');
  }
}
