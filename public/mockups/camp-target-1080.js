// 原生 1920×1080 效果图：旧桥营地之夜。逻辑像素等于物理像素，不做整数放大，全部是抗锯齿矢量形状、渐变、软阴影与叠层。
// 独立于 ui/ 的像素管线，只为和 480×270、960×540 像素版并排比较“直接按 1080p 做”是什么样子；不接引擎、不接存档。
// 静态层（天空、城市、桥、柱、地面、家什、人物）只画一次进离屏画布，每帧只重画雨、烟、火、灯光叠层。
import { W, H, hash, lin, rad, rgba, rect, rr, ell, poly, blob, line, curve, soft, stipple, hatch, drips, spray, ink, grain } from './camp-target-1080-paint.js';
import { bed, floorSheet, crates, parcel, drum, flames, smoke, table, lampBulb, stool, artRack, dryingRack, rackDrops, cat } from './camp-target-1080-props.js';
import { xuanBent, maStanding, bust, itemIcon } from './camp-target-1080-figures.js';

const DECK = [104, 1816], SLAB = 90, UNDER = 244, HORIZON = 890, FLOOR = 978;
const PILLARS = [160, 1688], PW = 108;
const FIRE = { x: 1330, cx: 1376, top: FLOOR - 138 }, LAMP = [1704, 822], STREETLAMP = [100, 262];
const LIT = [];

function sky(c) {
  rect(c, 0, 0, W, HORIZON, lin(c, 0, 0, 0, HORIZON, [[0, '#090d14'], [0.45, '#121a25'], [0.8, '#1d2833'], [1, '#2a353e']]));
  soft(c, 960, HORIZON - 40, 1000, 260, [66, 76, 88], 0.5);
  for (let i = 0; i < 5; i++) soft(c, 200 + i * 400 + hash(i) * 200, 260 + hash(i + 5) * 200, 300, 60, [20, 27, 36], 0.6);
}

// 城市两层剪影，远层泡在雾里，近层更暗；亮着的窗记进 LIT，夜色叠加后再补一遍才不会被压灰
function city(c) {
  const fog = (y0) => lin(c, 0, y0, 0, HORIZON, [[0, 'rgba(50,62,74,0)'], [1, 'rgba(50,62,74,0.55)']]);
  let x = -40, i = 0;
  while (x < W + 40) {
    const w = 70 + hash(i) * 130, h = 180 + hash(i + 1) * 260, top = HORIZON - h;
    rect(c, x, top, w, h, lin(c, x, 0, x + w, 0, [[0, '#1a232c'], [0.5, '#202b35'], [1, '#182029']]));
    if (hash(i + 2) > 0.6) poly(c, [[x, top], [x + w * 0.5, top - 30 - hash(i + 3) * 40], [x + w, top]], '#1a232c');
    if (hash(i + 4) > 0.7) { line(c, [[x + w * 0.5, top], [x + w * 0.5, top - 60]], '#141b22', 2); LIT.push([x + w * 0.5 - 1.5, top - 62, 3, 3, 'r']); }
    for (let wy = top + 14; wy < HORIZON - 40; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 13) {
      const r = hash(i * 977 + wx * 3 + wy);
      if (r > 0.86) LIT.push([wx, wy, 5, 7, r > 0.96 ? 'w' : 'y']); else if (r > 0.6) rect(c, wx, wy, 5, 7, 'rgba(120,130,140,0.16)');
    }
    x += w + 6 + hash(i + 6) * 20; i += 7;
  }
  rect(c, 0, 500, W, HORIZON - 500, fog(500));
  x = -20; i = 300;
  while (x < W + 40) {
    const w = 100 + hash(i) * 160, h = 110 + hash(i + 1) * 170, top = HORIZON - h;
    rect(c, x, top, w, h, lin(c, x, 0, x + w, 0, [[0, '#131a21'], [0.5, '#182028'], [1, '#111820']]));
    if (hash(i + 2) > 0.5) rr(c, x + w * 0.2, top - 26, 24, 26, 3, '#141b22');
    for (let wy = top + 12; wy < HORIZON - 30; wy += 18) for (let wx = x + 10; wx < x + w - 12; wx += 15) { if (hash(i * 313 + wx * 5 + wy) > 0.9) LIT.push([wx, wy, 6, 8, 'y']); }
    x += w + 10 + hash(i + 6) * 30; i += 5;
  }
  rect(c, 0, 700, W, HORIZON - 700, fog(700));
  // 远处一条高架：一串冷白路灯点出纵深
  rect(c, 0, HORIZON - 34, W, 10, '#1b232a'); rect(c, 0, HORIZON - 24, W, 24, lin(c, 0, HORIZON - 24, 0, HORIZON, [[0, '#2a343c'], [1, '#1f272e']]));
  for (let lx = 30; lx < W; lx += 96) LIT.push([lx, HORIZON - 40, 3, 3, 'c']);
  // 远雨：桥外的雨在背景里只是一层极淡的斜纹
  c.save(); c.globalAlpha = 0.07; c.strokeStyle = '#c7d3dc'; c.lineWidth = 1;
  for (let k = 0; k < 420; k++) { const rx = hash(k * 3) * W, ry = 240 + hash(k * 3 + 1) * (HORIZON - 240), l = 30 + hash(k * 3 + 2) * 60; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - l * 0.18, ry + l); c.stroke(); }
  c.restore();
}
function litWindows(c, tick) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < LIT.length; i++) {
    const [x, y, w, h, kind] = LIT[i], flick = kind === 'r' ? (Math.sin(tick / 20 + i) > 0 ? 1 : 0.2) : 0.75 + hash(i + Math.floor(tick / 40)) * 0.25;
    c.globalAlpha = (kind === 'c' || kind === 'r' ? 0.5 : 0.3) * flick;
    c.fillStyle = kind === 'r' ? '#ff5a4a' : kind === 'w' ? '#cfe0ea' : kind === 'c' ? '#bcd6e8' : '#e6c27c';
    c.fillRect(x, y, w, h);
  }
  c.restore();
}

