import { px, person } from './intro-art.js';

// 旧桥河岸的傍晚（480×270 逻辑像素）：远处旧桥横跨画面，近处石砌河堤的一角搭着木钓台伸进河里。
// 坐标契约来自 river-fight-intro.js 的编排：马哥左上角 y=128 时脚底落在 y=174 的钓台木板上，
// x>=207 是河水，跳跃弧线的最高点 x≈238 要压在竿尖之上，游泳时只露一颗脑袋。
const C = {
  sky: ['#2c434b', '#324b53', '#3a555d', '#455f62', '#526a66'], cloud: '#4a6163',
  cityFar: '#31494f', cityMid: '#263a42', window: '#d3c49f', windowDim: '#8f8a6a', beacon: '#c9443a',
  deckTop: '#8e9c95', deck: '#647477', deckShade: '#46575b', deckUnder: '#2b3a3e', car: '#26343a',
  rail: '#819793', post: '#5e7371', lampPost: '#30454b', lamp: '#d3c49f', lampGlow: 'rgba(211,196,159,0.16)',
  pier: '#5e7371', pierLight: '#819793', pierShade: '#3c5559', pierCap: '#4d6263',
  farWater: '#3f5f66', farRipple: '#4d6f76',
  wall: '#31474b', course: '#3c5559', tread: '#4d6263', treadLip: '#7f9186',
  walk: '#687d72', joint: '#5f7268', curb: '#a9aa86', puddle: '#4a626a', puddleLight: '#7a8d84', rope: '#8a7a5a',
  water: '#587c83', waterFar: '#4f7179', ripple: '#87aaa8', rippleDark: '#4a6a71', foam: '#d8e6e2', spray: '#c9dcd8',
  shadow: 'rgba(28,46,52,0.28)', lampShine: 'rgba(211,196,159,0.4)', wet: 'rgba(20,40,52,0.3)', wetFloor: 'rgba(40,70,82,0.35)',
  frame: '#584c3f', plank: '#9d835c', gap: '#705b42', rim: '#c0a071', dockPost: '#594f43',
  reed: '#6d8364', reedHead: '#a8a171',
  bucket: '#5c6b64', bucketRim: '#92a096', seat: '#b18d61', seatDark: '#957755', stoolLeg: '#4b5b5d',
  rod: '#3a3d40', rodTip: '#6c7275', cork: '#8a5a3a', line: '#d7e8e4', bobber: '#c9443a',
  fish: '#d7b46b', fishLight: '#efd58a', fishDark: '#9a713d', eye: '#263238', fishUnder: 'rgba(88,124,131,0.45)',
  skin: '#b98358',
};
const WATER_X = 207;
const DECK_X = 64;
const DECK_END = 234;
const FAR = [[0, 58, 22], [26, 44, 18], [48, 62, 30], [84, 50, 14], [104, 66, 26], [136, 40, 20], [160, 56, 34], [200, 48, 12], [218, 60, 28], [252, 46, 16], [274, 64, 30], [310, 42, 22], [338, 58, 26], [370, 50, 14], [390, 64, 32], [428, 44, 18], [452, 60, 28]];
const MID = [[-6, 74, 40], [40, 80, 30], [76, 70, 44], [126, 82, 26], [158, 72, 50], [214, 78, 32], [252, 68, 46], [304, 84, 30], [340, 74, 48], [394, 80, 28], [428, 70, 54]];

function skyline(c, tick) {
  C.sky.forEach((color, i) => px(c, 0, i * 20, 480, 20, color));
  for (const [x, y, w] of [[30, 14, 60], [150, 30, 40], [330, 18, 74], [420, 38, 30]]) px(c, (x + Math.floor(tick / 9)) % 520 - 20, y, w, 2, C.cloud);
  for (const [x, top, w] of FAR) {
    px(c, x, top, w, 96 - top, C.cityFar);
    for (let wy = top + 6; wy < 90; wy += 7) for (let wx = x + 3; wx < x + w - 2; wx += 6) {
      const seed = (wx * 7 + wy * 13) % 11;
      if (seed < 3) px(c, wx, wy, 1, 2, C.window); else if (seed === 5) px(c, wx, wy, 1, 2, C.windowDim);
    }
  }
  px(c, 146, 28, 1, 12, C.cityFar);
  if (Math.floor(tick / 12) % 2) px(c, 146, 27, 1, 1, C.beacon);
  for (const [x, top, w] of MID) {
    px(c, x, top, w, 96 - top, C.cityMid);
    for (let wy = top + 5; wy < 92; wy += 8) for (let wx = x + 4; wx < x + w - 3; wx += 8) if ((wx * 5 + wy * 3) % 9 < 2) px(c, wx, wy, 2, 2, C.window);
  }
}

