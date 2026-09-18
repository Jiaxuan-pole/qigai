// 开场专用像素场景（480×270 逻辑像素）。和地图共用的 pixel.js 分开，是为了让开场能画得更细而不拖累地图。
// 所有元素都用整数像素矩形拼，光晕与雾用极少量半透明渐变点缀，其余保持硬边像素。

const P = {
  night: '#070b12', skyA: '#141f30', skyB: '#22364b', skyC: '#3e5a6e', skyD: '#7b8f95', skyE: '#c9b58a', horizon: '#e0a862', horizonHot: '#f0c27a',
  farCity: '#1c2a39', farCity2: '#25364a', midCity: '#2f4557', midCity2: '#3a5266', window: '#e6c27c', windowDim: '#8c7a55', fog: '#b8c6c8',
  road: '#2b353b', roadNear: '#232c31', lane: '#8c9598', curb: '#55646a', walk: '#4c5a60',
  concrete: '#66787c', concreteL: '#7d8f92', concreteD: '#4a5b60', concreteX: '#38474c', stain: '#55666a', joint: '#1f2b30',
  groundA: '#33434a', groundB: '#2a373d', puddle: '#40525c', puddleL: '#5a7078',
  skin: '#d9a577', skinD: '#b98358', hair: '#1e1a1c', hairFan: '#2a211c', eye: '#20232a',
  xuanHood: '#252b2e', xuanHoodD: '#171c1e', xuanHoodL: '#3b4448', xuanShirt: '#252b2e', pants: '#2c3138', pantsD: '#20242a', shoe: '#1f2226', sole: '#d8d6cf',
  fanJacket: '#c69a32', fanJacketD: '#8c6a20', fanJacketL: '#e1b94e', fanShirt: '#467aa1', fanPants: '#456784', fanPantsD: '#304b61', fanBoot: '#b8832d',
  maShirt: '#252b2e', maPants: '#626b70', maPantsD: '#4e565b', maShoe: '#d8d6cf', maSole: '#aeb4b5',
  bag: '#25303a', bagL: '#3a4856', box: '#c9b389', boxD: '#a8926c', boxL: '#dcc9a3', suitcase: '#4a4a52', suitcaseL: '#5f5f69', marker: '#5a4633',
  phone: '#9fd6ff', phoneGlow: 'rgba(159,214,255,0.35)', ember: '#ff7a3a', flame: '#ffb347', spark: '#ffd27a', smoke: '#aeb6b6', smoke2: '#8e9797',
  busBody: '#7fa39c', busL: '#a9c6c0', busWin: '#d9e2df', busD: '#54746f', tire: '#1d2226', stallWood: '#8e6049', stallRoof: '#c5b08a', steam: '#dfe6e3', steamer: '#9aa3a1',
  cat: '#c98b4a', catL: '#e6b37a', cloud: '#c9d3d3', cloudD: '#a9b6b6', bikeMetal: '#7a8a8f', bottle: '#a8c7bd',
};

export function px(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// 棋盘抖动：用两种颜色的间隔像素做渐变，像素画里表现雾和光的常用手法。
function dither(c, x, y, w, h, color, step = 2, phase = 0) {
  c.fillStyle = color;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) % step; xx < w; xx += step) c.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
}

// 少量柔光：只给手机、火苗、车灯用，其他地方都是硬边。
function glow(c, x, y, r, color, alpha = 0.3) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const k = Math.max(0, Math.min(1, t));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// 天空：按 dawn（0 深夜 → 1 白天）在几组颜色间过渡，分五条横带，带间用抖动接缝。
export function sky(c, dawn, w = 480, h = 160) {
  const stops = dawn < 0.5
    ? [[P.night, P.skyA], [P.skyA, P.skyB], [P.skyB, P.skyC], [P.skyC, P.horizon]]
    : [[P.skyB, P.skyC], [P.skyC, P.skyD], [P.skyD, '#a8b3ad'], ['#a8b3ad', '#d4c4a2']];
  const t = dawn < 0.5 ? dawn / 0.5 : (dawn - 0.5) / 0.5;
  const bands = 5;
  const bh = h / bands;
  const colors = [];
  for (let i = 0; i < bands; i++) {
    const s = stops[Math.min(stops.length - 1, i)] || stops[stops.length - 1];
    colors.push(lerpColor(s[0], s[1], t));
  }
  for (let i = 0; i < bands; i++) {
    px(c, 0, i * bh, w, bh + 1, colors[i]);
    if (i < bands - 1) dither(c, 0, (i + 1) * bh - 4, w, 4, colors[i + 1], 2, i);
  }
  // 地平线上的一道暖光。
  const hot = dawn < 0.5 ? P.horizon : '#e6c890';
  dither(c, 0, h - 8, w, 8, hot, dawn < 0.5 ? 4 : 3, 1);
  px(c, 0, h - 2, w, 2, hot);
}