function ground(c) {
  rect(c, 0, HORIZON, W, H - HORIZON, lin(c, 0, HORIZON, 0, H, [[0, '#3b474f'], [0.4, '#2d373d'], [1, '#1f272c']]));
  line(c, [[0, HORIZON + 1], [W, HORIZON + 1]], '#54636b', 2, 0.6);
  stipple(c, 0, HORIZON + 4, W, H - HORIZON - 4, '#111619', 0.35, 900, 5, 2);
  stipple(c, 0, HORIZON + 4, W, H - HORIZON - 4, '#5a6870', 0.18, 300, 6, 2);
  for (let k = 0; k < 9; k++) { const cx = hash(k * 11) * W, cy = HORIZON + 20 + hash(k * 11 + 1) * 120; curve(c, [[cx, cy], [cx + 30 + hash(k) * 40, cy + 12], [cx + 60 + hash(k + 2) * 60, cy + 4], [cx + 100, cy + 18]], '#141a1e', 1.5, 0.6); }
  hatch(c, 0, HORIZON, W, H - HORIZON, 9, 0.05, '#000', -0.2, 9);
  // 地上的零碎：瓶子、烟盒、一团纸
  rr(c, 1120, FLOOR - 8, 26, 8, 3, '#7f9a90'); rr(c, 1146, FLOOR - 6, 8, 4, 2, '#5f7a70');
  rr(c, 1540, FLOOR - 7, 16, 8, 1, '#a89a7a'); blob(c, [[300, FLOOR - 4], [310, FLOOR - 14], [326, FLOOR - 10], [330, FLOOR - 2], [312, FLOOR]], '#9a958a');
}
const PUDDLES = [[84, 982, 76, 9], [1480, 991, 70, 6], [1862, 984, 52, 7]];
function puddles(c) {
  for (const [x, y, rx, ry] of PUDDLES) { ell(c, x, y, rx, ry, '#1a232b'); ell(c, x + 4, y - 1, rx - 10, ry - 3, '#26323b'); curve(c, [[x - rx * 0.6, y + 1], [x, y - 1], [x + rx * 0.6, y + 1]], '#4a5c68', 1.5, 0.4); }
}

