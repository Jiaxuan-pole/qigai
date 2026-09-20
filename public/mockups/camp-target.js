// 效果图专用：旧桥营地剖面。独立于 ui/ 的像素管线，只为讨论目标画面，不接引擎、不接存档。
// 人物按街景在用的 24×38 规格（street-people.js 的 streetSprite）和它的 COLORS 画，姿态按交办单自画：
// 现成 streetSprite 没有「坐着弯腰修」「叼烟插兜」两个 pose，睡姿剪影又是正面朝镜头的。头像直接用人物卡在用的 portrait。
import { portrait } from '../ui/pixel.js';
const W = 480, H = 270;
const params = new URLSearchParams(location.search);
const NIGHT = params.get('scene') !== 'day';
const SHOW_CARD = params.get('card') === '1';

function px(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function dither(c, x, y, w, h, color, step = 2, phase = 0) {
  c.fillStyle = color;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) % step; xx < w; xx += step) c.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
}
// 柔光只给火、台灯、路灯：加法叠色才像“光打在东西上”，其余全部硬边像素。
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
  bands.forEach((col, i) => px(c, 0, i * 40, W, 41, col));
  for (let i = 0; i < 4; i++) dither(c, 0, 40 * (i + 1) - 3, W, 3, bands[i + 1], 2, i);
}

const FAR = [[0, 96, 26, 90], [22, 80, 30, 110], [50, 104, 24, 80], [70, 72, 36, 120], [104, 98, 28, 90], [130, 64, 40, 130], [168, 92, 26, 100], [192, 78, 44, 116], [234, 100, 30, 90], [262, 70, 48, 124], [308, 96, 28, 96], [334, 82, 40, 110], [372, 104, 26, 86], [396, 74, 42, 120], [436, 94, 30, 96], [464, 84, 30, 106]];
function city(c, tick) {
  const body = NIGHT ? '#111b29' : '#5c6c78', roof = NIGHT ? '#1b2a3d' : '#6d7d88';
  for (const [x, y, w] of FAR) {
    px(c, x, y, w, 190 - y, body); px(c, x, y, w, 2, roof);
    for (let wy = y + 6; wy < 176; wy += 8) for (let wx = x + 3; wx < x + w - 2; wx += 6) {
      const seed = (wx * 7 + wy * 13) % 11;
      // 夜里窗灯按楼层成组亮：整层暗黄，零星几扇亮一点，别铺成星空
      const floorLit = (wy * 3 + x) % 5 === 0;
      if (NIGHT) {
        if (floorLit && seed < 7) px(c, wx, wy, 2, 3, '#8c7645');
        else if (seed === 0) px(c, wx, wy, 2, 3, '#e6c27c');
        else if (seed === 5 && Math.floor(tick / 30) % 7 === wx % 7) px(c, wx, wy, 2, 3, '#e6c27c');
      } else px(c, wx, wy, 2, 3, seed < 2 ? '#8a7a55' : '#4e5c67');
    }
  }
  px(c, 266, 52, 3, 20, body); px(c, 267, 46, 1, 6, NIGHT ? '#e05a4a' : '#8a9398');
  // 远处的高架路：栏杆、灯柱，夜里有车灯
  px(c, 0, 178, W, 14, NIGHT ? '#141f2b' : '#4d5a63'); px(c, 0, 178, W, 1, NIGHT ? '#2a3a4a' : '#6f7d88');
  for (let x = 4; x < W; x += 24) px(c, x, 171, 1, 7, NIGHT ? '#2a3a4a' : '#6f7d88');
  if (NIGHT) { const cx = (tick * 2) % 560 - 40; px(c, cx, 182, 3, 2, '#f4e6b8'); px(c, cx + 4, 182, 3, 2, '#f4e6b8'); px(c, 520 - (tick * 1.5) % 560, 184, 3, 2, '#e05a4a'); }
  // 一层薄雾把远景和营地隔开
  c.save(); c.globalAlpha = NIGHT ? 0.35 : 0.16; dither(c, 0, 150, W, 28, NIGHT ? '#26384b' : '#aab5bb', NIGHT ? 2 : 3, 0); c.restore();
}

function rainFar(c, tick) {
  for (let i = 0; i < 40; i++) { const x = Math.floor(hash(i) * W + tick * 1.5) % W, y = 44 + Math.floor(hash(i + 300) * 134 + tick * 6) % 134; px(c, x, y, 1, 5, 'rgba(150,175,200,0.16)'); }
}