function bridge(c, tick) {
  // 过桥的车只露车顶剪影和一粒尾灯，先画它再画栏杆，车就在栏杆后面
  const carX = (tick * 2) % 560 - 40;
  px(c, carX, 89, 20, 7, C.car); px(c, carX + 4, 86, 11, 3, C.car); px(c, carX + 19, 92, 2, 2, C.lamp);
  for (let x = 4; x < 480; x += 28) px(c, x, 88, 2, 8, C.post);
  px(c, 0, 88, 480, 1, C.rail); px(c, 0, 92, 480, 1, C.rail);
  for (const x of [62, 238, 414]) {
    px(c, x, 70, 2, 26, C.lampPost); px(c, x - 3, 67, 8, 3, C.lampPost); px(c, x - 2, 70, 6, 2, C.lamp);
    px(c, x - 6, 66, 14, 9, C.lampGlow);
  }
  px(c, 0, 96, 480, 2, C.deckTop); px(c, 0, 98, 480, 11, C.deck); px(c, 0, 109, 480, 3, C.deckShade); px(c, 0, 112, 480, 4, C.deckUnder);
  for (let x = 24; x < 480; x += 48) px(c, x, 98, 1, 11, C.deckShade);
}

function farRiver(c, tick) {
  px(c, 0, 116, 480, 34, C.farWater);
  for (let i = 0; i < 9; i++) px(c, 100 + ((i * 53 + tick) % 380), 122 + (i % 4) * 7, 14, 1, C.farRipple);
  for (const x of [252, 394]) {
    px(c, x, 112, 26, 36, C.pier); px(c, x, 112, 4, 36, C.pierLight); px(c, x + 22, 112, 4, 36, C.pierShade);
    px(c, x - 2, 112, 30, 4, C.pierCap);
    for (let y = 122; y < 142; y += 8) px(c, x + 4, y, 18, 1, C.pierShade);
    px(c, x, 142, 26, 6, C.wall);
  }
}

// 画面左上的高堤：步道、栏杆、路灯，石阶顺着堤墙斜下到平台的水边一角
function promenade(c) {
  px(c, 0, 112, 92, 38, C.wall);
  for (let y = 126; y < 150; y += 8) {
    px(c, 0, y, 92, 1, C.course);
    for (let x = ((y / 8) % 2) * 12; x < 92; x += 24) px(c, x, y + 1, 1, 7, C.course);
  }
  px(c, 0, 116, 92, 6, C.walk); px(c, 0, 121, 92, 2, C.curb);
  for (let x = 6; x < 92; x += 20) px(c, x, 104, 2, 12, C.post);
  px(c, 0, 104, 92, 1, C.rail); px(c, 0, 109, 92, 1, C.rail);
  px(c, 26, 78, 3, 38, C.lampPost); px(c, 22, 74, 11, 4, C.lampPost); px(c, 23, 78, 9, 2, C.lamp); px(c, 19, 72, 17, 11, C.lampGlow);
  for (let k = 0; k < 5; k++) {
    const x = 22 + k * 6, y = 123 + k * 6;
    px(c, x, y, 34, 6, C.wall); px(c, x, y, 34, 3, C.tread); px(c, x, y, 34, 1, C.treadLip);
  }
}