// 桥：顶上一整块混凝土板（板面看不见，只看到侧面厚度），板下三道工字梁，末端滴水
function deck(c) {
  const [a, b] = DECK, w = b - a;
  rect(c, a, SLAB, w, UNDER - SLAB, lin(c, a, 0, b, 0, [[0, '#2c353b'], [0.25, '#22292e'], [0.5, '#1f262b'], [0.75, '#22292e'], [1, '#2c353b']]));
  for (const gy of [104, 150, 196]) {
    rect(c, a, gy, w, 8, '#475257'); rect(c, a, gy + 8, w, 26, lin(c, 0, gy + 8, 0, gy + 34, [[0, '#333c42'], [1, '#293136']])); rect(c, a, gy + 34, w, 8, '#4c585f'); rect(c, a, gy + 42, w, 5, 'rgba(0,0,0,0.5)');
    drips(c, a, gy + 42, w, 40, '#161c20', 0.45, 60, gy);
    stipple(c, a, gy, w, 42, '#0e1316', 0.3, 260, gy * 3, 2);
  }
  rect(c, a, 0, w, SLAB, lin(c, 0, 0, 0, SLAB, [[0, '#5e6a70'], [0.5, '#4f5b61'], [0.88, '#3f4a50'], [1, '#2a3238']]));
  rect(c, a, 44, w, 3, '#3a444a'); rect(c, a, 82, w, 3, '#3a444a');
  drips(c, a, 47, w, 60, '#2c353a', 0.5, 40, 1); drips(c, a, 85, w, 26, '#2c353a', 0.5, 40, 2);
  hatch(c, a, 0, w, SLAB, 7, 0.07, '#000', -0.7, 3); stipple(c, a, 0, w, SLAB, '#20282c', 0.35, 700, 4, 2); stipple(c, a, 0, w, SLAB, '#7d8a90', 0.18, 300, 8, 2);
  for (let hx = a + 40; hx < b; hx += 120) ell(c, hx, 96, 4, 3, '#1e252a');
  // 板的两端：侧面亮一点，下缘挂着水
  for (const ex of [a, b - 8]) rect(c, ex, 0, 8, SLAB, 'rgba(160,175,185,0.14)');
  // 桥下垂着的电缆和一只没接电的灯泡
  curve(c, [[PILLARS[0] + PW, UNDER], [960, UNDER + 70], [PILLARS[1], UNDER]], '#0f1418', 3);
  line(c, [[880, UNDER + 56], [884, UNDER + 120]], '#0f1418', 2); ell(c, 884, UNDER + 128, 7, 9, '#3a444a'); rr(c, 880, UNDER + 116, 8, 8, 2, '#5a6268');
  spray(c, 'NO.7', 700, 20, 28, '#8fa6a6', -0.02, 0.35);
}

function pillar(c, x, w) {
  rect(c, x, UNDER, w, FLOOR - UNDER, lin(c, x, 0, x + w, 0, [[0, '#3a454c'], [0.3, '#5f6d74'], [0.62, '#55626a'], [1, '#303a40']]));
  rect(c, x, UNDER, 3, FLOOR - UNDER, 'rgba(170,190,205,0.28)'); rect(c, x + w - 3, UNDER, 3, FLOOR - UNDER, 'rgba(170,190,205,0.22)');
  rect(c, x - 4, UNDER, w + 8, 34, lin(c, x - 4, 0, x + w + 4, 0, [[0, '#3a444a'], [0.5, '#5f6c72'], [1, '#30393f']]));
  rect(c, x - 10, FLOOR - 42, w + 20, 42, lin(c, x - 10, 0, x + w + 10, 0, [[0, '#2f383e'], [0.5, '#4a565c'], [1, '#27303a']]));
  hatch(c, x, UNDER, w, FLOOR - UNDER, 8, 0.08, '#000', -0.7, x); stipple(c, x, UNDER, w, FLOOR - UNDER, '#1f272c', 0.35, 420, x + 1, 2); stipple(c, x, UNDER, w, FLOOR - UNDER, '#7d8a90', 0.16, 160, x + 2, 2);
  drips(c, x, UNDER + 30, w, 220, '#1f272c', 0.4, 14, x + 3);
  soft(c, x + w / 2, FLOOR - 30, w * 0.8, 40, [34, 46, 44], 0.6);
  for (let k = 0; k < 4; k++) line(c, [[x + 6 + k * 26, UNDER + 60 + hash(x + k) * 300], [x + 4 + k * 26, UNDER + 120 + hash(x + k) * 380]], '#1a2126', 1.2, 0.5);
}
// 左柱涂鸦“人在城市仍是人”竖着喷；右柱挂布条“今晚睡哪儿？”，还有几张撕剩的招贴
function graffiti(c, x) {
  poly(c, [[x + 10, 610], [x + 92, 604], [x + 88, 690], [x + 30, 700], [x + 14, 660]], 'rgba(184,176,150,0.45)'); poly(c, [[x + 40, 640], [x + 100, 650], [x + 96, 720], [x + 50, 712]], 'rgba(150,140,120,0.4)');
  '人在城市仍是人'.split('').forEach((ch, i) => spray(c, ch, x + 30, 372 + i * 54, 44, '#c7c9c2', -0.03, 0.55));
  spray(c, 'FAN', x + 18, 780, 34, '#6e9a9a', -0.25, 0.45);
  curve(c, [[x + 20, 760], [x + 60, 752], [x + 96, 762]], 'rgba(199,201,194,0.35)', 3);
}
function banner(c, x) {
  ell(c, x + 54, 372, 3, 3, '#7a8288'); line(c, [[x + 54, 372], [x + 30, 392]], '#8f8a7a', 1.5); line(c, [[x + 54, 372], [x + 82, 392]], '#8f8a7a', 1.5);
  blob(c, [[x + 28, 390], [x + 84, 390], [x + 86, 520], [x + 82, 640], [x + 66, 660], [x + 44, 648], [x + 30, 662], [x + 26, 520]], lin(c, x + 28, 0, x + 86, 0, [[0, '#8f8470'], [0.4, '#b8a98e'], [1, '#948a76']]));
  stipple(c, x + 30, 392, 54, 260, '#5a5344', 0.3, 80, x, 2);
  '今晚睡哪儿？'.split('').forEach((ch, i) => ink(c, ch, x + 38, 402 + i * 40, 34, '#2b2a2a', 0.02, 0.85));
}
function streetlamp(c) {
  const [hx, hy] = STREETLAMP;
  line(c, [[56, FLOOR], [56, hy + 2]], '#2b3237', 9); line(c, [[52, FLOOR], [52, hy + 2]], '#4a545a', 3, 0.6);
  curve(c, [[56, hy + 6], [70, hy - 10], [hx, hy - 6]], '#2b3237', 7);
  poly(c, [[hx - 22, hy - 10], [hx + 20, hy - 10], [hx + 26, hy + 6], [hx - 28, hy + 6]], '#3a444a'); rect(c, hx - 24, hy + 4, 48, 5, '#dfe9ee');
  rr(c, 40, FLOOR - 40, 32, 40, 3, '#2f383e');
}