function ground(c) {
  px(c, 0, 192, W, 78, NIGHT ? '#2f3a42' : '#5b666c'); px(c, 0, 192, W, 3, NIGHT ? '#46525a' : '#7c8890');
  px(c, 0, 236, W, 34, NIGHT ? '#27313a' : '#505b62'); dither(c, 0, 230, W, 6, NIGHT ? '#27313a' : '#505b62', 2, 0);
  const crack = NIGHT ? '#202932' : '#454f56', stone = NIGHT ? '#3c4850' : '#6a757b';
  for (let x = 0; x < W; x += 37) { px(c, x + 5, 246 + x % 5, 14, 1, crack); px(c, x + 20, 214 + x % 7, 6, 2, stone); px(c, x + 31, 258 + x % 3, 3, 2, crack); }
  // 桥外的地面淋着雨，颜色更深更亮
  const wet = NIGHT ? '#25303a' : '#4a555c';
  px(c, 0, 192, 26, 78, wet); px(c, 460, 192, 20, 78, wet);
}

function puddle(c, x, y, w, h) {
  const col = NIGHT ? '#2c3d48' : '#6a7c86';
  px(c, x, y, w, h, col); px(c, x - 4, y + 3, w + 8, h - 5, col); px(c, x + 4, y + 1, Math.floor(w / 3), 1, NIGHT ? '#4a6272' : '#8fa3ad');
}

function deck(c) {
  const under = NIGHT ? '#1f2830' : '#3d4a53', beam = NIGHT ? '#2a353e' : '#4a5760', beamL = NIGHT ? '#36434c' : '#5b6972', gap = NIGHT ? '#161d24' : '#2f3a42';
  px(c, 26, 0, 434, 40, under);
  for (let x = 30; x < 456; x += 48) { px(c, x, 26, 44, 14, beam); px(c, x, 38, 44, 2, beamL); px(c, x + 44, 26, 4, 14, gap); }
  px(c, 30, 0, 426, 4, NIGHT ? '#2c3740' : '#59666f');
  // 桥面外沿：竖板面，雨从它外面落下来
  px(c, 26, 0, 4, 40, NIGHT ? '#3a4650' : '#6a7780'); px(c, 456, 0, 4, 40, NIGHT ? '#3a4650' : '#6a7780');
  px(c, 200, 4, 3, 36, '#1a2128'); dither(c, 120, 30, 30, 10, gap, 3, 1); dither(c, 320, 28, 40, 12, gap, 3, 0);
}

function pillar(c, x, w) {
  const body = NIGHT ? '#4a5763' : '#7a8894', light = NIGHT ? '#5e6b77' : '#8f9da8', dark = NIGHT ? '#3a4650' : '#66747f', joint = NIGHT ? '#3f4b56' : '#6b7984';
  px(c, x, 40, w, 162, body); px(c, x + 4, 40, 5, 162, light); px(c, x + w - 6, 40, 6, 162, dark);
  for (let y = 62; y < 200; y += 26) px(c, x + 1, y, w - 2, 2, joint);
  px(c, x + 12, 66, 2, 48, joint); dither(c, x + 2, 150, w - 4, 52, dark, 3, 0);
  px(c, x - 3, 196, w + 6, 8, NIGHT ? '#3c4852' : '#68767f');
}

// 左柱涂鸦“人在城市仍是人”：一竖列七个字用色块示意；右柱挂纸板“今晚睡哪儿？”
function graffiti(c, x) {
  px(c, x + 4, 108, 20, 52, '#cfcabb'); px(c, x + 4, 108, 20, 1, '#a9a596');
  for (let i = 0; i < 7; i++) px(c, x + 7, 112 + i * 6, i === 3 ? 10 : 14, 3, '#2b2b30');
  px(c, x + 8, 154, 2, 2, '#2b2b30'); px(c, x + 16, 154, 2, 2, '#2b2b30'); px(c, x + 9, 157, 8, 1, '#2b2b30');
}
function cardboardSign(c, x) {
  px(c, x + 11, 76, 1, 8, '#a9a596'); px(c, x + 2, 84, 22, 26, '#c9b389'); px(c, x + 2, 84, 22, 1, '#a8926c'); px(c, x + 2, 108, 22, 2, '#a8926c');
  px(c, x + 5, 88, 16, 2, '#5a4633'); px(c, x + 5, 93, 12, 2, '#5a4633'); px(c, x + 5, 98, 16, 2, '#5a4633'); px(c, x + 5, 103, 8, 2, '#5a4633'); px(c, x + 17, 102, 3, 3, '#5a4633');
}