function landing(c) {
  px(c, 0, 150, WATER_X, 120, C.walk);
  for (let y = 163; y < 270; y += 14) {
    px(c, 0, y, WATER_X, 1, C.joint);
    for (let x = ((y / 14) % 2) * 14 + 6; x < WATER_X; x += 28) px(c, x, y - 13, 1, 13, C.joint);
  }
  px(c, 0, 254, WATER_X, 3, C.joint);
  px(c, 110, 224, 40, 6, C.puddle); px(c, 106, 226, 48, 3, C.puddle); px(c, 118, 225, 14, 1, C.puddleLight);
  px(c, 186, 230, 8, 14, C.course); px(c, 185, 228, 10, 3, C.rail);
  px(c, 168, 238, 14, 5, C.rope); px(c, 171, 240, 8, 1, C.gap);
  px(c, 92, 148, WATER_X - 92, 4, C.curb);
  px(c, 200, 148, 5, 122, C.curb);
  // 水边这条暗线是被浸湿的石面，让平台和河水之间有一道落差
  px(c, 205, 150, 2, 120, C.wall);
}

function river(c, tick) {
  px(c, WATER_X, 150, 480 - WATER_X, 120, C.water);
  px(c, WATER_X, 150, 480 - WATER_X, 6, C.waterFar);
  for (let i = 0; i < 16; i++) {
    const y = 158 + i * 7;
    const x = WATER_X + 6 + ((i * 67 + tick * (1 + i % 3)) % 250);
    const w = Math.min(14 + (i * 5) % 18, 478 - x);
    px(c, x, y, w, 2, C.ripple); px(c, x + 6, y + 3, Math.max(4, w - 6), 1, C.rippleDark);
  }
  for (let y = 154; y < 270; y += 9) px(c, WATER_X, y + (tick + y) % 3, 3, 1, C.spray);
  // 桥墩和桥灯的倒影：一节节错开，像被水纹揉碎
  for (const x of [252, 394]) for (let s = 0; s < 5; s++) px(c, x + 3 + ((tick + s) % 2), 150 + s * 5, 20 - s * 2, 4, C.shadow);
  for (const x of [238, 414]) for (let s = 0; s < 4; s++) px(c, x - 2 + ((tick + s * 2) % 3), 153 + s * 6, 4, 2, C.lampShine);
}

function dock(c, tick) {
  px(c, DECK_X, 152, DECK_END - DECK_X, 48, C.frame);
  px(c, DECK_X + 3, 155, DECK_END - DECK_X - 6, 42, C.plank);
  for (let row = 0; row < 6; row++) {
    const y = 155 + row * 7;
    if (row) px(c, DECK_X + 3, y - 1, DECK_END - DECK_X - 6, 1, C.gap);
    for (let k = 0; k < 3; k++) px(c, DECK_X + 3 + ((row * 37) % 60) + k * 60, y, 1, 6, C.gap);
  }
  px(c, 84, 148, 142, 5, C.rim);
  for (const x of [212, 226]) {
    px(c, x, 200, 6, 12, C.dockPost); px(c, x, 212, 6, 6, C.shadow);
    px(c, x - 1, 205 + tick % 2, 8, 1, C.ripple);
  }
}

// 手竿：从 (x0,y0) 到 (x1,y1) 的一串 2×1 像素，前段带软木握把，末段颜色变浅显得细
function rod(c, x0, y0, x1, y1) {
  const steps = Math.abs(x1 - x0) / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    px(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2, t < 0.1 ? 2 : 1, t < 0.1 ? C.cork : t < 0.7 ? C.rod : C.rodTip);
  }
}