// 远景城市：两层剪影按不同速度极慢地漂移，窗户有的亮有的暗，偶尔一扇闪一下。
const FAR = [[0, 62, 26, 98], [30, 40, 34, 120], [70, 74, 22, 86], [96, 30, 40, 130], [140, 58, 30, 102], [176, 22, 46, 138], [228, 48, 28, 112], [262, 36, 52, 124], [320, 66, 26, 94], [352, 28, 44, 132], [402, 54, 36, 106], [444, 44, 48, 116]];
const MID = [[-10, 96, 60, 70], [56, 82, 48, 84], [110, 104, 38, 62], [154, 88, 70, 78], [232, 98, 44, 68], [282, 78, 58, 88], [348, 100, 40, 66], [394, 86, 62, 80], [462, 96, 50, 70]];
export function cityFar(c, tick, dawn, offset = 0) {
  const shift = Math.round(Math.sin(tick / 400) * 3) + offset;
  for (const [x, y, w, h] of FAR) {
    px(c, x + shift, y, w, h + 30, lerpColor(P.farCity, P.midCity, dawn * 0.65));
    px(c, x + shift + 2, y + 2, w - 4, 2, lerpColor(P.farCity2, P.midCity2, dawn * 0.65));
    for (let wy = y + 8; wy < y + h - 4; wy += 9) for (let wx = x + 5; wx < x + w - 3; wx += 8) {
      const seed = (wx * 7 + wy * 13) % 11;
      const lit = seed < 4 && dawn < 0.95;
      const blink = seed === 5 && Math.floor(tick / 25) % 9 === (wx % 9);
      if (lit || blink) px(c, wx + shift, wy, 2, 3, dawn > 0.7 ? P.windowDim : P.window);
    }
  }
  // 塔尖与天线
  px(c, 196 + shift, 6, 3, 18, lerpColor(P.farCity, P.midCity, dawn * 0.4)); px(c, 197 + shift, 2, 1, 5, '#8a9398');
  px(c, 374 + shift, 14, 2, 16, lerpColor(P.farCity, P.midCity, dawn * 0.4));
}
export function cityMid(c, tick, dawn, offset = 0) {
  const shift = Math.round(Math.sin(tick / 260) * 5) + offset;
  for (const [x, y, w, h] of MID) {
    px(c, x + shift, y, w, h + 20, lerpColor(P.midCity, P.midCity2, dawn * 0.5));
    px(c, x + shift, y, w, 3, lerpColor(P.midCity2, '#4d6678', dawn * 0.5));
    // 楼顶水箱和空调外机
    if (w > 44) { px(c, x + shift + 8, y - 8, 10, 8, '#3d5364'); px(c, x + shift + 7, y - 9, 12, 2, '#5a7283'); }
    for (let wy = y + 10; wy < y + h - 6; wy += 11) for (let wx = x + 6; wx < x + w - 5; wx += 10) {
      const seed = (wx * 5 + wy * 3) % 7;
      if (seed < 2 && dawn < 0.9) px(c, wx + shift, wy, 3, 4, P.window);
      else px(c, wx + shift, wy, 3, 4, lerpColor('#1f2f3c', '#6f8593', dawn));
    }
  }
}

// 雾带：三条半透明抖动带随时间横向漂。
export function fog(c, tick, y0 = 110, strength = 1) {
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * 22 + Math.round(Math.sin(tick / 60 + i) * 3);
    const drift = Math.round((tick * (0.4 + i * 0.2)) % 480);
    c.save();
    c.globalAlpha = 0.18 * strength;
    px(c, 0, y, 480, 10, P.fog);
    c.globalAlpha = 0.28 * strength;
    dither(c, drift - 480, y - 3, 960, 16, P.fog, 3, i);
    c.restore();
  }
}

// 鸟：两帧扇翅的小 V。
function birds(c, tick, items) {
  for (const [bx, by, phase] of items) {
    const f = Math.floor(tick / 6 + phase) % 2;
    const x = (bx + Math.floor(tick / 3)) % 520 - 20;
    px(c, x, by + f, 2, 1, '#1e2a34'); px(c, x + 2, by, 2, 1, '#1e2a34'); px(c, x + 4, by + f, 2, 1, '#1e2a34');
  }
}

// 街道层：早餐摊、公交、保安与广告牌。
function stall(c, x, y, tick, steam) {
  px(c, x, y - 30, 78, 6, P.stallRoof); px(c, x - 3, y - 26, 84, 3, '#a8926c');
  px(c, x + 3, y - 24, 3, 24, P.stallWood); px(c, x + 72, y - 24, 3, 24, P.stallWood);
  px(c, x + 2, y - 8, 74, 14, P.stallWood); px(c, x + 2, y - 8, 74, 2, '#a97655');
  px(c, x + 14, y - 22, 26, 14, P.steamer); px(c, x + 12, y - 24, 30, 3, '#b8c0be'); px(c, x + 16, y - 20, 22, 1, '#7f8886');
  px(c, x + 48, y - 20, 18, 12, '#6c5a48'); px(c, x + 50, y - 22, 14, 2, '#8c7862');
  px(c, x + 6, y - 14, 5, 6, '#d24b3c'); px(c, x + 6, y - 14, 5, 1, '#f0e6d2');
  if (steam) for (let i = 0; i < 6; i++) {
    const t = (tick * 2 + i * 11) % 34;
    const sx = x + 18 + i * 4 + Math.round(Math.sin((tick + i * 7) / 5) * 2);
    c.save(); c.globalAlpha = 1 - t / 34; px(c, sx, y - 26 - t, 3, 3, P.steam); c.restore();
  }
}
function bus(c, x, y, tick, stopped) {
  px(c, x, y - 34, 92, 34, P.busBody); px(c, x, y - 34, 92, 4, P.busL); px(c, x, y - 12, 92, 2, P.busD);
  for (let i = 0; i < 4; i++) px(c, x + 6 + i * 20, y - 29, 15, 12, P.busWin);
  px(c, x + 84, y - 29, 6, 12, P.busWin);
  px(c, x + 62, y - 14, 12, 14, '#5f7f79'); px(c, x + 63, y - 13, 10, 12, '#94b1ab');
  const spin = Math.floor(tick / 2) % 2;
  for (const wx of [x + 12, x + 72]) { px(c, wx, y - 6, 12, 10, P.tire); px(c, wx + 4 + spin, y - 3, 4, 4, '#4b5257'); }
  px(c, x - 2, y - 16, 3, 3, stopped && Math.floor(tick / 8) % 2 ? '#ff5a3a' : '#7a2b22');
  px(c, x + 91, y - 18, 2, 3, '#f2e2a8');
}
function guard(c, x, y, tick, lift) {
  // 保安：深蓝制服；广告牌从倒地慢慢扶起来（lift 0→1）。
  px(c, x + 3, y - 34, 8, 7, P.hair); px(c, x + 4, y - 30, 7, 6, P.skin);
  px(c, x + 2, y - 24, 11, 14, '#2c3d5f'); px(c, x + 4, y - 22, 7, 2, '#c9cbd0');
  px(c, x + 3, y - 10, 4, 10, '#20283a'); px(c, x + 8, y - 10, 4, 10, '#20283a');
  px(c, x + 2, y - 1, 5, 2, P.shoe); px(c, x + 8, y - 1, 5, 2, P.shoe);
  const ang = lift;
  const bw = 30, bh = 20;
  const bx = x + 14, by = y - 2;
  // 用几段矩形近似倾斜的牌子：lift 越大越直立。
  const seg = 5;
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    const sx = bx + t * bw * (1 - ang) + t * 4 * ang;
    const sy = by - t * bh * ang - (1 - ang) * 4;
    px(c, sx, sy, bw / seg + 1, 4 + ang * 2, i % 2 ? '#c7a970' : '#d8bb82');
  }
  px(c, x + 12, y - 8, 3, 3, P.skin);
}