// 光：先用 multiply 压一层深蓝夜色，再用 lighter 叠火光、台灯、路灯，最后暗角
function lighting(c, tick) {
  const flick = 1 + Math.sin(tick / 5) * 0.03 + Math.sin(tick / 13) * 0.02;
  c.save();
  c.globalCompositeOperation = 'multiply'; rect(c, 0, 0, W, H, 'rgba(36,52,84,0.52)');
  c.globalCompositeOperation = 'lighter';
  rect(c, 0, 0, W, H, rad(c, FIRE.cx, FIRE.top - 10, 0, 760 * flick, [[0, `rgba(255,150,70,${0.6 * flick})`], [0.18, 'rgba(240,120,50,0.38)'], [0.5, 'rgba(150,75,30,0.16)'], [1, 'rgba(0,0,0,0)']]));
  soft(c, FIRE.cx, FLOOR + 4, 440, 70, [255, 140, 60], 0.32 * flick); soft(c, FIRE.cx, UNDER + 10, 520, 170, [255, 130, 60], 0.14);
  rect(c, 0, 0, W, H, rad(c, LAMP[0], LAMP[1], 0, 230, [[0, 'rgba(255,225,160,0.3)'], [0.3, 'rgba(255,200,130,0.13)'], [1, 'rgba(0,0,0,0)']]));
  poly(c, [[LAMP[0] - 16, LAMP[1] + 4], [LAMP[0] + 14, LAMP[1] + 4], [LAMP[0] + 70, FLOOR - 70], [LAMP[0] - 150, FLOOR - 70]], lin(c, 0, LAMP[1], 0, FLOOR - 70, [[0, 'rgba(255,220,150,0.15)'], [1, 'rgba(255,220,150,0.03)']]));
  // 营地左半离火远，只靠路灯和城市的冷光补一点，不然晾晒架和床全黑
  soft(c, 420, FLOOR - 60, 440, 160, [110, 140, 175], 0.18);
  const [sx, sy] = STREETLAMP;
  poly(c, [[sx - 24, sy + 8], [sx + 24, sy + 8], [sx + 190, FLOOR + 10], [sx - 150, FLOOR + 10]], lin(c, 0, sy, 0, FLOOR, [[0, 'rgba(190,215,235,0.2)'], [1, 'rgba(190,215,235,0.03)']]));
  soft(c, sx, sy + 6, 80, 40, [220, 235, 245], 0.5); soft(c, sx - 10, FLOOR + 2, 170, 26, [180, 205, 225], 0.22);
  soft(c, 960, HORIZON - 60, 900, 160, [80, 92, 104], 0.18);
  // 水洼里的反光：火和路灯各一处，横向几道波纹
  for (const [x, y, rx, ry] of PUDDLES) {
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.clip();
    const warm = Math.abs(x - FIRE.cx) < 300;
    soft(c, x, y, rx, ry, warm ? [255, 140, 60] : [190, 210, 230], warm ? 0.7 : 0.45);
    for (let k = -2; k <= 2; k++) line(c, [[x - rx * 0.7, y + k * 2.5], [x + rx * 0.7, y + k * 2.5]], warm ? 'rgba(255,190,110,0.5)' : 'rgba(210,225,240,0.4)', 1);
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  rect(c, 0, 0, W, H, rad(c, 960, 540, 420, 1240, [[0, 'rgba(4,7,12,0)'], [1, 'rgba(4,7,12,0.42)']]));
  c.restore();
}

// 近雨只下在桥面盖不到的两侧，路灯锥里的雨更亮；桥板两端往下滴水
function rainNear(c, tick) {
  c.save(); c.lineCap = 'round';
  for (let k = 0; k < 260; k++) {
    const left = k % 2 === 0, l = 30 + hash(k * 3 + 2) * 60, speed = 18 + hash(k) * 10;
    const rx = left ? -20 + hash(k * 3) * (DECK[0] + 20) : DECK[1] + hash(k * 3) * (W - DECK[1] + 20), ry = ((hash(k * 3 + 1) * 1200 + tick * speed) % 1200) - 80;
    const inCone = left && rx > 0 && rx < 240 && ry > 280;
    c.globalAlpha = (inCone ? 0.34 : 0.14) + hash(k + 7) * 0.08; c.strokeStyle = inCone ? '#dbe6ee' : '#aebac4'; c.lineWidth = 1 + hash(k + 3) * 0.8;
    c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - l * 0.2, ry + l); c.stroke();
  }
  for (let k = 0; k < 10; k++) {
    const ex = k < 5 ? DECK[0] - 2 + hash(k) * 6 : DECK[1] - 4 + hash(k) * 6, t = ((tick * 3 + k * 97) % 200) / 200, dy = SLAB + t * (FLOOR - SLAB);
    c.globalAlpha = 0.6; ell(c, ex, dy, 1.8, 6 + t * 6, '#c6d5de');
    if (t > 0.93) { c.globalAlpha = 0.4; c.strokeStyle = '#c6d5de'; c.lineWidth = 1; c.beginPath(); c.ellipse(ex, FLOOR, (t - 0.9) * 120, (t - 0.9) * 30, 0, 0, Math.PI * 2); c.stroke(); }
  }
  c.restore();
}