function streetlamp(c, x, on) {
  px(c, x, 72, 3, 164, '#4d575e'); px(c, x - 6, 66, 15, 6, '#5f6971'); px(c, x - 4, 72, 11, 2, on ? '#e3ecf0' : '#7d878e'); px(c, x - 1, 234, 5, 3, '#3a434a');
}

function dryingRack(c, x, base, wet, tick) {
  px(c, x + 30, base - 88, 3, 88, '#5a4d3c'); px(c, x, base - 86, 31, 1, '#b0a088');
  for (const cx of [3, 14, 23]) px(c, x + cx, base - 85, 4, 2, '#bdad86');
  const hood = wet ? '#6f7f7b' : '#8d9b96', sock = wet ? '#8a6f5b' : '#aa8e76', towel = wet ? '#4f5f6a' : '#697c88';
  px(c, x + 2, base - 84, 10, 13, hood); px(c, x, base - 84, 3, 5, hood); px(c, x + 11, base - 84, 3, 5, hood); px(c, x + 5, base - 80, 4, 5, wet ? '#5f6f6b' : '#7d8b86');
  px(c, x + 14, base - 84, 3, 7, sock); px(c, x + 18, base - 84, 3, 7, sock); px(c, x + 22, base - 84, 7, 16, towel); px(c, x + 22, base - 76, 7, 1, wet ? '#425260' : '#5b6e7a');
  if (!wet) return;
  for (let i = 0; i < 4; i++) { const t = (tick * 3 + i * 23) % 70; if (t < 62) px(c, x + 4 + i * 7, base - 70 + t, 1, 2, '#9ec3d6'); }
  px(c, x - 1, base - 3, 30, 3, '#3e5460'); px(c, x + 6, base - 3, 6, 1, '#6a848c');
}

// 凡哥躺着背对镜头：只画后脑勺、肩膀和搭在被子外的手臂，靴子由床那边露出来
function fanLying(c, x, y) {
  const k = COLORS.fan;
  c.save(); c.translate(x, y);
  px(c, 0, 0, 14, 12, OUT); px(c, 1, 1, 12, 10, k.hair); px(c, 3, 2, 1, 8, '#b8963f'); px(c, 7, 1, 1, 9, '#b8963f'); px(c, 10, 3, 1, 7, '#b8963f');
  px(c, 14, 2, 2, 2, k.hair); px(c, -2, 5, 2, 2, k.hair); px(c, 4, -2, 4, 2, k.hair);
  px(c, 10, 9, 4, 4, k.skinD);
  px(c, 12, 4, 14, 10, OUT); px(c, 13, 5, 12, 8, k.top); px(c, 13, 5, 6, 2, k.dark); px(c, 13, 7, 3, 5, k.light); px(c, 19, 7, 1, 5, k.dark);
  px(c, 17, 11, 12, 5, OUT); px(c, 18, 12, 10, 3, k.top); px(c, 26, 12, 2, 3, k.dark); px(c, 28, 12, 3, 3, k.skin);
  c.restore();
}

function bed(c, x, base, blanket, blanketL, blanketD, sleeper) {
  const w = 46;
  px(c, x - 2, base, w + 4, 2, 'rgba(0,0,0,0.3)');
  px(c, x, base - 12, 3, 12, '#4e3a2b'); px(c, x + w - 3, base - 12, 3, 12, '#4e3a2b');
  px(c, x - 1, base - 17, w + 2, 5, '#7a5b3f'); px(c, x - 1, base - 17, w + 2, 1, '#96734f');
  px(c, x + 1, base - 25, w - 2, 8, '#b5aa8e'); px(c, x + 1, base - 25, w - 2, 2, '#cbc0a5');
  px(c, x + 3, base - 30, 15, 6, '#d8d2bf'); px(c, x + 3, base - 25, 15, 1, '#b3ac98');
  if (sleeper) sleeper(c, x + 2, base - 36);
  const top = base - 31;
  // 被子只盖到脚踝，黄靴子露在外面才认得出是凡哥
  const bx = sleeper ? x + 20 : x + 12, bw = sleeper ? 20 : w - 19;
  px(c, bx, top + 1, bw, 7, blanket);
  px(c, bx, top + 1, bw, 1, blanketL); px(c, bx, top + 6, bw, 2, blanketD);
  px(c, bx + 8, top + 2, 1, 5, blanketD); px(c, bx + 15, top + 1, 1, 6, blanketD);
  if (sleeper) { const k = COLORS.fan; px(c, x + 39, top + 1, 7, 7, OUT); px(c, x + 40, top + 2, 5, 5, k.shoe); px(c, x + 40, top + 6, 5, 1, k.sole); px(c, x + 41, top + 3, 3, 1, '#d09a3e'); }
  else { px(c, x + 30, top - 2, 12, 4, blanketL); px(c, x + 30, top - 2, 12, 1, blanket); }
}