export function cityScene(c, view) {
  const { tick, dawn, fx } = view;
  sky(c, dawn, 480, 172);
  cityFar(c, tick, dawn);
  birds(c, tick, [[60, 44, 0], [78, 50, 1], [300, 36, 2]]);
  fog(c, tick, 96, 0.9);
  cityMid(c, tick, dawn);
  fog(c, tick + 40, 138, 0.6);
  // 人行道与路
  px(c, 0, 172, 480, 10, P.walk); px(c, 0, 180, 480, 3, P.curb);
  px(c, 0, 183, 480, 87, P.road); px(c, 0, 236, 480, 34, P.roadNear);
  for (let x = -20; x < 480; x += 46) px(c, x + Math.round((tick * 0.5) % 46), 214, 22, 2, P.lane);
  stall(c, 26, 176, tick, fx.steam);
  if (fx.bus) {
    const dur = 2600; const t = Math.min(1, view.sceneAge / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    bus(c, 470 - ease * 210, 186, tick, t >= 1);
  }
  // 站牌、保安与倒下的广告牌
  px(c, 424, 132, 3, 50, '#8a9398'); px(c, 418, 126, 16, 9, '#cfd7d6'); px(c, 421, 129, 10, 3, '#4a6f9a');
  guard(c, 388, 182, tick, fx.bus ? Math.min(1, Math.max(0, (view.sceneAge - 900) / 1600)) : 0);
  // 路灯还亮着
  px(c, 300, 120, 3, 62, '#6a7579'); px(c, 292, 116, 19, 5, '#8c9598'); px(c, 294, 121, 15, 3, dawn < 0.9 ? P.window : '#b7b099');
  if (dawn < 0.9) glow(c, 301, 124, 26, 'rgba(230,194,124,1)', 0.22);
}

// 黑屏：拖着的行李箱剪影，坏轮子每隔几步磕一下。
export function blackScene(c, view) {
  const { tick, sceneAge } = view;
  px(c, 0, 0, 480, 270, P.night);
  dither(c, 420, 0, 60, 30, '#141d29', 2, 0); dither(c, 380, 0, 100, 60, '#111926', 3, 1); dither(c, 330, 0, 150, 90, '#0e1520', 5, 0); dither(c, 280, 0, 200, 120, '#0c121b', 8, 1);
  for (let i = 0; i < 5; i++) if ((i * 37 + Math.floor(tick / 30)) % 5 === 0) px(c, 350 + i * 26, 20 + (i * 17) % 40, 1, 1, P.windowDim);
  const x = -40 + (sceneAge / 6500) * 560;
  const bump = Math.floor(sceneAge / 700) % 3 === 0 && (sceneAge % 700) < 120 ? -3 : 0;
  px(c, 0, 236, 480, 2, '#121a22');
  // 箱子：剪影带一点边缘反光
  px(c, x, 196 + bump, 26, 40, '#141b22'); px(c, x + 2, 198 + bump, 22, 36, '#1b232c'); px(c, x + 6, 200 + bump, 1, 32, '#2a343d');
  px(c, x + 10, 184 + bump, 6, 12, '#141b22'); px(c, x + 11, 186 + bump, 4, 8, '#1f2830');
  px(c, x + 3, 236, 6, 5, '#0d1116'); px(c, x + 18, 236 + (bump ? 0 : 0), 6, 5, '#0d1116');
  if (bump) px(c, x + 20, 241, 4, 1, '#3a4650');
  // 轮子拖出的一道痕
  dither(c, 0, 240, Math.max(0, x), 2, '#1a222a', 3, tick % 3);
}

export function departureScene(c, view) {
  const { tick, sceneAge } = view;
  blackScene(c, view);
  const reveal = Math.min(1, Math.max(0, (sceneAge - 180) / 650));
  c.save();
  c.globalAlpha = reveal;
  px(c, 0, 236, 480, 34, '#111a20');
  px(c, 0, 235, 480, 2, '#26353b');
  const stride = Math.floor(tick / 2) % 4;
  const { xuanX, fanX, xuanCaseX, fanCaseX, xuanHandleX, fanHandleX, sackX } = departureLayout(sceneAge);
  person(c, xuanX, 190, 'xuan', 'walk' + stride, stride, { arm: 'reach' });
  person(c, fanX, 190, 'fan', 'walk' + ((stride + 2) % 4), stride, { arm: 'reach', headDown: true });
  departureCase(c, xuanCaseX, 202, tick, '#4a4a52', '#5f5f69');
  departureCase(c, fanCaseX, 202, tick + 7, '#4a4a52', '#7a6254');
  px(c, xuanHandleX, 206, 9, 2, '#8e9898');
  px(c, fanHandleX, 206, 9, 2, '#8e9898');
  departureSack(c, sackX, 181);
  c.restore();
}

export function departureLayout(sceneAge) {
  const xuanX = 76 + Math.min(1, sceneAge / 6100) * 244;
  const fanX = xuanX + 72;
  return { xuanX, fanX, xuanCaseX: xuanX + 34, fanCaseX: fanX + 34, xuanHandleX: xuanX + 27, fanHandleX: fanX + 27, sackX: fanX - 9 };
}

function departureCase(c, x, y, tick, shell, rim) {
  px(c, x, y, 22, 30, shell); px(c, x + 2, y + 2, 18, 26, rim); px(c, x + 3, y + 6, 16, 2, '#2b3038');
  px(c, x + 4, y + 10, 14, 1, '#69757c'); px(c, x + 10, y - 8, 3, 8, shell);
  const wheel = Math.floor(tick / 3) % 2;
  px(c, x + 2, y + 30, 6, 4, '#15191e'); px(c, x + 15, y + 30, 6, 4, '#15191e');
  px(c, x + 4 + wheel, y + 31, 2, 2, '#a0a7a4'); px(c, x + 17 + wheel, y + 31, 2, 2, '#a0a7a4');
}

function departureSack(c, x, y) {
  px(c, x, y, 21, 19, '#d7cfaa'); px(c, x + 2, y - 3, 17, 4, '#ece5c4'); px(c, x + 8, y - 6, 5, 3, '#a99c78');
  px(c, x + 2, y + 3, 17, 1, '#a99c78'); px(c, x + 5, y + 8, 2, 7, '#8a8066'); px(c, x + 13, y + 7, 2, 8, '#8a8066');
  px(c, x + 8, y + 8, 5, 2, '#73725e'); px(c, x + 9, y + 11, 1, 4, '#73725e'); px(c, x + 12, y + 11, 1, 4, '#73725e');
  px(c, x + 3, y + 17, 15, 2, '#b3aa88');
}

// 人物：24×46 站姿基准，姿势用同一套部件变形；who: xuan | fan。
// opts.arm 决定手臂在干什么：none | phone | point | marker | lighter | pocket | hold | reach | cup | throw | hug | wipe | protect | pat | pickup | charger
// opts.cig 嘴上有烟；opts.cigHand 烟拿在手里；opts.ember 烟头亮度 0–1；opts.look 头偏向（-1/1）；opts.headUp/headDown 抬头低头；opts.handY 马克笔手的高度
function personFrame(pose, frame, opts) {
  const crouch = pose === 'crouch', sit = pose === 'sit', bend = pose === 'bend', walk = pose.startsWith('walk');
  const wf = walk ? Number(pose.slice(4)) || frame % 4 : 0;
  const dy = crouch ? 10 : sit ? 8 : bend ? 6 : 0;
  const bob = walk ? (wf % 2 ? 1 : 0) : 0;
  const tx = bend ? 3 : 0;
  const ty = dy - bob;
  const hx = (bend ? 5 : 0) + (opts.look || 0);
  const hy = ty + (bend ? 3 : 0) + (opts.headUp ? -1 : 0) + (opts.headDown ? 2 : 0);
  return { crouch, sit, bend, walk, wf, dy, bob, tx, ty, hx, hy };
}

function personPoint(x, y, point, flip) {
  return [Math.round(x + (flip ? 24 - point[0] : point[0])), Math.round(y + point[1])];
}

// 口、打火机顶端和点火位共享人体局部变换，翻身或蹲坐时不会飘到头顶。
export function personAnchors(x, y, pose = 'stand', frame = 0, opts = {}) {
  const { tx, ty, hx, hy } = personFrame(pose, frame, opts);
  const flip = Boolean(opts.flip);
  const cigarette = personPoint(x, y, [22 + hx, 11 + hy], flip);
  return { cigarette, lighter: personPoint(x, y, [22 + tx, 10 + ty], flip) };
}

export function person(c, x, y, who, pose = 'stand', frame = 0, opts = {}) {
  const xuan = who === 'xuan';
  const ma = who === 'ma';
  const jacket = xuan ? P.xuanHood : ma ? P.maShirt : P.fanJacket;
  const jacketD = xuan ? P.xuanHoodD : ma ? '#171c1e' : P.fanJacketD;
  const jacketL = xuan ? P.xuanHoodL : ma ? '#3b4448' : P.fanJacketL;
  const pants = xuan ? P.pants : ma ? P.maPants : P.fanPants;
  const pantsD = xuan ? P.pantsD : ma ? P.maPantsD : P.fanPantsD;
  const shoe = xuan ? P.shoe : ma ? P.maShoe : P.fanBoot;
  const sole = xuan ? '#141a1f' : ma ? P.maSole : '#7d591c';
  const skin = xuan ? '#ecc19a' : '#b98358';
  const skinD = xuan ? '#d9a577' : '#8f633f';
  const hair = xuan || ma ? '#1e1a1c' : '#d6ad32';
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (opts.flip) { c.translate(24, 0); c.scale(-1, 1); }
  const { crouch, sit, bend, walk, wf, dy, bob, tx, ty, hx, hy } = personFrame(pose, frame, opts);
  const th = crouch ? 12 : sit ? 15 : 17;
  const arm = opts.arm || (opts.phone ? 'phone' : opts.point ? 'point' : opts.marker ? 'marker' : opts.lighter ? 'lighter' : 'none');
  // 影子
  px(c, 1, 45, 24, 2, 'rgba(0,0,0,0.35)');
  // 腿与脚
  if (crouch) {
    px(c, 2, 36, 22, 6, pants); px(c, 2, 36, 22, 2, pantsD); px(c, 18, 38, 6, 6, pants); px(c, 0, 39, 5, 5, pants);
    px(c, 17, 42, 9, 4, shoe); px(c, -1, 42, 8, 4, shoe); px(c, 17, 45, 9, 1, sole); px(c, -1, 45, 8, 1, sole);
  } else if (sit) {
    px(c, 4, 30, 12, 8, pants); px(c, 10, 34, 18, 6, pants); px(c, 24, 38, 8, 5, pants);
    px(c, 28, 41, 8, 4, shoe); px(c, 28, 44, 8, 1, sole); px(c, 22, 41, 6, 4, shoe);
  } else {
    const l = walk ? [0, 3, 0, -3][wf] : 0;
    px(c, 5 + l, 31 - bob, 6, 12, pants); px(c, 13 - l, 31 - bob, 6, 12, pants);
    px(c, 5 + l, 31 - bob, 6, 2, pantsD); px(c, 13 - l, 31 - bob, 6, 2, pantsD);
    px(c, 3 + l, 42 - bob, 9, 4, shoe); px(c, 12 - l, 42 - bob, 9, 4, shoe);
    px(c, 3 + l, 45 - bob, 9, 1, sole); px(c, 12 - l, 45 - bob, 9, 1, sole);
  }
  // 躯干
  px(c, 4 + tx, 15 + ty, 16, th, jacket);
  px(c, 4 + tx, 15 + ty, 16, 2, jacketL);
  px(c, 4 + tx, 15 + ty, 16, 1, '#141a1f');
  px(c, 4 + tx, 15 + th - 4 + ty, 16, 4, jacketD);
  if (xuan) { px(c, 10 + tx, 18 + ty, 4, 8, P.xuanShirt); px(c, 10 + tx, 15 + ty, 4, 3, '#778387'); px(c, 11 + tx, 18 + ty, 2, 8, '#778387'); px(c, 11 + tx, 26 + ty, 2, 5, jacketD); px(c, 2 + tx, 13 + ty, 20, 4, jacketD); }
  else if (ma) { px(c, 3 + tx, 13 + ty, 19, 4, jacketD); px(c, 13 + tx, 20 + ty, 3, 11, '#171c1e'); }
  else { px(c, 8 + tx, 17 + ty, 8, 11, P.fanShirt); px(c, 5 + tx, 15 + ty, 3, 15, P.fanJacketL); px(c, 17 + tx, 15 + ty, 3, 15, P.fanJacketL); }
  if (!xuan) px(c, 6 + tx, 15 + ty, 2, 15, P.bag); else px(c, 16 + tx, 15 + ty, 2, 15, P.bag);
  // 手臂：左臂（画面左侧，x 小）与右臂（x 大，靠近脸的那只在翻转后朝向对方）
  const swing = walk ? [0, 2, 0, -2][wf] : 0;
  const leftArm = (ay = 0) => { px(c, 1 + tx, 17 + ty + ay, 4, 12, jacket); px(c, 1 + tx, 28 + ty + ay, 4, 3, skin); };
  const rightArm = (ay = 0) => { px(c, 19 + tx, 17 + ty + ay, 4, 12, jacket); px(c, 19 + tx, 28 + ty + ay, 4, 3, skin); };
  if (arm === 'phone') {
    leftArm();
    px(c, 19 + tx, 17 + ty, 4, 6, jacket); px(c, 17 + tx, 20 + ty, 6, 4, jacket); px(c, 14 + tx, 22 + ty, 4, 4, skin);
    px(c, 12 + tx, 15 + ty, 5, 8, P.phone); px(c, 13 + tx, 16 + ty, 3, 6, '#dff2ff');
  } else if (arm === 'point') {
    leftArm();
    px(c, 19 + tx, 16 + ty, 12, 3, jacket); px(c, 30 + tx, 15 + ty, 4, 3, skin);
  } else if (arm === 'marker') {
    leftArm();
    const hy = opts.handY ?? 25;
    px(c, 19 + tx, 20 + ty, 6, 4, jacket); px(c, 24 + tx, 22 + ty, 5, Math.max(3, hy - 22 + ty), jacket); px(c, 27 + tx, hy - 1, 4, 4, skin); px(c, 30 + tx, hy + 2, 2, 6, P.marker);
  } else if (arm === 'lighter' || arm === 'cup') {
    leftArm();
    // 手拢在嘴边，攥着打火机。
    px(c, 19 + tx, 17 + ty, 4, 6, jacket); px(c, 17 + tx, 11 + ty, 5, 7, jacket); px(c, 18 + tx, 8 + ty, 5, 4, skin); px(c, 21 + tx, 6 + ty, 2, 4, '#8a9aa6');
  } else if (arm === 'throw') {
    leftArm();
    px(c, 19 + tx, 17 + ty, 4, 6, jacket); px(c, 17 + tx, 11 + ty, 5, 7, jacket); px(c, 18 + tx, 8 + ty, 5, 4, skin);
  } else if (arm === 'hug') {
    leftArm();
    px(c, 19 + tx, 17 + ty, 11, 4, jacket); px(c, 28 + tx, 16 + ty, 4, 3, skin);
  } else if (arm === 'wipe') {
    leftArm();
    px(c, 19 + tx, 17 + ty, 4, 6, jacket); px(c, 17 + tx, 10 + ty, 5, 7, jacket); px(c, 18 + tx, 8 + ty, 5, 4, skin);
  } else if (arm === 'pocket') {
    rightArm();
    px(c, 1 + tx, 17 + ty, 4, 8, jacket); px(c, 3 + tx, 24 + ty, 5, 4, jacket); px(c, 6 + tx, 26 + ty, 3, 3, skin);
  } else if (arm === 'hold') {
    rightArm();
    px(c, 1 + tx, 17 + ty, 4, 7, jacket); px(c, 2 + tx, 22 + ty, 6, 4, jacket); px(c, 6 + tx, 20 + ty, 4, 4, skin);
    if (opts.pack) { px(c, 4 + tx, 13 + ty + (opts.packShake || 0), 6, 8, '#e8e2d2'); px(c, 4 + tx, 13 + ty + (opts.packShake || 0), 6, 2, '#c9443a'); if (opts.packCigs) { px(c, 5 + tx, 10 + ty + (opts.packShake || 0), 1, 4, '#f2eee4'); px(c, 8 + tx, 9 + ty + (opts.packShake || 0), 1, 5, '#f2eee4'); } }
    if (opts.cigHand) { px(c, 6 + tx, 19 + ty, 1, 5, '#e9e2d2'); px(c, 6 + tx, 18 + ty, 1, 1, opts.ember > 0.5 ? '#ff9a4a' : P.ember); }
    if (opts.charger) { px(c, 2 + tx, 15 + ty, 7, 6, '#1d2126'); px(c, 3 + tx, 16 + ty, 2, 2, '#4a5560'); const loops = Math.max(0, Math.min(3, opts.chargerLoops ?? 3)); for (let i = 0; i < loops; i++) px(c, 0 + tx + i * 3, 21 + ty + (i % 2), 2, 5, '#1d2126'); }
  } else if (arm === 'reach') {
    leftArm();
    px(c, 19 + tx, 17 + ty, 10, 3, jacket); px(c, 28 + tx, 16 + ty, 4, 3, skin);
  } else if (arm === 'protect') {
    px(c, 8 + tx, 20 + dy, 4, 14, jacket); px(c, 16 + tx, 20 + dy, 4, 14, jacket); px(c, 8 + tx, 33 + dy, 4, 3, skin); px(c, 16 + tx, 33 + dy, 4, 3, skin);
  } else if (arm === 'pat') {
    leftArm();
    const down = opts.patDown ? 4 : 0;
    px(c, 19 + tx, 17 + ty, 4, 10 + down, jacket); px(c, 19 + tx, 27 + ty + down, 4, 3, skin);
  } else if (arm === 'pickup') {
    leftArm();
    px(c, 19 + tx, 17 + ty, 4, 14, jacket); px(c, 19 + tx, 30 + ty, 4, 3, skin);
    px(c, 17 + tx, 33 + ty, 10, 7, P.bag); px(c, 19 + tx, 32 + ty, 6, 2, P.bagL);
  } else if (bend) {
    px(c, 8 + tx, 20 + dy, 4, 14, jacket); px(c, 16 + tx, 20 + dy, 4, 14, jacket); px(c, 8 + tx, 33 + dy, 4, 3, skin); px(c, 16 + tx, 33 + dy, 4, 3, skin);
  } else if (sit) {
    px(c, 1, 17 + dy, 4, 12, jacket); px(c, 19, 17 + dy, 4, 10, jacket); px(c, 19, 26 + dy, 4, 4, skin); px(c, 1, 28 + dy, 4, 3, skin);
  } else {
    leftArm(swing); rightArm(-swing);
  }
  // 头：头发、脸、眼镜或胡茬；抬头低头只动一两像素，像素画里够用了。
  px(c, 5 + hx, 5 + hy, 14, 10, skin);
  px(c, 5 + hx, 12 + hy, 14, 3, skinD);
  px(c, 4 + hx, 0 + hy, 16, 6, hair);
  px(c, 3 + hx, 3 + hy, 3, 6, hair); px(c, 18 + hx, 3 + hy, 3, 5, hair);
  if (!xuan) { px(c, 2 + hx, 1 + hy, 3, 3, hair); px(c, 19 + hx, 0 + hy, 3, 3, hair); px(c, 8 + hx, -1 + hy, 6, 2, hair); }
  const ey = opts.headUp ? -1 : opts.headDown ? 1 : 0;
  px(c, 8 + hx, 9 + hy + ey, 2, 2, P.eye); px(c, 14 + hx, 9 + hy + ey, 2, 2, P.eye);
  if (!xuan) dither(c, 7 + hx, 12 + hy, 10, 3, '#8f6a4c', 2, 0);
  if (opts.cig) {
    px(c, 17 + hx, 11 + hy, 2, 1, '#c89b65');
    px(c, 19 + hx, 11 + hy, 3, 1, '#e9e2d2');
    const e = opts.ember ?? 0.3;
    px(c, 22 + hx, 11 + hy, 1, 1, e > 0.6 ? '#ffb060' : e > 0 ? P.ember : '#6a5a52');
  }
  c.restore();
}

// 一根烟从 A 扔到 B：抛物线，t 0→1。
export function tossCig(c, ax, ay, bx, by, t, color = '#e9e2d2', w = 5, h = 1) {
  const x = ax + (bx - ax) * t;
  const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 18;
  px(c, x, y, w, h, color);
}

// 烟：从烟头升起的一串小方块，走正弦曲线、越高越淡越散；exhale 时多一团。
export function smokeCurl(c, x, y, tick, seed = 0, strength = 1) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = ((tick * 1.6 + i * 9 + seed) % 63) / 63;
    const sx = x + Math.round(Math.sin(t * 6 + seed) * (2 + t * 5)) + Math.round(t * 4);
    const sy = y - t * 44;
    const size = t < 0.35 ? 1 : t < 0.7 ? 2 : 3;
    c.save(); c.globalAlpha = Math.max(0, 0.75 - t * 0.75) * strength; px(c, sx, sy, size, size, t > 0.45 ? P.smoke2 : P.smoke); c.restore();
  }
}

