// 效果图专用：旧桥营地剖面的 960×540 版。构图、光照、HUD 和 480×270 版一样，但每个实物按新密度重画细节，不是放大。
// 人物 48×76，衣色仍取 street-people.js 的 COLORS；头像直接用人物卡在用的 portrait。
import { portrait } from '../ui/pixel.js';

const W = 960, H = 540;
const params = new URLSearchParams(location.search);
const NIGHT = params.get('scene') !== 'day';
const SHOW_CARD = params.get('card') === '1';

function px(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function dither(c, x, y, w, h, color, step = 2, phase = 0) {
  c.fillStyle = color;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) % step; xx < w; xx += step) c.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
}
// 斜线用阶梯块拼：像素画里没有真正的斜线
function stair(c, x, y, steps, dx, dy, size, color) { for (let i = 0; i < steps; i++) px(c, x + dx * i, y + dy * i, size, size, color); }
function glow(c, x, y, r, rgb, alpha) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(0.45, `rgba(${rgb},${alpha * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
const hash = (i) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

const OUT = '#141a1f', INK = '#1c2026';
const COLORS = {
  xuan: { hair: '#1e1a1c', skin: '#ecc19a', skinD: '#d9a577', skinL: '#f3d3b2', top: '#252b2e', light: '#3c4548', dark: '#161b1e', shirt: '#30383c', pants: '#2c3138', seam: '#20242a', shoe: '#1f2226', sole: '#7b8081' },
  fan: { hair: '#d8b35d', skin: '#b98358', skinD: '#986747', skinL: '#d9a577', top: '#c69a32', light: '#e0bb57', dark: '#987028', shirt: '#467aa1', pants: '#456784', seam: '#304c67', shoe: '#b8832d', sole: '#79562c' },
  ma: { hair: '#1e1a1c', skin: '#b98358', skinD: '#986747', skinL: '#d9a577', top: '#252b2e', light: '#3c4548', dark: '#161b1e', shirt: '#252b2e', pants: '#626b70', seam: '#465056', shoe: '#d8d6cf', sole: '#737d83', shortSleeve: true },
};

function sky(c) {
  const bands = NIGHT ? ['#0a1220', '#0f1a2c', '#16263a', '#1f3249', '#2a4159'] : ['#6f7e8a', '#7b8994', '#88949c', '#97a2a8', '#a3acb0'];
  bands.forEach((col, i) => px(c, 0, i * 80, W, 81, col));
  for (let i = 0; i < 4; i++) dither(c, 0, 80 * (i + 1) - 6, W, 6, bands[i + 1], 2, i);
  if (NIGHT) dither(c, 0, 300, W, 40, '#2f4a66', 3, 1);
}

const FAR = [[0, 192, 52], [44, 160, 60], [100, 208, 48], [140, 144, 72], [208, 196, 56], [260, 128, 80], [336, 184, 52], [384, 156, 88], [468, 200, 60], [524, 140, 96], [616, 192, 56], [668, 164, 80], [744, 208, 52], [792, 148, 84], [872, 188, 60], [928, 168, 60]];
function city(c, tick) {
  const body = NIGHT ? '#111b29' : '#5c6c78', roof = NIGHT ? '#1b2a3d' : '#6d7d88', edge = NIGHT ? '#0c1420' : '#4f5e6a';
  FAR.forEach(([x, y, w], i) => {
    px(c, x, y, w, 380 - y, i % 2 ? body : (NIGHT ? '#0f1826' : '#586874')); px(c, x, y, w, 3, roof); px(c, x + w - 3, y, 3, 380 - y, edge);
    // 宽楼顶上放水箱和天线，窄楼只有一根避雷针
    if (w > 70) { px(c, x + 10, y - 12, 16, 12, '#1a2532'); px(c, x + 8, y - 14, 20, 3, '#26364a'); px(c, x + 12, y - 20, 2, 6, '#26364a'); }
    else if (w < 56) px(c, x + Math.floor(w / 2), y - 10, 1, 10, '#26364a');
    for (let wy = y + 10; wy < 352; wy += 14) for (let wx = x + 4; wx < x + w - 5; wx += 10) {
      const seed = (wx * 7 + wy * 13) % 11, floorLit = (wy * 3 + x) % 5 === 0;
      // 灭着的窗不画，亮窗按楼层成组、零星几扇更亮：密了就成星空
      if (NIGHT) {
        if (floorLit && seed < 5) { px(c, wx, wy, 4, 5, '#8c7645'); px(c, wx, wy, 4, 1, '#a68d55'); }
        else if (seed === 0 && wx % 2 === 0) { px(c, wx, wy, 4, 5, '#e6c27c'); px(c, wx, wy, 4, 1, '#f4dc9c'); if (wx % 3 === 0) px(c, wx + 1, wy, 1, 5, '#b3944e'); }
        else if (seed === 3 && wx % 5 === 0) px(c, wx, wy, 4, 5, '#b8c9d6');
        else if (seed === 5 && Math.floor(tick / 30) % 7 === wx % 7) px(c, wx, wy, 4, 5, '#e6c27c');
      } else px(c, wx, wy, 4, 5, seed < 2 ? '#8a7a55' : '#4e5c67');
    }
  });
  px(c, 532, 104, 6, 40, body); px(c, 534, 92, 2, 12, '#26364a'); px(c, 533, 90, 4, 3, NIGHT && Math.floor(tick / 20) % 2 ? '#e05a4a' : '#5a2a26');
  // 一块红色霓虹牌，夜里是远景里唯一的饱和色
  if (NIGHT) { px(c, 548, 196, 22, 8, '#8a2e26'); px(c, 550, 198, 18, 4, '#d94a3c'); px(c, 552, 199, 6, 2, '#ff8a7a'); }
  // 远处高架：护栏、灯柱、车流
  px(c, 0, 356, W, 28, NIGHT ? '#141f2b' : '#4d5a63'); px(c, 0, 356, W, 2, NIGHT ? '#2a3a4a' : '#6f7d88');
  for (let x = 6; x < W; x += 24) px(c, x, 344, 2, 12, NIGHT ? '#2a3a4a' : '#6f7d88');
  for (let x = 40; x < W; x += 96) { px(c, x, 328, 2, 28, NIGHT ? '#2a3a4a' : '#6f7d88'); px(c, x - 2, 326, 6, 3, NIGHT ? '#e6c27c' : '#7d8a90'); }
  for (let x = 0; x < W; x += 20) px(c, x, 372, 8, 1, '#1f2c38');
  if (NIGHT) {
    const cx = (tick * 3) % 1120 - 80; px(c, cx, 362, 4, 3, '#f4e6b8'); px(c, cx + 7, 362, 4, 3, '#f4e6b8'); px(c, cx - 2, 361, 16, 6, 'rgba(244,230,184,0.12)');
    const tx = 1040 - (tick * 2.2) % 1120; px(c, tx, 366, 4, 3, '#e05a4a'); px(c, tx + 7, 366, 4, 3, '#e05a4a');
  }
  c.save(); c.globalAlpha = NIGHT ? 0.32 : 0.16; dither(c, 0, 300, W, 56, NIGHT ? '#26384b' : '#aab5bb', NIGHT ? 2 : 3, 0); c.restore();
}

function rainFar(c, tick) {
  for (let i = 0; i < 80; i++) { const x = Math.floor(hash(i) * W + tick * 3) % W, y = 88 + Math.floor(hash(i + 300) * 268 + tick * 12) % 268; px(c, x, y, 1, 10, 'rgba(150,175,200,0.16)'); }
}

function ground(c) {
  px(c, 0, 384, W, 156, NIGHT ? '#2f3a42' : '#5b666c'); px(c, 0, 384, W, 4, NIGHT ? '#46525a' : '#7c8890'); px(c, 0, 388, W, 2, NIGHT ? '#3a464e' : '#6c7880');
  px(c, 0, 472, W, 68, NIGHT ? '#27313a' : '#505b62'); dither(c, 0, 460, W, 12, NIGHT ? '#27313a' : '#505b62', 2, 0);
  const crack = NIGHT ? '#202932' : '#454f56', stone = NIGHT ? '#3c4850' : '#6a757b', stoneL = NIGHT ? '#48545c' : '#7a858b';
  for (let x = 0; x < W; x += 74) {
    stair(c, x + 10, 492 + x % 9, 7, 3, 1, 2, crack); px(c, x + 30, 494 + x % 9, 10, 1, crack);
    px(c, x + 40, 428 + x % 13, 8, 3, stone); px(c, x + 41, 428 + x % 13, 6, 1, stoneL); px(c, x + 62, 516 + x % 5, 4, 3, stone);
    px(c, x + 20, 452 + x % 7, 3, 2, stone);
  }
  for (let i = 0; i < 60; i++) px(c, Math.floor(hash(i + 900) * W), 400 + Math.floor(hash(i + 950) * 130), 2, 1, i % 3 ? crack : stoneL);
  // 排水篦子
  px(c, 296, 500, 28, 8, '#1e262c'); for (let i = 0; i < 6; i++) px(c, 298 + i * 4, 501, 2, 6, '#3a464e'); px(c, 296, 500, 28, 1, '#4a565e');
  const wet = NIGHT ? '#25303a' : '#4a555c';
  px(c, 0, 384, 52, 156, wet); px(c, 920, 384, 40, 156, wet);
}

function puddle(c, x, y, w, h) {
  const col = NIGHT ? '#2c3d48' : '#6a7c86', hi = NIGHT ? '#4a6272' : '#8fa3ad';
  px(c, x, y, w, h, col); px(c, x - 8, y + 5, w + 16, h - 9, col); px(c, x + 4, y - 2, w - 12, 3, col);
  px(c, x + 6, y + 2, Math.floor(w / 3), 1, hi); px(c, x + w - 14, y + h - 4, 8, 1, hi);
}

function deck(c) {
  const under = NIGHT ? '#1f2830' : '#3d4a53', beam = NIGHT ? '#2a353e' : '#4a5760', beamL = NIGHT ? '#36434c' : '#5b6972', gap = NIGHT ? '#161d24' : '#2f3a42', rivet = NIGHT ? '#3a4650' : '#66747f';
  px(c, 52, 0, 868, 80, under);
  for (let x = 60; x < 912; x += 96) {
    px(c, x, 52, 88, 28, beam); px(c, x, 76, 88, 4, beamL); px(c, x, 52, 88, 2, gap); px(c, x + 88, 52, 8, 28, gap);
    for (let rx = x + 6; rx < x + 88; rx += 10) px(c, rx, 62, 2, 2, rivet);
    if ((x / 96) % 3 === 1) dither(c, x + 20, 56, 30, 22, '#4a3a2c', 3, 1);
  }
  px(c, 60, 0, 852, 8, NIGHT ? '#2c3740' : '#59666f');
  // 沿桥底走的一根排水管，隔一段一个卡箍
  px(c, 100, 42, 760, 8, '#2c353c'); px(c, 100, 42, 760, 2, '#3b464e'); for (let x = 120; x < 860; x += 120) px(c, x, 40, 6, 12, '#3a4650');
  px(c, 400, 8, 6, 72, '#1a2128'); px(c, 402, 8, 2, 72, '#242c34');
  px(c, 52, 0, 8, 80, NIGHT ? '#3a4650' : '#6a7780'); px(c, 912, 0, 8, 80, NIGHT ? '#3a4650' : '#6a7780'); px(c, 52, 0, 8, 6, '#4a5866'); px(c, 912, 0, 8, 6, '#4a5866');
  dither(c, 240, 60, 60, 20, gap, 3, 1); dither(c, 640, 56, 80, 24, gap, 3, 0);
}

// 桥底接缝漏雨：两处滴水，落到地上散开
function leaks(c, tick) {
  for (const [x, seed] of [[404, 0], [704, 23]]) {
    const t = (tick * 4 + seed) % 100;
    if (t < 96) px(c, x, 80 + t * 4, 2, 6, '#8fb0c4');
    else px(c, x - 4, 470, 10, 2, '#8fb0c4');
  }
}

function pillar(c, x, w) {
  const body = NIGHT ? '#4a5763' : '#7a8894', light = NIGHT ? '#5e6b77' : '#8f9da8', dark = NIGHT ? '#3a4650' : '#66747f', joint = NIGHT ? '#3f4b56' : '#6b7984';
  px(c, x, 80, w, 324, body); px(c, x + 8, 80, 6, 324, light); px(c, x + w - 12, 80, 12, 324, dark); px(c, x + w - 14, 80, 2, 324, joint);
  for (let y = 124; y < 400; y += 52) { px(c, x + 2, y, w - 4, 3, joint); px(c, x + 2, y + 3, w - 4, 1, light); }
  for (let y = 100; y < 380; y += 26) for (let tx = x + 18; tx < x + w - 14; tx += 20) px(c, tx, y, 2, 2, dark);
  for (const [sx, sy, sh] of [[x + 22, 132, 96], [x + 34, 200, 140], [x + 16, 260, 60]]) dither(c, sx, sy, 3, sh, '#43505b', 2, sx % 2);
  dither(c, x + 4, 300, w - 8, 104, dark, 3, 0); dither(c, x + 4, 370, w - 8, 34, '#3d4a44', 2, 1);
  px(c, x - 6, 392, w + 12, 16, NIGHT ? '#3c4852' : '#68767f'); px(c, x - 6, 392, w + 12, 2, NIGHT ? '#4c5862' : '#7c8890');
}

// 左柱喷漆“人在城市仍是人”：每个字 12×12 格里用 2 像素粗的笔画示意，不求认得，求看得出是字
function graffiti(c, x) {
  px(c, x + 6, 212, 40, 112, '#cfcabb'); dither(c, x + 4, 212, 2, 112, '#cfcabb', 2, 0); dither(c, x + 46, 212, 2, 112, '#cfcabb', 2, 1); dither(c, x + 6, 210, 40, 2, '#cfcabb', 2, 0);
  const ink = '#2b2b30';
  const glyphs = [
    [[5, 0, 2, 6], [3, 6, 2, 4], [7, 6, 2, 4], [1, 10, 2, 2], [9, 10, 2, 2]],
    [[0, 3, 12, 2], [5, 0, 2, 12], [2, 6, 2, 6], [6, 6, 5, 2], [6, 10, 5, 2]],
    [[0, 2, 4, 2], [1, 0, 2, 12], [5, 1, 6, 2], [5, 5, 6, 2], [5, 9, 6, 2], [9, 1, 2, 10]],
    [[5, 0, 2, 2], [0, 3, 12, 2], [2, 6, 8, 2], [2, 6, 2, 5], [8, 6, 2, 5], [5, 5, 2, 7]],
    [[1, 0, 2, 12], [4, 1, 7, 2], [9, 1, 2, 6], [5, 5, 4, 2], [5, 5, 2, 7], [9, 9, 2, 2]],
    [[1, 0, 10, 2], [1, 0, 2, 5], [9, 0, 2, 5], [1, 4, 10, 2], [0, 7, 12, 2], [5, 7, 2, 5], [1, 11, 5, 1], [7, 10, 4, 2]],
    [[5, 0, 2, 6], [3, 6, 2, 4], [7, 6, 2, 4], [1, 10, 2, 2], [9, 10, 2, 2]],
  ];
  glyphs.forEach((g, i) => { for (const [gx, gy, gw, gh] of g) px(c, x + 20 + gx, 216 + i * 15 + gy, gw, gh, ink); });
  px(c, x + 10, 222, 2, 2, '#c9443a'); stair(c, x + 8, 226, 5, 1, 2, 2, '#c9443a'); px(c, x + 12, 232, 4, 2, '#c9443a');
  px(c, x + 34, 300, 8, 2, ink); px(c, x + 32, 302, 2, 6, ink); px(c, x + 42, 302, 2, 6, ink); px(c, x + 34, 308, 8, 2, ink); px(c, x + 35, 304, 2, 2, ink); px(c, x + 39, 304, 2, 2, ink);
}

function cardboardSign(c, x) {
  px(c, x + 24, 150, 2, 18, '#a9a596'); px(c, x + 22, 148, 6, 3, '#6b6b70');
  px(c, x + 4, 168, 44, 52, '#c9b389'); px(c, x + 4, 168, 44, 2, '#a8926c'); px(c, x + 4, 216, 44, 4, '#a8926c'); px(c, x + 4, 168, 2, 52, '#b9a37b'); px(c, x + 46, 168, 2, 52, '#b09a72');
  for (let y = 172; y < 216; y += 4) px(c, x + 6, y, 40, 1, '#bfa97f');
  const ink = '#5a4633';
  const marks = [[8, 176, 10, 2], [10, 180, 2, 8], [14, 182, 6, 2], [22, 176, 8, 2], [24, 180, 4, 8], [30, 182, 6, 6], [8, 194, 12, 2], [12, 198, 4, 8], [20, 196, 2, 10], [26, 194, 12, 2], [28, 198, 8, 2], [30, 202, 4, 6], [36, 206, 4, 2], [40, 196, 2, 6], [40, 205, 2, 2]];
  for (const [mx, my, mw, mh] of marks) px(c, x + mx, my, mw, mh, ink);
  px(c, x + 40, 170, 8, 4, '#d8cfb8'); px(c, x + 4, 212, 6, 4, '#d8cfb8');
}

function streetlamp(c, x, on) {
  px(c, x, 144, 6, 328, '#4d575e'); px(c, x, 144, 2, 328, '#5c666d'); px(c, x - 6, 468, 18, 6, '#3a434a'); px(c, x - 4, 464, 14, 4, '#4d575e');
  px(c, x - 12, 132, 30, 6, '#5f6971'); px(c, x - 16, 118, 38, 16, '#5f6971'); px(c, x - 16, 118, 38, 3, '#6f7981');
  px(c, x - 12, 132, 30, 4, on ? '#e3ecf0' : '#7d878e');
}

function dryingRack(c, x, base, wet, tick) {
  px(c, x + 60, base - 176, 6, 176, '#5a4d3c'); px(c, x + 60, base - 176, 2, 176, '#6d5e4a'); px(c, x + 56, base - 4, 14, 4, '#4a3f32');
  px(c, x, base - 172, 20, 2, '#b0a088'); px(c, x + 20, base - 170, 22, 2, '#b0a088'); px(c, x + 42, base - 171, 18, 2, '#b0a088');
  for (const cx of [6, 30, 44]) { px(c, x + cx, base - 172, 4, 6, '#bdad86'); px(c, x + cx + 1, base - 170, 2, 1, '#8a7c5c'); }
  const hood = wet ? '#6f7f7b' : '#8d9b96', hoodD = wet ? '#5f6f6b' : '#7d8b86', hoodL = wet ? '#7f8f8b' : '#9dab a6'.replace(' ', ''), sock = wet ? '#8a6f5b' : '#aa8e76', towel = wet ? '#4f5f6a' : '#697c88', towelL = wet ? '#5b6e7a' : '#7a8d99';
  // 卫衣：帽子、两只袖子、口袋线，湿的颜色更深
  px(c, x + 4, base - 168, 20, 26, hood); px(c, x + 8, base - 172, 12, 6, hoodD); px(c, x, base - 168, 5, 12, hood); px(c, x + 23, base - 168, 5, 12, hood);
  px(c, x + 10, base - 168, 2, 26, hoodD); px(c, x + 18, base - 164, 1, 22, hoodD); px(c, x + 6, base - 166, 2, 20, hoodL); px(c, x + 8, base - 150, 12, 1, hoodD); px(c, x + 4, base - 144, 20, 2, hoodD);
  for (const sx of [30, 37]) { px(c, x + sx, base - 168, 6, 14, sock); px(c, x + sx, base - 158, 6, 4, wet ? '#6f5847' : '#8f745f'); px(c, x + sx, base - 166, 6, 1, '#a58a74'); }
  px(c, x + 44, base - 168, 14, 32, towel); for (let y = base - 164; y < base - 140; y += 6) px(c, x + 44, y, 14, 2, towelL); dither(c, x + 44, base - 138, 14, 3, towelL, 2, 0);
  if (!wet) return;
  for (let i = 0; i < 5; i++) { const t = (tick * 5 + i * 31) % 140; if (t < 124) px(c, x + 8 + i * 11, base - 140 + t, 1, 4, '#9ec3d6'); }
  px(c, x - 2, base - 6, 62, 6, '#3e5460'); px(c, x + 12, base - 6, 14, 1, '#6a848c'); px(c, x + 36, base - 3, 8, 1, '#6a848c');
}

function fanLying(c, x, y) {
  const k = COLORS.fan;
  c.save(); c.translate(x, y);
  // 后脑勺：黄发分几绺，有翘起来的
  px(c, 0, 0, 28, 24, OUT); px(c, 2, 2, 24, 20, k.hair); px(c, 6, 4, 2, 16, '#b8963f'); px(c, 14, 3, 2, 18, '#b8963f'); px(c, 20, 6, 2, 14, '#b8963f'); px(c, 4, 3, 6, 2, '#e6c77a'); px(c, 16, 4, 4, 1, '#e6c77a');
  px(c, 28, 4, 4, 4, OUT); px(c, 29, 5, 2, 2, k.hair); px(c, -4, 10, 4, 4, OUT); px(c, -3, 11, 2, 2, k.hair); px(c, 8, -4, 8, 4, OUT); px(c, 9, -3, 6, 2, k.hair);
  px(c, 20, 18, 8, 8, k.skinD);
  px(c, 24, 8, 28, 20, OUT); px(c, 26, 10, 24, 16, k.top); px(c, 26, 10, 12, 4, k.dark); px(c, 26, 14, 12, 1, k.light); px(c, 26, 14, 6, 10, k.light); px(c, 38, 14, 2, 10, k.dark); px(c, 46, 16, 2, 8, k.dark);
  px(c, 34, 22, 24, 10, OUT); px(c, 36, 24, 20, 6, k.top); px(c, 52, 24, 4, 6, k.dark); px(c, 44, 24, 1, 6, k.dark); px(c, 56, 25, 6, 5, k.skin); px(c, 57, 26, 1, 1, k.skinD); px(c, 59, 26, 1, 1, k.skinD);
  c.restore();
}

function bed(c, x, base, blanket, blanketL, blanketD, sleeper) {
  const w = 92;
  px(c, x - 4, base, w + 8, 4, 'rgba(0,0,0,0.3)');
  px(c, x, base - 24, 6, 24, '#4e3a2b'); px(c, x + w - 6, base - 24, 6, 24, '#4e3a2b'); px(c, x, base - 24, 2, 24, '#5e4836'); px(c, x + w - 6, base - 24, 2, 24, '#5e4836');
  px(c, x - 4, base - 48, 6, 30, '#5a4331'); px(c, x - 3, base - 46, 1, 26, '#6e5540'); for (let y = base - 44; y < base - 20; y += 8) px(c, x - 4, y, 6, 1, '#4a3627');
  px(c, x - 2, base - 34, w + 4, 10, '#7a5b3f'); px(c, x - 2, base - 34, w + 4, 2, '#96734f'); for (let gx = x + 6; gx < x + w; gx += 18) px(c, gx, base - 30, 10, 1, '#6a4e35');
  px(c, x + 2, base - 50, w - 4, 16, '#b5aa8e'); px(c, x + 2, base - 50, w - 4, 3, '#cbc0a5'); px(c, x + 2, base - 42, w - 4, 1, '#a59a7e'); dither(c, x + 40, base - 44, 20, 8, '#a89d82', 3, 0);
  px(c, x + 6, base - 60, 30, 12, '#d8d2bf'); px(c, x + 6, base - 50, 30, 2, '#b3ac98'); px(c, x + 12, base - 56, 18, 1, '#c4bda9'); px(c, x + 8, base - 58, 4, 2, '#e6e0cd');
  if (sleeper) sleeper(c, x + 4, base - 72);
  const top = base - 62;
  const bx = sleeper ? x + 40 : x + 24, bw = sleeper ? 40 : w - 38;
  px(c, bx, top + 2, bw, 14, blanket); px(c, bx, top + 2, bw, 2, blanketL); px(c, bx, top + 13, bw, 3, blanketD);
  stair(c, bx + 8, top + 4, 5, 1, 2, 2, blanketD); stair(c, bx + 20, top + 3, 6, 1, 2, 2, blanketL); stair(c, bx + 30, top + 5, 4, 1, 2, 2, blanketD); px(c, bx + bw - 6, top + 4, 1, 10, blanketD);
  if (sleeper) {
    const k = COLORS.fan;
    px(c, x + 78, top + 2, 14, 14, OUT); px(c, x + 80, top + 4, 10, 10, k.shoe); px(c, x + 80, top + 12, 10, 2, k.sole); px(c, x + 82, top + 6, 6, 1, '#d09a3e'); px(c, x + 83, top + 8, 4, 1, '#d09a3e'); px(c, x + 80, top + 4, 10, 1, '#986d24');
  } else {
    px(c, x + 60, top - 8, 26, 10, blanketL); px(c, x + 60, top - 8, 26, 2, blanket); px(c, x + 60, top - 4, 26, 1, blanketD); px(c, x + 62, top - 2, 22, 1, blanketD);
    px(c, x + 30, top - 4, 16, 6, '#8a6f5b'); px(c, x + 31, top - 3, 14, 3, '#d7cbb1'); px(c, x + 31, top, 14, 1, '#c4b89e');
  }
}

function floorSheet(c, x, base) {
  px(c, x, base - 10, 72, 10, '#5c564b'); px(c, x, base - 10, 72, 2, '#6f685b'); dither(c, x + 2, base - 7, 68, 6, '#66604f', 4, 0);
  px(c, x + 4, base - 22, 52, 14, '#7e8583'); px(c, x + 4, base - 22, 52, 2, '#98a09d'); px(c, x + 4, base - 10, 52, 2, '#636a68');
  stair(c, x + 14, base - 20, 6, 1, 2, 2, '#636a68'); stair(c, x + 30, base - 21, 5, -1, 2, 2, '#98a09d'); stair(c, x + 42, base - 19, 5, 1, 2, 2, '#636a68'); px(c, x + 50, base - 24, 8, 4, '#98a09d');
  px(c, x + 54, base - 24, 18, 16, '#8a7a62'); px(c, x + 56, base - 22, 14, 12, '#a08e72'); px(c, x + 58, base - 20, 10, 2, '#b8a684'); px(c, x + 60, base - 18, 6, 6, '#6d5f4a'); px(c, x + 62, base - 16, 2, 2, '#8a7a62'); px(c, x + 54, base - 14, 18, 2, '#6d5f4a');
}

function crates(c, x, base) {
  const box = '#7a6247', boxD = '#5c4834', boxL = '#96795a', grain = '#6b5540', nail = '#4a3a2a';
  px(c, x - 4, base, 84, 4, 'rgba(0,0,0,0.3)');
  px(c, x, base - 44, 76, 44, boxD);
  for (let i = 0; i < 3; i++) { const y = base - 42 + i * 14; px(c, x + 2, y, 72, 12, box); px(c, x + 2, y, 72, 1, boxL); px(c, x + 10, y + 6, 20, 1, grain); px(c, x + 44, y + 4, 18, 1, grain); px(c, x + 4, y + 2, 2, 2, nail); px(c, x + 70, y + 2, 2, 2, nail); }
  px(c, x + 36, base - 42, 4, 40, boxD); px(c, x + 2, base - 42, 4, 40, '#6a5340'); px(c, x + 70, base - 42, 4, 40, '#6a5340');
  px(c, x + 12, base - 34, 22, 14, '#d7cbb1'); px(c, x + 14, base - 31, 16, 2, '#5a4633'); px(c, x + 14, base - 27, 12, 2, '#5a4633'); px(c, x + 14, base - 23, 18, 1, '#5a4633');
  px(c, x + 52, base - 32, 10, 10, '#c9443a'); px(c, x + 54, base - 30, 6, 6, '#e6dfcc'); px(c, x + 56, base - 28, 2, 2, '#c9443a');
  px(c, x + 44, base - 18, 22, 8, '#e6dfcc'); for (let i = 0; i < 9; i++) px(c, x + 46 + i * 2, base - 16, 1, i % 3 ? 4 : 5, INK); px(c, x + 44, base - 18, 22, 1, '#3a5a94');
  // 上面那箱盖子半开，里面几个罐头和一个塑料袋
  px(c, x + 8, base - 80, 60, 36, boxD); px(c, x + 10, base - 78, 56, 32, box); px(c, x + 10, base - 78, 56, 1, boxL); px(c, x + 10, base - 62, 56, 1, boxD); px(c, x + 12, base - 70, 18, 1, grain); px(c, x + 40, base - 56, 20, 1, grain);
  px(c, x + 12, base - 76, 52, 8, '#2a2320');
  for (const [cx, col] of [[16, '#c9443a'], [28, '#3a5a94'], [40, '#9aa3a6']]) { px(c, x + cx, base - 77, 8, 7, '#9aa3a6'); px(c, x + cx, base - 75, 8, 3, col); px(c, x + cx, base - 77, 8, 1, '#c4cccd'); }
  px(c, x + 52, base - 76, 10, 6, '#d8d2bf'); px(c, x + 54, base - 78, 6, 3, '#e6e0cd');
  stair(c, x + 6, base - 84, 6, 10, -1, 2, boxL); px(c, x + 6, base - 86, 62, 3, box); px(c, x + 6, base - 86, 62, 1, boxL);
  // 收音机：喇叭网、刻度盘、两个旋钮、歪着的天线、提手
  px(c, x + 24, base - 106, 36, 18, '#3a3f44'); px(c, x + 24, base - 106, 36, 2, '#555b61'); px(c, x + 24, base - 90, 36, 2, '#2a2e32');
  dither(c, x + 27, base - 102, 14, 10, '#262a2e', 2, 0); px(c, x + 46, base - 102, 8, 6, '#d7cbb1'); px(c, x + 47, base - 100, 6, 1, '#7a3f34'); px(c, x + 50, base - 101, 1, 4, '#c9443a');
  px(c, x + 44, base - 94, 3, 3, '#8a969b'); px(c, x + 50, base - 94, 3, 3, '#8a969b'); px(c, x + 56, base - 95, 2, 2, '#7fe07a');
  stair(c, x + 54, base - 126, 10, 0, 2, 2, '#9aa3a6'); stair(c, x + 54, base - 130, 2, 1, 2, 2, '#9aa3a6'); px(c, x + 34, base - 110, 16, 2, '#555b61'); px(c, x + 34, base - 110, 2, 4, '#555b61'); px(c, x + 48, base - 110, 2, 4, '#555b61');
}

function parcel(c, x, base) {
  px(c, x - 2, base, 52, 4, 'rgba(0,0,0,0.3)');
  px(c, x, base - 56, 48, 56, '#7d6144'); px(c, x + 2, base - 54, 44, 52, '#a17f5a'); px(c, x + 2, base - 54, 44, 2, '#b8956c'); px(c, x + 2, base - 54, 2, 52, '#b08a62'); px(c, x + 44, base - 54, 2, 52, '#8c6c4a');
  px(c, x + 20, base - 54, 7, 52, '#d8cfb8'); px(c, x + 2, base - 32, 44, 6, '#d8cfb8'); px(c, x + 20, base - 54, 1, 52, '#c4bba4'); px(c, x + 2, base - 32, 44, 1, '#c4bba4');
  px(c, x + 29, base - 50, 14, 12, '#e6dfcc'); px(c, x + 31, base - 47, 10, 1, '#5a4633'); px(c, x + 31, base - 44, 8, 1, '#5a4633'); for (let i = 0; i < 5; i++) px(c, x + 31 + i * 2, base - 41, 1, 2, INK);
  stair(c, x + 4, base - 20, 4, 1, 1, 1, '#8c6c4a'); px(c, x + 6, base - 10, 10, 1, '#8c6c4a');
  px(c, x + 14, base - 62, 20, 2, '#6b5a44'); px(c, x + 14, base - 62, 2, 8, '#6b5a44'); px(c, x + 32, base - 62, 2, 8, '#6b5a44');
}

function smoke(c, x, y, tick, strength = 1, seed = 0) {
  for (let i = 0; i < 10; i++) {
    const t = ((tick * 1.4 + i * 8 + seed) % 80) / 80;
    const sx = x + Math.round(Math.sin(t * 5 + i) * (3 + t * 12)) + Math.round(t * 6);
    const s = t < 0.3 ? 2 : t < 0.65 ? 3 : 5;
    c.save(); c.globalAlpha = Math.max(0, 0.6 - t * 0.6) * strength; px(c, sx, y - t * 120, s, s, t > 0.4 ? '#8e9797' : '#aeb6b6'); c.restore();
  }
}

function drum(c, x, base, lit, tick) {
  px(c, x - 6, base, 60, 4, 'rgba(0,0,0,0.35)');
  px(c, x, base - 56, 48, 56, '#3a3a3a'); px(c, x + 3, base - 53, 42, 50, '#4d4740'); px(c, x + 3, base - 53, 6, 50, '#5a544c');
  // 锈：三块抖动的锈斑，中心更亮
  dither(c, x + 6, base - 48, 16, 14, '#6b4a2e', 2, 0); dither(c, x + 26, base - 34, 18, 20, '#6b4a2e', 2, 1); dither(c, x + 8, base - 22, 14, 16, '#6b4a2e', 2, 0);
  px(c, x + 10, base - 44, 6, 4, '#8a5a30'); px(c, x + 32, base - 26, 6, 6, '#8a5a30'); px(c, x + 12, base - 16, 4, 4, '#8a5a30');
  for (const ry of [base - 56, base - 38, base - 20, base - 3]) { px(c, x, ry, 48, 3, '#5c5650'); px(c, x, ry, 48, 1, '#7a746e'); }
  stair(c, x + 20, base - 50, 5, 1, 1, 1, '#2a2623'); stair(c, x + 36, base - 14, 4, -1, 1, 1, '#2a2623');
  px(c, x + 10, base - 34, 8, 12, '#1e1a18'); px(c, x + 30, base - 34, 8, 12, '#1e1a18');
  px(c, x - 4, base - 2, 56, 2, '#2a2623'); dither(c, x - 8, base - 4, 64, 4, '#4a4642', 2, 0);
  if (!lit) { px(c, x + 6, base - 60, 36, 5, '#2a2523'); px(c, x + 16, base - 62, 12, 3, '#3a2f2a'); px(c, x + 22, base - 61, 4, 2, '#5a3a2a'); smoke(c, x + 24, base - 60, tick, 0.35); return; }
  smoke(c, x + 24, base - 104, tick, 0.7, 5);
}
function flames(c, x, base, tick) {
  const f = Math.floor(tick / 4) % 3, g = Math.floor(tick / 7) % 2;
  px(c, x + 8, base - 80 - f * 2, 32, 24 + f * 2, '#c9642a'); px(c, x + 10, base - 82 - f * 2, 28, 24 + f * 2, '#e2833a');
  px(c, x + 14, base - 92 + g * 2, 20, 24, '#f1c46b'); px(c, x + 18, base - 100 + f * 2, 10, 16, '#fbe7a1'); px(c, x + 20, base - 104 + g, 6, 6, '#fff4cc');
  stair(c, x + 4 + f, base - 70, 4, 1, -2, 3, '#e2833a'); stair(c, x + 40 - f, base - 72, 4, -1, -2, 3, '#e2833a'); px(c, x + 22, base - 110 - g * 4, 4, 8, '#f1c46b'); px(c, x + 30 + f, base - 94, 3, 6, '#f1c46b');
  for (let i = 0; i < 9; i++) { const t = (tick * 3 + i * 13) % 70; px(c, x + 10 + ((i * 9 + t) % 26), base - 96 - t, 2, 2, i % 2 ? '#f1c46b' : '#ff9a4a'); }
  px(c, x + 10, base - 34, 8, 12, '#ff8a3a'); px(c, x + 30, base - 34, 8, 12, '#ff8a3a'); px(c, x + 12, base - 30, 4, 4, '#ffd27a'); px(c, x + 32, base - 28, 4, 4, '#ffd27a');
}

function cat(c, x, y, tick) {
  px(c, x - 6, y + 14, 50, 3, 'rgba(0,0,0,0.3)');
  px(c, x, y, 36, 16, '#c98b4a'); px(c, x, y, 36, 2, '#d69a56'); for (let i = 0; i < 4; i++) stair(c, x + 6 + i * 8, y + 2, 4, 1, 2, 2, '#a8703a');
  px(c, x + 4, y + 10, 26, 4, '#e6b37a'); px(c, x + 8, y + 14, 20, 2, '#e6b37a');
  px(c, x + 28, y - 8, 14, 14, '#c98b4a'); px(c, x + 29 + (Math.floor(tick / 40) % 2), y - 12, 4, 6, '#c98b4a'); px(c, x + 37, y - 12, 4, 6, '#c98b4a'); px(c, x + 30, y - 11, 2, 3, '#d98a7a'); px(c, x + 38, y - 11, 2, 3, '#d98a7a');
  px(c, x + 32, y - 2, 4, 1, '#2b2b30'); px(c, x + 39, y - 1, 3, 2, '#d98a7a'); px(c, x + 42, y, 5, 1, '#e6dfcc'); px(c, x + 42, y + 3, 5, 1, '#e6dfcc'); px(c, x + 31, y - 5, 3, 1, '#a8703a');
  stair(c, x - 12, y + 8, 6, 2, 1, 3, '#c98b4a'); px(c, x - 14, y + 6, 4, 4, '#a8703a');
}

function stool(c, x, base) { px(c, x, base - 28, 28, 6, '#6e5a44'); px(c, x, base - 28, 28, 2, '#8a7355'); px(c, x + 2, base - 22, 4, 22, '#4e3f30'); px(c, x + 22, base - 22, 4, 22, '#4e3f30'); px(c, x + 12, base - 22, 4, 22, '#4e3f30'); px(c, x + 4, base - 12, 20, 2, '#4e3f30'); }

function table(c, x, base, lampOn) {
  px(c, x + 4, base - 52, 6, 52, '#514636'); px(c, x + 78, base - 52, 6, 52, '#514636'); px(c, x + 4, base - 28, 80, 3, '#514636'); px(c, x + 6, base - 52, 2, 52, '#655847'); px(c, x + 80, base - 52, 2, 52, '#655847');
  px(c, x, base - 60, 88, 8, '#8a7355'); px(c, x, base - 60, 88, 2, '#a98c68'); px(c, x, base - 54, 88, 2, '#6e5a44'); px(c, x + 30, base - 58, 1, 4, '#6e5a44'); px(c, x + 58, base - 58, 1, 4, '#6e5a44');
  // 零件盘、钳子、杯子
  px(c, x + 8, base - 66, 28, 6, '#3a4247'); px(c, x + 8, base - 66, 28, 1, '#555b61'); for (let i = 0; i < 5; i++) px(c, x + 11 + i * 5, base - 64, 2, 2, '#9aa3a6');
  px(c, x + 40, base - 64, 12, 3, '#7d8a90'); px(c, x + 50, base - 66, 6, 2, '#c9443a'); px(c, x + 50, base - 62, 6, 2, '#c9443a');
  px(c, x + 60, base - 72, 10, 12, '#6b7f8a'); px(c, x + 70, base - 70, 3, 6, '#6b7f8a'); px(c, x + 61, base - 71, 8, 2, '#4f5f6a'); px(c, x + 62, base - 66, 2, 4, '#8fa3ad');
  // 台灯：底座、两段臂、灯罩
  px(c, x + 70, base - 64, 16, 4, '#2b3338'); px(c, x + 76, base - 96, 4, 32, '#8a9096'); px(c, x + 77, base - 96, 1, 32, '#b3b8bc'); stair(c, x + 70, base - 100, 4, 2, 1, 4, '#8a9096');
  px(c, x + 58, base - 108, 24, 8, '#2b3338'); px(c, x + 56, base - 102, 28, 3, '#2b3338'); px(c, x + 60, base - 106, 20, 2, '#3e4a52');
  px(c, x + 58, base - 99, 24, 2, lampOn ? '#fff1c4' : '#5a6268');
}

// 轩哥坐在凳子上弯腰修东西（朝右）：上半身分两段错位表示前倾，头压到桌面高度，手里螺丝刀和线路板
function xuanBent(c, x, y) {
  const k = COLORS.xuan;
  c.save(); c.translate(x, y);
  px(c, 2, 74, 58, 4, 'rgba(10,18,24,0.45)');
  px(c, 8, 50, 30, 14, OUT); px(c, 10, 52, 26, 10, k.pants); px(c, 10, 54, 26, 1, k.seam); px(c, 26, 58, 16, 16, OUT); px(c, 28, 60, 12, 12, k.pants); px(c, 29, 62, 1, 8, k.seam);
  px(c, 24, 68, 22, 10, OUT); px(c, 26, 70, 18, 6, k.shoe); px(c, 26, 76, 18, 1, k.sole); px(c, 28, 71, 8, 1, '#4a5257'); px(c, 38, 72, 4, 2, '#3a4045'); px(c, 16, 70, 10, 6, k.shoe); px(c, 16, 76, 10, 1, k.sole);
  px(c, 6, 40, 34, 18, OUT); px(c, 8, 42, 30, 14, k.top); px(c, 8, 42, 8, 14, k.light); px(c, 30, 42, 8, 14, k.dark);
  px(c, 12, 26, 34, 18, OUT); px(c, 14, 28, 30, 16, k.top); px(c, 14, 28, 8, 16, k.light); px(c, 36, 28, 8, 16, k.dark);
  px(c, 22, 30, 3, 26, k.shirt); px(c, 23, 34, 1, 1, '#778387'); px(c, 23, 40, 1, 1, '#778387'); px(c, 23, 46, 1, 1, '#778387'); px(c, 23, 52, 1, 1, '#778387');
  px(c, 26, 26, 14, 4, '#778387'); px(c, 28, 30, 10, 1, '#5f6a6e'); px(c, 17, 36, 2, 10, '#1c2226'); px(c, 34, 46, 1, 8, '#1c2226');
  // 两条手臂伸向桌面：远的那只握住线路板，近的那只拿螺丝刀
  px(c, 34, 42, 16, 8, OUT); px(c, 36, 44, 12, 4, k.dark); px(c, 46, 46, 8, 6, OUT); px(c, 47, 47, 6, 4, k.skinD);
  px(c, 38, 34, 18, 8, OUT); px(c, 40, 36, 14, 4, k.light); px(c, 40, 39, 14, 1, k.dark); px(c, 50, 38, 10, 14, OUT); px(c, 52, 40, 6, 8, k.light); px(c, 52, 46, 6, 2, k.dark); px(c, 52, 48, 8, 6, k.skin); px(c, 54, 49, 1, 1, k.skinD); px(c, 56, 49, 1, 1, k.skinD);
  px(c, 56, 54, 6, 3, '#c9443a'); px(c, 62, 55, 10, 1, '#8a969b'); px(c, 71, 54, 2, 3, '#8a969b');
  px(c, 44, 52, 18, 8, '#3a4a2e'); px(c, 45, 53, 16, 6, '#5a7a44'); for (let i = 0; i < 4; i++) px(c, 47 + i * 4, 55, 2, 2, '#c4cccd'); px(c, 46, 58, 14, 1, '#8a969b');
  // 头低到桌面：脸朝右下，只看得见半张脸
  const hx = 20, hy = 6;
  px(c, hx, hy, 28, 26, OUT); px(c, hx + 2, hy + 8, 24, 16, k.skin); px(c, hx + 2, hy + 21, 24, 3, k.skinD); px(c, hx + 5, hy + 10, 6, 3, k.skinL);
  px(c, hx + 2, hy + 2, 24, 8, k.hair); px(c, hx, hy + 4, 4, 12, k.hair); px(c, hx + 24, hy + 4, 4, 10, k.hair); px(c, hx + 2, hy + 9, 12, 2, k.hair); px(c, hx + 16, hy + 9, 10, 1, k.hair); px(c, hx + 6, hy + 3, 8, 1, '#3a3236');
  px(c, hx - 2, hy + 14, 3, 6, k.skin); px(c, hx - 2, hy + 16, 1, 2, k.skinD);
  px(c, hx + 10, hy + 13, 5, 2, k.hair); px(c, hx + 19, hy + 13, 5, 2, k.hair); px(c, hx + 11, hy + 16, 4, 2, INK); px(c, hx + 20, hy + 16, 4, 2, INK); px(c, hx + 11, hy + 16, 1, 1, '#f2efe6'); px(c, hx + 20, hy + 16, 1, 1, '#f2efe6');
  px(c, hx + 17, hy + 17, 2, 4, k.skinD); px(c, hx + 15, hy + 22, 6, 1, '#7a3f34');
  c.restore();
}

// 马哥站着叼烟、手插兜（朝右）：短袖露小臂，前臂折进牛仔裤口袋，胡茬、看向火那边
function maStanding(c, x, y, tick) {
  const k = COLORS.ma;
  c.save(); c.translate(x, y);
  px(c, 2, 74, 46, 4, 'rgba(10,18,24,0.45)');
  for (const lx of [8, 26]) {
    px(c, lx, 50, 14, 22, OUT); px(c, lx + 2, 52, 10, 18, k.pants); px(c, lx + 2, 54, 1, 16, k.seam); px(c, lx + 11, 54, 1, 16, k.seam); px(c, lx + 4, 60, 6, 1, k.seam); px(c, lx + 3, 56, 1, 4, '#7a848a');
  }
  px(c, 10, 50, 28, 3, k.seam); px(c, 12, 50, 4, 2, '#8a9298'); px(c, 24, 50, 4, 2, '#8a9298');
  for (const sx of [5, 25]) {
    px(c, sx, 68, 18, 10, OUT); px(c, sx + 2, 70, 14, 6, k.shoe); px(c, sx + 2, 76, 14, 1, k.sole); px(c, sx + 2, 73, 6, 3, '#c4c2bb'); px(c, sx + 8, 71, 1, 1, '#9aa0a3'); px(c, sx + 10, 72, 1, 1, '#9aa0a3'); px(c, sx + 12, 73, 1, 1, '#9aa0a3'); px(c, sx + 2, 75, 14, 1, '#b9b7b0');
  }
  px(c, 6, 24, 36, 30, OUT); px(c, 8, 26, 32, 26, k.top); px(c, 8, 26, 8, 22, k.light); px(c, 32, 26, 8, 26, k.dark);
  px(c, 18, 26, 12, 4, k.dark); px(c, 19, 27, 10, 1, k.light); px(c, 22, 30, 4, 3, k.skinD); px(c, 8, 50, 32, 2, k.dark); px(c, 21, 36, 1, 12, '#1c2226'); px(c, 12, 44, 6, 1, k.light);
  // 手臂：短袖，前臂朝内折进兜里，兜口用裤色压住手
  px(c, 0, 27, 10, 12, OUT); px(c, 2, 29, 6, 8, k.top); px(c, 2, 36, 6, 1, k.dark); px(c, 2, 37, 6, 8, k.skin); px(c, 3, 44, 8, 8, OUT); px(c, 4, 45, 6, 6, k.skin); px(c, 5, 49, 8, 4, OUT); px(c, 6, 50, 6, 3, k.pants);
  px(c, 38, 27, 10, 12, OUT); px(c, 40, 29, 6, 8, k.top); px(c, 40, 36, 6, 1, k.dark); px(c, 40, 37, 6, 8, k.skin); px(c, 37, 44, 8, 8, OUT); px(c, 38, 45, 6, 6, k.skin); px(c, 35, 49, 8, 4, OUT); px(c, 36, 50, 6, 3, k.pants);
  px(c, 10, 0, 28, 26, OUT); px(c, 12, 8, 24, 16, k.skin); px(c, 12, 21, 24, 3, k.skinD); px(c, 15, 10, 6, 3, k.skinL);
  px(c, 12, 2, 24, 8, k.hair); px(c, 10, 4, 4, 10, k.hair); px(c, 34, 4, 4, 8, k.hair); px(c, 12, 9, 24, 1, k.hair); px(c, 12, 10, 4, 1, k.hair);
  px(c, 8, 12, 3, 6, k.skin); px(c, 37, 12, 3, 6, k.skin); px(c, 9, 14, 1, 2, k.skinD);
  dither(c, 14, 18, 20, 5, '#8a6242', 2, 0);
  px(c, 17, 11, 6, 2, k.hair); px(c, 28, 11, 6, 2, k.hair); px(c, 18, 14, 4, 3, INK); px(c, 29, 14, 4, 3, INK); px(c, 19, 14, 1, 1, '#f2efe6'); px(c, 30, 14, 1, 1, '#f2efe6');
  px(c, 25, 15, 2, 4, k.skinD); px(c, 24, 20, 6, 1, '#7a3f34');
  px(c, 30, 19, 3, 2, '#d8b58a'); px(c, 33, 19, 7, 2, '#ece4d3'); px(c, 40, 19, 2, 2, Math.floor(tick / 6) % 10 < 2 ? '#ffb36a' : '#ff7a3a');
  c.restore();
}

function artBoard(c, x, y) {
  px(c, x, y, 80, 128, '#3d3227'); px(c, x + 4, y + 4, 72, 120, '#5a4a3a'); px(c, x, y, 80, 3, '#6f5c48'); px(c, x, y, 3, 128, '#4d3f31'); for (let gy = y + 24; gy < y + 124; gy += 24) px(c, x + 4, gy, 72, 1, '#4d3f31');
  const paper = (ax, ay, w, h, draw) => { px(c, ax + 2, ay + 2, w, h, 'rgba(0,0,0,0.25)'); px(c, ax, ay, w, h, '#d7cbb1'); px(c, ax, ay, w, 1, '#b7ae98'); px(c, ax, ay + h - 1, w, 1, '#c4b89e'); px(c, ax + Math.floor(w / 2) - 2, ay - 2, 4, 4, '#2b2b30'); px(c, ax + Math.floor(w / 2) - 1, ay - 1, 2, 2, '#8a969b'); draw(ax, ay); };
  // 三个人：黑衬衫、黄外套、黑短袖
  paper(x + 8, y + 12, 28, 36, (a, b) => {
    for (const [fx, hair, top, pants] of [[4, '#1e1a1c', '#252b2e', '#2c3138'], [11, '#d8b35d', '#c69a32', '#456784'], [18, '#1e1a1c', '#252b2e', '#626b70']]) {
      px(c, a + fx, b + 8, 6, 5, '#b98358'); px(c, a + fx, b + 6, 6, 3, hair); px(c, a + fx - 1, b + 13, 8, 9, top); px(c, a + fx, b + 22, 6, 7, pants); px(c, a + fx + 1, b + 10, 1, 1, '#2b2b30'); px(c, a + fx + 4, b + 10, 1, 1, '#2b2b30');
    }
    px(c, a + 3, b + 30, 22, 1, '#5a4633'); px(c, a + 4, b + 2, 3, 1, '#5a4633'); px(c, a + 20, b + 3, 4, 1, '#5a4633');
  });
  // 桥和火
  paper(x + 42, y + 12, 28, 36, (a, b) => {
    px(c, a + 2, b + 6, 24, 3, '#5a4633'); px(c, a + 5, b + 9, 3, 18, '#5a4633'); px(c, a + 20, b + 9, 3, 18, '#5a4633'); px(c, a + 2, b + 27, 24, 1, '#5a4633');
    px(c, a + 11, b + 20, 6, 6, '#5a4633'); px(c, a + 12, b + 15, 4, 5, '#e2833a'); px(c, a + 13, b + 12, 2, 3, '#f1c46b'); stair(c, a + 15, b + 8, 3, 1, -2, 1, '#8e9797');
    for (let i = 0; i < 4; i++) px(c, a + 4 + i * 6, b + 30, 2, 2, '#5a4633');
  });
  // 自画像：黄发、蓝 T 恤
  paper(x + 22, y + 62, 36, 50, (a, b) => {
    px(c, a + 12, b + 10, 12, 16, '#b98358'); px(c, a + 13, b + 9, 10, 1, '#b98358'); px(c, a + 13, b + 26, 10, 1, '#b98358'); px(c, a + 11, b + 12, 1, 12, '#b98358'); px(c, a + 24, b + 12, 1, 12, '#b98358');
    px(c, a + 10, b + 6, 16, 6, '#d8b35d'); px(c, a + 9, b + 8, 2, 8, '#d8b35d'); px(c, a + 25, b + 7, 2, 7, '#d8b35d'); px(c, a + 14, b + 4, 5, 2, '#d8b35d'); px(c, a + 21, b + 3, 4, 3, '#d8b35d');
    px(c, a + 14, b + 16, 2, 2, '#2b2b30'); px(c, a + 20, b + 16, 2, 2, '#2b2b30'); px(c, a + 16, b + 22, 4, 1, '#7a3f34'); px(c, a + 17, b + 19, 1, 2, '#986747');
    px(c, a + 8, b + 28, 20, 14, '#467aa1'); px(c, a + 14, b + 27, 8, 3, '#d7cbb1'); px(c, a + 4, b + 30, 5, 10, '#467aa1'); px(c, a + 27, b + 30, 5, 10, '#467aa1');
    px(c, a + 26, b + 44, 6, 1, '#5a4633'); px(c, a + 28, b + 42, 2, 5, '#5a4633');
  });
  px(c, x + 70, y + 60, 1, 30, '#a9a596'); px(c, x + 68, y + 90, 5, 14, '#e3bb72'); px(c, x + 68, y + 104, 5, 3, '#2b2b30'); px(c, x + 69, y + 88, 3, 2, '#d98a7a');
}

function rainNear(c, tick) {
  for (let i = 0; i < 120; i++) {
    const strip = i % 2 ? [0, 52] : [920, 40];
    const x = strip[0] + Math.floor(hash(i) * strip[1] + tick * 1.4) % strip[1], y = Math.floor(hash(i + 100) * 500 + tick * 18) % 500;
    px(c, x, y, 1, 14 + (i % 3) * 3, 'rgba(200,215,230,0.55)');
  }
  for (let i = 0; i < 12; i++) {
    const t = (tick + i * 5) % 16, x = i < 6 ? 6 + i * 8 : 924 + (i - 6) * 6, y = 498 + i % 3 * 6;
    if (t < 8) { px(c, x - Math.floor(t / 2), y - (t < 5 ? t : 0), 3, 2, 'rgba(200,215,230,0.6)'); px(c, x + 4 + Math.floor(t / 2), y - (t < 5 ? t : 0), 3, 2, 'rgba(200,215,230,0.6)'); }
  }
}

function lighting(c, tick) {
  if (!NIGHT) { px(c, 0, 0, W, H, 'rgba(200,212,220,0.13)'); return; }
  px(c, 0, 0, W, H, 'rgba(12,26,54,0.46)');
  const fl = 0.42 + 0.06 * Math.sin(tick / 3) + 0.03 * Math.sin(tick / 1.3);
  glow(c, 704, 428, 340, '255,140,60', fl * 0.75); glow(c, 704, 392, 80, '255,170,90', fl * 0.55);
  // 台灯：一个光斑加一个朝下的光锥
  glow(c, 872, 416, 68, '255,225,170', 0.42);
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,225,170,0.10)'; c.beginPath(); c.moveTo(862, 402); c.lineTo(886, 402); c.lineTo(904, 446); c.lineTo(836, 446); c.closePath(); c.fill(); c.restore();
  glow(c, 26, 144, 96, '170,195,225', 0.33); glow(c, 60, 260, 340, '110,140,185', 0.16);
  glow(c, 549, 436, 20, '120,240,120', 0.1);
}

let noiseCanvas = null;
function grain(c) {
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas'); noiseCanvas.width = W; noiseCanvas.height = H;
    const nc = noiseCanvas.getContext('2d'), img = nc.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.floor(hash(i) * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    nc.putImageData(img, 0, 0);
  }
  c.save(); c.globalAlpha = NIGHT ? 0.07 : 0.05; c.drawImage(noiseCanvas, 0, 0); c.restore();
  const v = c.createRadialGradient(480, 300, 220, 480, 300, 660);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, NIGHT ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.3)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

export function drawScene(c, tick) {
  c.imageSmoothingEnabled = false;
  sky(c); city(c, tick);
  if (NIGHT) rainFar(c, tick);
  ground(c);
  puddle(c, 8, 480, 40, 24); puddle(c, 924, 488, 32, 20); puddle(c, 696, 508, 48, 12); puddle(c, 396, 466, 20, 8);
  deck(c);
  streetlamp(c, 24, NIGHT);
  pillar(c, 80, 52); pillar(c, 844, 52); graffiti(c, 80); cardboardSign(c, 844);
  dryingRack(c, 132, 472, NIGHT, tick);
  bed(c, 200, 464, '#4a6890', '#6484ad', '#3b5677', fanLying);
  bed(c, 308, 464, '#7a3d3d', '#9a5252', '#5c2e2e', null);
  floorSheet(c, 420, 480);
  crates(c, 492, 472);
  parcel(c, 568, 472);
  artBoard(c, 804, 304);
  table(c, 804, 500, NIGHT);
  stool(c, 760, 500); xuanBent(c, 748, 424);
  drum(c, 680, 496, NIGHT, tick);
  maStanding(c, 612, 420, tick);
  cat(c, 644, 504, tick);
  if (NIGHT) { dither(c, 18, 482, 12, 20, '#7f9bb3', 2, tick % 2); dither(c, 704, 510, 32, 8, '#d9853f', 2, tick % 2); leaks(c, tick); }
  lighting(c, tick);
  if (NIGHT) { flames(c, 680, 496, tick); px(c, 862, 401, 24, 2, '#fff1c4'); px(c, 548, 377, 2, 2, '#7fe07a'); px(c, 12, 132, 30, 4, '#eef4f6'); }
  if (NIGHT) rainNear(c, tick);
  grain(c);
}

export function itemIcon(c, kind) {
  if (kind === 'can') { px(c, 6, 3, 12, 18, '#9aa3a6'); px(c, 6, 3, 12, 2, '#c4cccd'); px(c, 6, 19, 12, 2, '#6f787b'); px(c, 6, 8, 12, 8, '#c9443a'); px(c, 8, 10, 8, 2, '#f2e2a8'); px(c, 8, 13, 5, 1, '#f2e2a8'); }
  else { px(c, 4, 7, 16, 10, '#e6dfcc'); px(c, 4, 7, 16, 1, '#f6f1e4'); px(c, 4, 16, 16, 1, '#b7ae98'); px(c, 9, 7, 6, 10, '#d3c9b3'); px(c, 11, 10, 2, 4, '#e57e6b'); px(c, 10, 11, 4, 2, '#e57e6b'); }
}

function mount() {
  const canvas = document.getElementById('scene');
  const c = canvas.getContext('2d');
  let tick = 0;
  const loop = () => { drawScene(c, tick++); requestAnimationFrame(loop); };
  loop();
  for (const el of document.querySelectorAll('.portrait[data-who]')) portrait(el, el.dataset.who, el.dataset.mood);
  for (const el of document.querySelectorAll('.hotslot-art[data-kind]')) itemIcon(el.getContext('2d'), el.dataset.kind);
  // 整数倍按视口宽取：1920 宽是 2 倍铺满；多出的高度贴底裁上边
  const scale = Math.max(1, Math.floor(innerWidth / W));
  const box = document.querySelector('.mock-canvas');
  box.style.width = `${W * scale}px`; box.style.height = `${H * scale}px`;
  for (const tag of document.querySelectorAll('.mock-tag')) { tag.style.left = `${tag.dataset.lx * scale}px`; tag.style.top = `${tag.dataset.ly * scale}px`; }
  document.body.classList.toggle('is-day', !NIGHT);
  document.querySelector('.night-card').hidden = !SHOW_CARD;
  document.querySelector('.mock-scrim').hidden = !SHOW_CARD;
  for (const tag of document.querySelectorAll('.mock-tag')) tag.hidden = SHOW_CARD;
  for (const el of document.querySelectorAll('[data-night]')) el.textContent = NIGHT ? el.dataset.night : el.dataset.day;
}

mount();