function floorSheet(c, x, base) {
  px(c, x, base - 5, 36, 5, '#5c564b'); px(c, x, base - 5, 36, 1, '#6f685b');
  px(c, x + 2, base - 11, 26, 7, '#7e8583'); px(c, x + 2, base - 11, 26, 1, '#98a09d'); px(c, x + 10, base - 9, 1, 5, '#636a68'); px(c, x + 19, base - 10, 1, 6, '#636a68');
  px(c, x + 27, base - 12, 9, 8, '#8a7a62'); px(c, x + 28, base - 11, 7, 6, '#a08e72'); px(c, x + 30, base - 9, 3, 2, '#6d5f4a');
}

function crates(c, x, base) {
  const box = '#7a6247', boxD = '#5c4834', boxL = '#96795a';
  px(c, x - 2, base, 42, 2, 'rgba(0,0,0,0.3)');
  px(c, x, base - 22, 38, 22, boxD); px(c, x + 2, base - 20, 34, 18, box); px(c, x + 2, base - 20, 34, 1, boxL); px(c, x + 2, base - 11, 34, 1, boxD); px(c, x + 18, base - 20, 2, 18, boxD);
  px(c, x + 6, base - 17, 12, 8, '#d7cbb1'); px(c, x + 8, base - 15, 8, 1, '#5a4633'); px(c, x + 8, base - 13, 6, 1, '#5a4633');
  px(c, x + 4, base - 40, 30, 18, boxD); px(c, x + 6, base - 38, 26, 14, box); px(c, x + 6, base - 38, 26, 1, boxL); px(c, x + 6, base - 30, 26, 1, boxD);
  px(c, x + 8, base - 36, 22, 4, '#2a2320'); px(c, x + 10, base - 36, 4, 3, '#9aa3a6'); px(c, x + 16, base - 36, 4, 3, '#b8b0a0'); px(c, x + 22, base - 36, 4, 3, '#9aa3a6');
  px(c, x + 5, base - 44, 30, 3, box); px(c, x + 5, base - 44, 30, 1, boxL);
  px(c, x + 12, base - 53, 18, 9, '#3a3f44'); px(c, x + 12, base - 53, 18, 1, '#555b61'); dither(c, x + 14, base - 51, 8, 5, '#262a2e', 2, 0);
  px(c, x + 24, base - 51, 3, 3, '#d7cbb1'); px(c, x + 26, base - 63, 1, 10, '#9aa3a6'); px(c, x + 27, base - 66, 1, 4, '#9aa3a6');
}

function parcel(c, x, base) {
  px(c, x - 1, base, 26, 2, 'rgba(0,0,0,0.3)');
  px(c, x, base - 28, 24, 28, '#7d6144'); px(c, x + 1, base - 27, 22, 26, '#a17f5a'); px(c, x + 1, base - 27, 22, 1, '#b8956c');
  px(c, x + 10, base - 27, 3, 26, '#d8cfb8'); px(c, x + 1, base - 16, 22, 3, '#d8cfb8');
  px(c, x + 15, base - 24, 6, 4, '#e6dfcc'); px(c, x + 16, base - 23, 4, 1, '#5a4633');
}

function smoke(c, x, y, tick, strength = 1, seed = 0) {
  for (let i = 0; i < 8; i++) {
    const t = ((tick * 1.4 + i * 9 + seed) % 72) / 72;
    const sx = x + Math.round(Math.sin(t * 5 + i) * (2 + t * 6)) + Math.round(t * 3);
    const s = t < 0.3 ? 1 : t < 0.65 ? 2 : 3;
    c.save(); c.globalAlpha = Math.max(0, 0.6 - t * 0.6) * strength; px(c, sx, y - t * 60, s, s, t > 0.4 ? '#8e9797' : '#aeb6b6'); c.restore();
  }
}