// 吸一口的节奏：每 60 tick 一个循环，前 8 tick 烟头变亮，之后呼出一团。
export function drag(tick, seed = 0) {
  const ph = (tick + seed) % 60;
  return { ember: ph < 8 ? 1 : 0.3, exhale: ph >= 10 && ph < 26 ? (ph - 10) / 16 : 0 };
}

// 拍裤子扬起的灰：几个小点往外散。
export function dustPuff(c, x, y, t) {
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI; px(c, x + Math.cos(a) * t * 12, y - Math.sin(a) * t * 7, t < 0.5 ? 2 : 1, t < 0.5 ? 2 : 1, '#cfc6b4'); }
}

// 营地小物：袋子、纸箱、行李箱、相机包、猫。
export function campProps(c, view) {
  const { tick, world } = view;
  const bagX = world.bagX;
  px(c, bagX, 214, 22, 18, '#6f7c6e'); px(c, bagX + 2, 212, 18, 3, '#8b967f'); px(c, bagX + 24, 219, 16, 13, '#5c6a72'); px(c, bagX + 26, 217, 12, 3, '#75838c');
  px(c, bagX + 6, 222, 3, 3, '#4b5749'); px(c, bagX + 30, 226, 5, 2, '#46535a');
  // 纸箱
  px(c, 234, 200, 40, 32, P.box); px(c, 234, 200, 40, 4, P.boxD); px(c, 236, 204, 36, 1, P.boxL); px(c, 250, 200, 2, 32, P.boxD);
  if (world.flap) px(c, 234 + (Math.floor(tick / 14) % 2 ? 0 : 1), 194, 14, 6, P.boxL);
  // 行李箱（合不严）
  px(c, 282, 194, 24, 38, P.suitcase); px(c, 284, 196, 20, 34, P.suitcaseL); px(c, 288, 186, 12, 8, P.suitcase); px(c, 290, 188, 8, 4, '#2b2b30');
  px(c, 282, 210, 24, 2, '#33333a'); px(c, 300, 214, 6, 4, '#b7a172'); px(c, 284, 232, 6, 3, '#1f2226'); px(c, 298, 232, 6, 3, '#1f2226');
  if (world.camBag) { if (world.jacketPad) px(c, 236, 196, 28, 5, '#7a5a3c'); px(c, 240, 188, 22, 11, '#15191f'); px(c, 242, 186, 18, 3, '#3a4652'); px(c, 246, 183, 10, 3, '#3a4652'); px(c, 244, 191, 6, 5, '#2c3540'); px(c, 246, 192, 2, 2, '#8fb3c9'); px(c, 252, 190, 8, 1, '#3a4652'); }
  // 猫：蜷着，偶尔耳朵动一下
  if (world.cat) { px(c, 312, 224, 18, 8, P.cat); px(c, 326, 220, 7, 7, P.cat); px(c, 327 + (Math.floor(tick / 40) % 2), 218, 2, 3, P.cat); px(c, 331, 218, 2, 3, P.cat); px(c, 314, 226, 12, 2, P.catL); px(c, 308, 228, 6, 3, P.cat); }
}