function gear(c, phase) {
  px(c, 70, 172, 1, 4, C.bucketRim); px(c, 80, 172, 1, 4, C.bucketRim); px(c, 70, 171, 11, 1, C.bucketRim);
  px(c, 68, 178, 14, 12, C.bucket); px(c, 67, 176, 16, 3, C.bucketRim); px(c, 69, 177, 12, 1, C.water);
  if (phase === 'empty-hook' || phase === 'anger') {
    px(c, 85, 165, 16, 1, C.seat); px(c, 85, 166, 16, 2, C.seatDark);
    px(c, 86, 168, 2, 6, C.stoolLeg); px(c, 98, 168, 2, 6, C.stoolLeg);
  } else {
    // 小凳翻倒在原地，凳面竖着、两条腿朝右
    px(c, 88, 166, 3, 14, C.seatDark); px(c, 91, 168, 8, 2, C.stoolLeg); px(c, 91, 176, 8, 2, C.stoolLeg);
  }
  if (phase === 'empty-hook') {
    // 竿尖压在跳跃弧线的最高点之下，鱼线垂进钓台外的河水
    rod(c, 103, 165, 246, 135);
    px(c, 246, 135, 1, 15, C.line); px(c, 245, 149, 3, 2, C.bobber); px(c, 243, 151, 7, 1, C.ripple);
  } else {
    rod(c, 100, 190, 236, 182);
    px(c, 238, 182, 8, 1, C.rodTip); px(c, 246, 182, 1, 7, C.line); px(c, 245, 188, 3, 2, C.bobber);
  }
}

function fish(c, x, y, facingLeft, tick) {
  const dir = facingLeft ? -1 : 1;
  px(c, x, y, 13, 6, C.fish); px(c, x + 3, y, 7, 2, C.fishLight);
  px(c, x + (dir > 0 ? -4 : 13), y + 1, 4, 5, C.fishDark); px(c, x + (dir > 0 ? 10 : 1), y + 2, 2, 2, C.eye);
  px(c, x + 5, y + 6, 3, 2, C.fishDark);
  // 鱼在水面下：盖一层半透明河水，再在它上方漾一道水纹
  px(c, x - 5, y - 1, 23, 10, C.fishUnder);
  px(c, x - 2 + (tick % 2), y - 4, 16, 1, C.ripple);
}

function reeds(c, x, y, n, tick, base) {
  for (let i = 0; i < n; i++) {
    const h = base + (i % 3) * 5, sway = (tick + i) % 8 < 4 ? 0 : 1;
    px(c, x + i * 4 + sway, y - h, 1, h, C.reed); px(c, x + i * 4 + sway - 1, y - h - 4, 3, 5, C.reedHead);
  }
}

function splash(c, x, y, tick) {
  const burst = tick % 3;
  px(c, x - 34, y + 10, 68, 3, C.ripple); px(c, x - 40, y + 16, 80, 2, C.rippleDark);
  px(c, x - 28, y + 6, 56, 6, C.spray);
  px(c, x - 19, y - 2, 38, 10, C.foam); px(c, x - 14, y - 8 - burst, 28, 8, C.foam);
  px(c, x - 5, y - 20 - burst * 2, 10, 14, C.foam); px(c, x - 2, y - 26 - burst * 3, 4, 8, C.spray);
  px(c, x - 30, y - 6 + burst, 4, 12, C.foam); px(c, x + 26, y - 9 - burst, 4, 14, C.foam);
  px(c, x - 38, y + 1 - burst, 3, 6, C.spray); px(c, x + 35, y - 3 + burst, 3, 7, C.spray);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * Math.PI, r = 24 + burst * 5 + (i % 3) * 4;
    px(c, x + Math.cos(a) * r, y - 4 - Math.sin(a) * r * 0.7, 2, 2, i % 2 ? C.foam : C.spray);
  }
  for (let k = 0; k < 3; k++) {
    const r = 34 + k * 12 + burst * 3, ry = y + 14 + k * 4, color = k ? C.rippleDark : C.ripple;
    px(c, x - r, ry, 12, 1, color); px(c, x + r - 12, ry, 12, 1, color);
  }
}

function drips(c, x, y, tick) {
  const fall = tick % 4;
  for (const [dx, dy, ph] of [[3, 30, 0], [9, 38, 2], [15, 34, 1], [21, 30, 3], [12, 44, 2]]) {
    const d = (fall + ph) % 4;
    px(c, x + dx, y + dy + d * 2, 1, d === 3 ? 3 : 2, d === 3 ? C.spray : C.ripple);
  }
  px(c, x - 2, y + 45, 28, 2, C.wetFloor);
}