function drum(c, x, base, lit, tick) {
  px(c, x - 3, base, 30, 2, 'rgba(0,0,0,0.35)');
  px(c, x, base - 28, 24, 28, '#3a3a3a'); px(c, x + 2, base - 26, 20, 24, '#4d4740'); dither(c, x + 2, base - 24, 20, 22, '#6b4a2e', 3, 1);
  px(c, x, base - 28, 24, 2, '#5c5650'); px(c, x, base - 18, 24, 1, '#2f2a26'); px(c, x, base - 9, 24, 1, '#2f2a26');
  px(c, x + 5, base - 15, 4, 6, '#1e1a18'); px(c, x + 14, base - 15, 4, 6, '#1e1a18');
  if (!lit) { px(c, x + 3, base - 30, 18, 3, '#2a2523'); px(c, x + 8, base - 31, 6, 2, '#3a2f2a'); smoke(c, x + 12, base - 30, tick, 0.35); return; }
  smoke(c, x + 12, base - 52, tick, 0.7, 5);
}
// 火苗在夜色叠加之后再画一遍，火不能被夜色压暗
function flames(c, x, base, tick) {
  const f = Math.floor(tick / 4) % 3, g = Math.floor(tick / 7) % 2;
  px(c, x + 4, base - 40 - f, 16, 12 + f, '#e2833a'); px(c, x + 7, base - 46 + g, 10, 12, '#f1c46b'); px(c, x + 9, base - 50 + f, 5, 8, '#fbe7a1');
  px(c, x + 2 + f, base - 34, 3, 5, '#e2833a'); px(c, x + 19 - f, base - 36, 3, 6, '#e2833a'); px(c, x + 11, base - 55 - g * 2, 2, 4, '#f1c46b');
  for (let i = 0; i < 6; i++) { const t = (tick * 2 + i * 11) % 40; px(c, x + 6 + ((i * 7 + t) % 12), base - 48 - t, 1, 1, i % 2 ? '#f1c46b' : '#ff9a4a'); }
  px(c, x + 5, base - 15, 4, 6, '#ff8a3a'); px(c, x + 14, base - 15, 4, 6, '#ff8a3a');
}

function cat(c, x, y, tick) {
  px(c, x, y, 18, 8, '#c98b4a'); px(c, x + 14, y - 4, 7, 7, '#c98b4a'); px(c, x + 15 + (Math.floor(tick / 40) % 2), y - 6, 2, 3, '#c98b4a'); px(c, x + 19, y - 6, 2, 3, '#c98b4a');
  px(c, x + 2, y + 2, 12, 2, '#e6b37a'); px(c, x + 5, y + 5, 8, 1, '#e6b37a'); px(c, x - 6, y + 4, 7, 3, '#c98b4a'); px(c, x - 6, y + 4, 2, 3, '#e6b37a');
  px(c, x + 17, y - 1, 2, 1, '#2b2b30');
}

function stool(c, x, base) { px(c, x, base - 14, 14, 3, '#6e5a44'); px(c, x + 1, base - 11, 2, 11, '#4e3f30'); px(c, x + 11, base - 11, 2, 11, '#4e3f30'); }

function table(c, x, base, lampOn) {
  px(c, x + 2, base - 26, 3, 26, '#514636'); px(c, x + 39, base - 26, 3, 26, '#514636'); px(c, x + 2, base - 14, 40, 2, '#514636');
  px(c, x, base - 30, 44, 4, '#8a7355'); px(c, x, base - 30, 44, 1, '#a98c68');
  px(c, x + 8, base - 34, 14, 4, '#3a4247'); px(c, x + 10, base - 33, 3, 2, '#7d8a90'); px(c, x + 15, base - 33, 4, 2, '#9aa3a6'); px(c, x + 25, base - 33, 2, 2, '#c9443a');
  px(c, x + 30, base - 36, 5, 6, '#6b7f8a'); px(c, x + 35, base - 34, 1, 3, '#6b7f8a');
  px(c, x + 36, base - 32, 7, 2, '#2b3338'); px(c, x + 39, base - 48, 2, 16, '#8a9096'); px(c, x + 32, base - 50, 10, 4, '#2b3338'); px(c, x + 30, base - 47, 6, 2, '#2b3338');
  px(c, x + 31, base - 45, 8, 1, lampOn ? '#fff1c4' : '#5a6268');
}