// 桥下：桥面、接缝、两根桥柱（带污渍与涂鸦）、地面与水洼。
export function bridge(c, view) {
  const { tick, dawn } = view;
  sky(c, dawn, 480, 150);
  cityFar(c, tick, dawn, 0);
  fog(c, tick, 92, 0.7);
  cityMid(c, tick, dawn, 0);
  // 远处街道（拉远时露出）
  px(c, 0, 168, 480, 8, P.walk); px(c, 0, 176, 480, 3, P.curb); px(c, 0, 179, 480, 21, P.road);
  // 桥面与桥底
  px(c, 0, 0, 480, 34, P.concreteD); px(c, 0, 0, 480, 6, '#a3a89c'); px(c, 0, 6, 480, 3, P.concreteL);
  for (let x = 0; x < 480; x += 32) px(c, x, 0, 2, 6, '#7c8582');
  px(c, 0, 34, 480, 12, P.concreteX); px(c, 0, 46, 480, 4, '#2c393e');
  dither(c, 0, 50, 480, 6, '#2c393e', 2, 0);
  px(c, 238, 0, 4, 46, P.joint); px(c, 236, 30, 8, 2, '#2a363b');
  // 桥柱
  for (const [x, w, shade] of [[40, 52, 0], [388, 52, 1]]) {
    px(c, x, 34, w, 168, P.concrete); px(c, x + 6, 34, 8, 168, P.concreteL); px(c, x + w - 8, 34, 8, 168, P.concreteD);
    for (let y = 60; y < 200; y += 26) px(c, x + 2, y, w - 4, 2, P.stain);
    dither(c, x + 4, 150, w - 8, 50, P.stain, 3, shade);
    px(c, x - 4, 196, w + 8, 8, P.concreteD);
  }
  // 涂鸦：左柱“人在城市仍是人”，像素小字用色块示意 + 一个笑脸
  px(c, 50, 92, 30, 40, '#d8d3c2'); px(c, 54, 96, 22, 4, '#2b2b30'); px(c, 54, 104, 22, 4, '#2b2b30'); px(c, 54, 112, 16, 4, '#2b2b30'); px(c, 54, 120, 22, 4, '#2b2b30');
  px(c, 58, 128, 3, 2, '#2b2b30'); px(c, 68, 128, 3, 2, '#2b2b30'); px(c, 60, 131, 9, 1, '#2b2b30');
  // 地面
  px(c, 0, 200, 480, 100, P.groundA); px(c, 0, 240, 480, 60, P.groundB); px(c, 0, 200, 480, 3, '#4a5c62');
  px(c, 394, 100, 40, 12, '#e8e2d2'); px(c, 397, 103, 34, 2, '#2b2b30'); px(c, 397, 107, 22, 2, '#2b2b30'); px(c, 394, 100, 40, 1, '#b7b0a0');
  for (let x = 0; x < 480; x += 37) { px(c, x + 5, 246 + (x % 5), 14, 1, '#41545a'); px(c, x + 20, 216 + (x % 7), 6, 2, '#3d4f55'); }
  // 水洼与倒影微光
  px(c, 300, 236, 70, 12, P.puddle); px(c, 296, 240, 78, 5, P.puddle); px(c, 306, 238, 20, 1, P.puddleL); px(c, 330 + (Math.floor(tick / 20) % 3), 244, 12, 1, P.puddleL);
  px(c, 120, 250, 40, 6, P.puddle); px(c, 126, 251, 12, 1, P.puddleL);
  // 桥柱下的暗角
  dither(c, 0, 200, 60, 70, '#1f2a2f', 2, 0); dither(c, 420, 200, 60, 70, '#1f2a2f', 2, 1);
}