// 湿衣服：只在躯干和裤腿的位置压一层半透明深色，贴着人形不会在木板上留出方框
function wetClothes(c, x, y, crouch) {
  if (crouch) { px(c, x + 4, y + 25, 16, 12, C.wet); px(c, x, y + 36, 24, 6, C.wet); } else { px(c, x + 4, y + 15, 16, 17, C.wet); px(c, x + 5, y + 31, 14, 12, C.wet); }
}

function swimmer(c, choreo, tick) {
  const x = choreo.maX, y = choreo.maY + tick % 2;
  person(c, x, y, 'ma', 'crouch', tick, { headUp: true });
  // 河面从下巴底下盖住整个身子，只剩脑袋和两只手；盖水的矩形只比人形宽一像素，免得在水纹上留出方框
  px(c, x - 2, y + 24, 30, 24, C.water);
  px(c, x - 6, y + 24, 36, 1, C.spray);
  px(c, x - 6 + tick % 3, y + 46, 12, 1, C.ripple); px(c, x + 16 - tick % 3, y + 47, 14, 1, C.ripple);
  px(c, x - 12 - tick % 3, y + 26, 12, 1, C.ripple); px(c, x + 24 + tick % 3, y + 27, 12, 1, C.ripple);
  const left = tick % 2;
  px(c, x - 6 - left * 3, y + 18 + left * 2, 7, 3, C.skin); px(c, x + 23 + (1 - left) * 3, y + 20 - left * 2, 7, 3, C.skin);
  px(c, x - 8 + left * 2, y + 22, 4, 2, C.foam); px(c, x + 26, y + 23 - left, 4, 2, C.foam);
  for (let i = 0; i < 5; i++) px(c, x - 16 + ((i * 17 + tick * 3) % 56), y + 30 + (i * 5) % 14, 3, 1, i % 2 ? C.ripple : C.spray);
}

function ma(c, choreo, tick) {
  const { phase, maX: x, maY: y } = choreo;
  if (phase === 'swim') return swimmer(c, choreo, tick);
  const crouch = phase === 'climb' || phase === 'splash';
  const pose = phase === 'empty-hook' ? 'sit' : phase === 'run' ? `walk${tick % 4}` : crouch ? 'crouch' : 'stand';
  const wet = phase === 'climb' || phase === 'shake';
  if (phase === 'leap') px(c, x + 4, 175, 21, 2, `rgba(0,0,0,${(0.3 - (128 - y) / 240).toFixed(2)})`);
  // 上岸和甩水时背对河面朝左，其余阶段都面向右边的河水和鱼
  person(c, x, y, 'ma', pose, tick, { flip: wet, arm: phase === 'anger' ? 'point' : phase === 'leap' ? 'reach' : 'none', headDown: phase === 'empty-hook' });
  if (wet) wetClothes(c, x, y, crouch);
  if (phase === 'splash') { px(c, x - 4, 153, 32, 22, C.water); splash(c, x + 12, 153, tick); }
  if (phase === 'climb') {
    // 还泡在钓台外河水里的半截身子被水面盖住，爬上木板的部分才露出来
    const edge = Math.max(DECK_END, x - 2);
    if (x + 28 > edge) { px(c, edge, y + 30, x + 28 - edge, 18, C.water); px(c, x + 30, y + 40 + tick % 2, 14, 1, C.ripple); px(c, edge, y + 30, x + 28 - edge, 1, C.spray); }
  }
  if (wet) drips(c, x, y, tick);
  if (phase === 'shake') {
    const side = tick % 2 ? 1 : -1;
    for (let k = 0; k < 4; k++) px(c, x + 12 + side * (10 + k * 5 + (tick % 3) * 2), y + 4 + k * 3, 2, 1, C.spray);
  }
}

export function drawRiverFightScene(c, { choreo, tick }) {
  skyline(c, tick);
  bridge(c, tick);
  farRiver(c, tick);
  promenade(c);
  landing(c);
  river(c, tick);
  reeds(c, 96, 150, 4, tick, 10);
  dock(c, tick);
  gear(c, choreo.phase);
  fish(c, choreo.fishX, choreo.phase === 'swim' ? 170 + (tick % 2) * 5 : 176, choreo.fishX < 350, tick);
  ma(c, choreo, tick);
  reeds(c, 210, 248, 6, tick, 20);
}