// 轩哥坐在凳子上弯腰修东西（朝右）：躯干上半段右移两格表示前倾，头再往右下压
function xuanBent(c, x, y) {
  const k = COLORS.xuan;
  c.save(); c.translate(x, y);
  px(c, 0, 35, 30, 3, 'rgba(10,18,24,0.45)');
  px(c, 3, 26, 14, 9, OUT); px(c, 4, 27, 12, 7, k.pants); px(c, 10, 30, 20, 6, OUT); px(c, 11, 31, 18, 4, k.pants); px(c, 11, 31, 18, 1, k.seam);
  px(c, 26, 29, 8, 7, OUT); px(c, 27, 30, 6, 5, k.shoe); px(c, 27, 34, 6, 1, k.sole); px(c, 28, 31, 3, 1, '#4a5257'); px(c, 21, 33, 6, 3, k.shoe);
  px(c, 5, 15, 18, 8, OUT); px(c, 3, 21, 18, 11, OUT);
  px(c, 6, 16, 16, 6, k.top); px(c, 4, 22, 16, 9, k.top); px(c, 6, 16, 5, 6, k.light); px(c, 4, 22, 5, 9, k.light); px(c, 18, 16, 4, 6, k.dark); px(c, 16, 22, 4, 9, k.dark);
  px(c, 10, 16, 4, 2, '#778387'); px(c, 15, 16, 4, 2, '#778387'); px(c, 13, 18, 3, 10, k.shirt); px(c, 14, 21, 1, 1, '#778387'); px(c, 14, 25, 1, 1, '#778387');
  px(c, 17, 22, 8, 4, OUT); px(c, 18, 23, 6, 2, k.dark); px(c, 23, 24, 3, 2, k.skinD);
  px(c, 19, 19, 9, 4, OUT); px(c, 20, 20, 7, 2, k.light); px(c, 25, 21, 4, 6, OUT); px(c, 26, 22, 2, 4, k.light); px(c, 26, 26, 3, 2, k.skin);
  px(c, 27, 27, 2, 1, '#c9443a'); px(c, 29, 27, 4, 1, '#8a969b');
  px(c, 11, 6, 14, 14, OUT); px(c, 12, 10, 12, 9, k.skin); px(c, 12, 17, 12, 2, k.skinD); px(c, 13, 11, 4, 2, k.skinL);
  px(c, 12, 7, 12, 4, k.hair); px(c, 11, 9, 2, 5, k.hair); px(c, 23, 9, 2, 4, k.hair); px(c, 12, 10, 12, 1, k.hair); px(c, 12, 11, 2, 1, k.hair);
  px(c, 16, 14, 2, 2, INK); px(c, 21, 14, 2, 2, INK); px(c, 16, 14, 1, 1, '#f2efe6'); px(c, 21, 14, 1, 1, '#f2efe6');
  c.restore();
}