// 经过桥面的车：车身在桥顶露出一半，车灯扫过，接缝落灰。
export function carPass(c, view) {
  const t = view.car;
  if (t === null || t === undefined) return;
  const x = -60 + t * 600;
  px(c, x, -2, 44, 10, '#b9b39a'); px(c, x + 6, -6, 26, 5, '#8fa0a5'); px(c, x + 4, 6, 8, 3, '#222'); px(c, x + 32, 6, 8, 3, '#222');
  px(c, x + 43, 1, 3, 3, '#ffe9a8'); px(c, x - 1, 1, 3, 3, '#ff6b4a');
  if (t > 0.25 && t < 0.7) glow(c, 240, 40, 90, 'rgba(255,233,168,1)', 0.12 * Math.sin((t - 0.25) / 0.45 * Math.PI));
}

export function dust(c, items) {
  for (const d of items) { c.save(); c.globalAlpha = Math.max(0, 1 - d.y / 200); px(c, d.x, d.y, d.s || 1, d.s || 1, '#b9b0a0'); c.restore(); }
}

// 烟：几缕从烟头升起、越飘越淡的小方块。
export function smoke(c, x, y, tick, seed = 0) {
  for (let i = 0; i < 4; i++) {
    const t = (tick * 2 + i * 9 + seed) % 36;
    const sx = x + Math.round(Math.sin((tick + i * 5 + seed) / 6) * 2) + Math.floor(t / 12);
    c.save(); c.globalAlpha = 0.9 - t / 36; px(c, sx, y - t, t > 18 ? 2 : 1, t > 18 ? 2 : 1, t > 20 ? P.smoke2 : P.smoke); c.restore();
  }
}