function drawStatic(c) {
  sky(c); city(c); ground(c); puddles(c);
  deck(c); streetlamp(c);
  for (const px of PILLARS) pillar(c, px, PW); graffiti(c, PILLARS[0]); banner(c, PILLARS[1]);
  dryingRack(c, 262, FLOOR);
  bed(c, 384, FLOOR - 50, ['#4f6b8f', '#6d88aa', '#33485f'], true);
  bed(c, 650, FLOOR - 50, ['#7d4040', '#9a5656', '#4e2a2a'], false);
  floorSheet(c, 886, FLOOR - 18);
  crates(c, 1060, FLOOR - 42); parcel(c, 1186, FLOOR - 40);
  artRack(c, 1610, FLOOR);
  drum(c, FIRE.x, FLOOR);
  cat(c, 1460, FLOOR - 8);
  stool(c, 1530, FLOOR); table(c, 1596, FLOOR);
  xuanBent(c, 1548, FLOOR); maStanding(c, 1262, FLOOR, 0);
}
function drawDynamic(c, tick) {
  rackDrops(c, 262, FLOOR, tick);
  lighting(c, tick);
  litWindows(c, tick);
  smoke(c, FIRE.cx + 10, FIRE.top - 60, tick);
  flames(c, FIRE.x, FIRE.top - 4, tick);
  lampBulb(c, 1596, FLOOR);
  c.save(); c.globalCompositeOperation = 'lighter'; ell(c, STREETLAMP[0], STREETLAMP[1] + 6, 22, 3, 'rgba(230,240,246,0.9)'); c.restore();
  rainNear(c, tick);
  grain(c, 0.09);
}

function mount() {
  const canvas = document.getElementById('scene'), c = canvas.getContext('2d');
  const still = document.createElement('canvas'); still.width = W; still.height = H;
  drawStatic(still.getContext('2d'));
  let tick = 0;
  const frame = () => { c.drawImage(still, 0, 0); drawDynamic(c, tick); tick += 1; requestAnimationFrame(frame); };
  frame();
  for (const el of document.querySelectorAll('.portrait')) bust(el.getContext('2d'), el.dataset.who, el.dataset.mood);
  for (const el of document.querySelectorAll('.hotslot-art')) itemIcon(el.getContext('2d'), el.dataset.kind);
}
mount();