// 马哥站着叼烟、手插兜（朝右）：短袖露出小臂，前臂折进裤兜，兜口用轮廓色压住手
function maStanding(c, x, y, tick) {
  const k = COLORS.ma;
  c.save(); c.translate(x, y);
  px(c, 0, 35, 24, 3, 'rgba(10,18,24,0.45)');
  px(c, 5, 26, 8, 10, OUT); px(c, 11, 26, 8, 10, OUT); px(c, 6, 27, 6, 8, k.pants); px(c, 12, 27, 6, 8, k.pants); px(c, 6, 27, 2, 8, k.seam); px(c, 12, 27, 2, 8, k.seam);
  px(c, 3, 33, 10, 5, OUT); px(c, 11, 33, 10, 5, OUT); px(c, 4, 34, 8, 3, k.shoe); px(c, 12, 34, 8, 3, k.shoe); px(c, 4, 36, 8, 1, k.sole); px(c, 12, 36, 8, 1, k.sole); px(c, 5, 34, 2, 1, '#9aa0a3'); px(c, 13, 34, 2, 1, '#9aa0a3');
  px(c, 3, 13, 18, 15, OUT); px(c, 4, 14, 16, 13, k.top); px(c, 4, 14, 5, 13, k.light); px(c, 16, 14, 4, 13, k.dark);
  px(c, 8, 14, 8, 2, k.dark); px(c, 10, 16, 4, 2, k.skinD); px(c, 5, 24, 3, 1, k.light); px(c, 16, 24, 3, 1, k.light);
  px(c, 0, 15, 5, 8, OUT); px(c, 1, 16, 3, 4, k.light); px(c, 1, 20, 3, 3, k.skin); px(c, 1, 22, 6, 4, OUT); px(c, 2, 23, 4, 2, k.skin); px(c, 2, 25, 5, 2, OUT); px(c, 3, 26, 3, 1, k.pants);
  px(c, 19, 15, 5, 8, OUT); px(c, 20, 16, 3, 4, k.dark); px(c, 20, 20, 3, 3, k.skin); px(c, 17, 22, 6, 4, OUT); px(c, 18, 23, 4, 2, k.skin); px(c, 17, 25, 5, 2, OUT); px(c, 18, 26, 3, 1, k.pants);
  px(c, 5, 0, 14, 14, OUT); px(c, 6, 4, 12, 9, k.skin); px(c, 6, 11, 12, 2, k.skinD); px(c, 7, 5, 4, 2, k.skinL);
  px(c, 6, 1, 12, 4, k.hair); px(c, 5, 3, 2, 5, k.hair); px(c, 17, 3, 2, 4, k.hair); px(c, 6, 4, 12, 1, k.hair); px(c, 6, 5, 2, 1, k.hair);
  dither(c, 8, 10, 8, 3, k.skinD, 3, 0);
  px(c, 10, 7, 2, 2, INK); px(c, 15, 7, 2, 2, INK); px(c, 10, 7, 1, 1, '#f2efe6'); px(c, 15, 7, 1, 1, '#f2efe6');
  px(c, 17, 10, 4, 1, '#ece4d3'); px(c, 21, 10, 1, 1, Math.floor(tick / 6) % 10 < 2 ? '#ffb36a' : '#ff7a3a');
  c.restore();
}

function artBoard(c, x, y) {
  px(c, x, y, 40, 64, '#3d3227'); px(c, x + 2, y + 2, 36, 60, '#5a4a3a'); px(c, x, y, 40, 2, '#6f5c48');
  const paper = (ax, ay, w, h, draw) => { px(c, ax, ay, w, h, '#d7cbb1'); px(c, ax, ay, w, 1, '#b7ae98'); px(c, ax + Math.floor(w / 2) - 1, ay - 1, 2, 2, '#2b2b30'); draw(ax, ay); };
  // 画里的三个人也按现行造型：黑衬衫、黄外套、黑短袖
  paper(x + 5, y + 7, 14, 18, (a, b) => { px(c, a + 3, b + 5, 3, 7, '#252b2e'); px(c, a + 6, b + 4, 3, 8, '#c69a32'); px(c, a + 9, b + 6, 3, 6, '#252b2e'); px(c, a + 2, b + 13, 10, 1, '#5a4633'); });
  paper(x + 22, y + 7, 14, 18, (a, b) => { px(c, a + 2, b + 4, 10, 1, '#5a4633'); px(c, a + 3, b + 5, 2, 8, '#5a4633'); px(c, a + 9, b + 5, 2, 8, '#5a4633'); px(c, a + 5, b + 11, 4, 3, '#e2833a'); });
  paper(x + 12, y + 32, 16, 22, (a, b) => { px(c, a + 5, b + 5, 6, 7, '#b98358'); px(c, a + 4, b + 2, 8, 4, '#d8b35d'); px(c, a + 6, b + 8, 1, 1, '#2b2b30'); px(c, a + 9, b + 8, 1, 1, '#2b2b30'); px(c, a + 3, b + 12, 10, 3, '#467aa1'); });
}

function rainNear(c, tick) {
  for (let i = 0; i < 60; i++) {
    const strip = i % 2 ? [0, 26] : [460, 20];
    const x = strip[0] + Math.floor(hash(i) * strip[1] + tick * 0.7) % strip[1], y = Math.floor(hash(i + 100) * 250 + tick * 9) % 250;
    px(c, x, y, 1, 9, 'rgba(200,215,230,0.55)');
  }
  for (let i = 0; i < 8; i++) {
    const t = (tick + i * 5) % 16, x = i < 4 ? 3 + i * 6 : 462 + (i - 4) * 5, y = 250 + i % 3 * 3;
    if (t < 8) { px(c, x - Math.floor(t / 3), y - (t < 5 ? Math.floor(t / 2) : 0), 2, 1, 'rgba(200,215,230,0.6)'); px(c, x + 2 + Math.floor(t / 3), y - (t < 5 ? Math.floor(t / 2) : 0), 2, 1, 'rgba(200,215,230,0.6)'); }
  }
}