export function clouds(c, tick) {
  for (let i = 0; i < 4; i++) {
    const x = ((tick * 0.6 + i * 130) % 600) - 80;
    const y = 62 + i * 12;
    px(c, x, y, 46, 8, P.cloud); px(c, x + 8, y - 4, 26, 4, P.cloud); px(c, x + 4, y + 8, 38, 2, P.cloudD);
  }
}

export function bike(c, t) {
  if (t === null || t === undefined) return;
  const x = 500 - t * 600;
  px(c, x, 190, 26, 2, P.bikeMetal); px(c, x + 2, 178, 4, 12, P.bikeMetal); px(c, x + 20, 178, 4, 12, P.bikeMetal);
  const spin = Math.floor(t * 40) % 2;
  px(c, x - 2, 188, 8, 8, '#2a2f33'); px(c, x + 20, 188, 8, 8, '#2a2f33'); px(c, x + spin, 191, 3, 2, '#5b6469'); px(c, x + 22 + spin, 191, 3, 2, '#5b6469');
  px(c, x + 8, 166, 8, 6, P.hair); px(c, x + 9, 171, 6, 4, P.skin); px(c, x + 6, 175, 12, 10, '#5a7a8a'); px(c, x + 10, 184, 4, 6, P.fanPants);
  if (t > 0.55) px(c, 372, 194, 3, 6, P.bottle);
}