// 光：夜里先压一层深蓝，再用加法叠出火光、台灯、路灯；白天只罩一层冷灰白
function lighting(c, tick) {
  if (!NIGHT) { px(c, 0, 0, W, H, 'rgba(200,212,220,0.13)'); return; }
  px(c, 0, 0, W, H, 'rgba(12,26,54,0.46)');
  const fl = 0.42 + 0.06 * Math.sin(tick / 3) + 0.03 * Math.sin(tick / 1.3);
  glow(c, 352, 214, 170, '255,140,60', fl * 0.75); glow(c, 352, 196, 40, '255,170,90', fl * 0.55);
  glow(c, 436, 208, 34, '255,225,170', 0.42);
  // 桥外路灯的冷光溢进来一点，左半边的床和晾衣架才有轮廓
  glow(c, 13, 72, 48, '170,195,225', 0.33); glow(c, 30, 130, 170, '110,140,185', 0.16);
  glow(c, 273, 218, 10, '120,240,120', 0.1);
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
  const v = c.createRadialGradient(240, 150, 110, 240, 150, 330);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, NIGHT ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.3)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

export function drawScene(c, tick) {
  c.imageSmoothingEnabled = false;
  sky(c); city(c, tick);
  if (NIGHT) rainFar(c, tick);
  ground(c);
  puddle(c, 4, 240, 20, 12); puddle(c, 462, 244, 16, 10); puddle(c, 348, 254, 24, 6);
  deck(c);
  streetlamp(c, 12, NIGHT);
  pillar(c, 40, 26); pillar(c, 422, 26); graffiti(c, 40); cardboardSign(c, 422);
  dryingRack(c, 66, 236, NIGHT, tick);
  bed(c, 100, 232, '#4a6890', '#6484ad', '#3b5677', fanLying);
  bed(c, 154, 232, '#7a3d3d', '#9a5252', '#5c2e2e', null);
  floorSheet(c, 210, 240);
  crates(c, 246, 236);
  parcel(c, 284, 236);
  artBoard(c, 402, 152);
  table(c, 402, 250, NIGHT);
  stool(c, 380, 250); xuanBent(c, 374, 212);
  drum(c, 340, 248, NIGHT, tick);
  maStanding(c, 306, 210, tick);
  cat(c, 322, 252, tick);
  // 水洼倒影用抖动而不是渐变，保持像素感
  if (NIGHT) { dither(c, 9, 241, 6, 10, '#7f9bb3', 2, tick % 2); dither(c, 352, 255, 16, 4, '#d9853f', 2, tick % 2); }
  lighting(c, tick);
  if (NIGHT) { flames(c, 340, 248, tick); px(c, 433, 205, 8, 1, '#fff1c4'); px(c, 273, 189, 1, 1, '#7fe07a'); px(c, 8, 72, 11, 2, '#eef4f6'); }
  if (NIGHT) rainNear(c, tick);
  grain(c);
}

// 快捷栏图标 24×24：罐头、绷带
export function itemIcon(c, kind) {
  px(c, 0, 0, 24, 24, 'rgba(0,0,0,0)');
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
  // 整数倍缩放按视口宽取：1713 宽是 3 倍两侧留黑边，1920 宽是 4 倍正好铺满；多出的高度贴底裁上边，和街景一致
  const scale = Math.max(1, Math.floor(innerWidth / W));
  const box = document.querySelector('.mock-canvas');
  box.style.width = `${W * scale}px`; box.style.height = `${H * scale}px`;
  for (const tag of document.querySelectorAll('.mock-tag')) { tag.style.left = `${tag.dataset.lx * scale}px`; tag.style.top = `${tag.dataset.ly * scale}px`; }
  document.body.classList.toggle('is-day', !NIGHT);
  document.querySelector('.night-card').hidden = !SHOW_CARD;
  document.querySelector('.mock-scrim').hidden = !SHOW_CARD;
  // 叙事卡压在场景上时，悬停标签会从半透明卡底透出来，索性藏掉
  for (const tag of document.querySelectorAll('.mock-tag')) tag.hidden = SHOW_CARD;
  for (const el of document.querySelectorAll('[data-night]')) el.textContent = NIGHT ? el.dataset.night : el.dataset.day;
}

mount();