// 远处早餐摊的老板搬桌子：桌腿卡门槛，抬两次没抬过去。
export function stallFar(c, tick, active) {
  px(c, 446, 156, 34, 14, '#4c5a60'); px(c, 444, 150, 36, 6, P.stallRoof);
  px(c, 448, 170, 3, 8, P.stallWood); px(c, 475, 170, 3, 8, P.stallWood);
  px(c, 458, 148, 18, 6, '#d24b3c'); px(c, 460, 149, 14, 4, '#f6e7c8');
  if (!active) return;
  const heave = Math.floor(tick / 18) % 4 === 1 ? -2 : 0;
  px(c, 454, 162 + heave, 20, 3, '#8e6b4f'); px(c, 455, 165 + heave, 2, 8, '#8e6b4f'); px(c, 471, 165 + heave, 2, 8, '#8e6b4f');
  px(c, 462, 152 + heave, 6, 6, P.hair); px(c, 463, 157 + heave, 4, 3, P.skin); px(c, 460, 160 + heave, 10, 10, '#8a5f6b');
}

// 收款提示音：早餐摊上方一个闪的小音符方块。
export function ding(c, tick) {
  if (Math.floor(tick / 10) % 2) { px(c, 466, 140, 4, 4, '#ffe28a'); px(c, 470, 136, 2, 6, '#ffe28a'); }
}

// 纸箱涂鸦：方框、两个小人、屋顶、外扩，按 step 一步步出现。
export function cardboardDrawing(c, x, y, step, progress) {
  px(c, x, y, 44, 34, P.box); px(c, x, y, 44, 2, P.boxD); px(c, x + 2, y + 2, 40, 1, P.boxL);
  const ink = P.marker;
  const w = Math.round(30 * Math.min(1, progress * 2));
  if (step >= 1) { px(c, x + 7, y + 7, w, 1, ink); if (progress > 0.5) { px(c, x + 7, y + 7, 1, 20, ink); px(c, x + 36, y + 7, 1, 20, ink); px(c, x + 7, y + 27, 30, 1, ink); } }
  if (step >= 2) { px(c, x + 14, y + 14, 4, 9, ink); px(c, x + 15, y + 11, 2, 2, ink); px(c, x + 13, y + 12, 6, 1, ink); px(c, x + 24, y + 14, 4, 9, ink); px(c, x + 25, y + 11, 2, 2, ink); px(c, x + 28, y + 15, 3, 2, ink); }
  if (step >= 3) { for (let i = 0; i < 8; i++) { px(c, x + 13 + i, y + 6 - i, 1, 1, ink); px(c, x + 30 - i, y + 6 - i, 1, 1, ink); } px(c, x + 9, y + 6, 26, 1, ink); }
  if (step >= 4) { px(c, x + 3, y + 3, 38, 1, ink); px(c, x + 3, y + 3, 1, 28, ink); px(c, x + 40, y + 3, 1, 28, ink); px(c, x + 3, y + 30, 38, 1, ink); }
}

export function lighterFx(c, x, y, dt) {
  const flick = (dt > 300 && dt < 420) || (dt > 900 && dt < 1000) || (dt > 1500 && dt < 1600);
  if (flick) { px(c, x, y, 2, 2, P.spark); px(c, x + 2, y - 2, 1, 1, P.spark); }
  if (dt > 2100) { px(c, x, y - 2, 2, 4, P.flame); px(c, x, y - 3, 2, 1, P.spark); glow(c, x + 1, y, 14, 'rgba(255,179,71,1)', 0.35); }
}

export function phoneGlow(c, x, y) { glow(c, x, y, 16, 'rgba(159,214,255,1)', 0.3); }

export { P as PALETTE, glow, dither };
