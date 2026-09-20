import { px, person, personAnchors, smokeCurl, tossCig } from './intro-art.js';

// 相遇过场（480×270）：第 1 天傍晚，回营路上的桥下街口。地面线 y=186 是人物左上角，脚底约 232。
// 整幅只用整数矩形与半透明矩形，测试里的假画布只记录 fillRect。
const M = {
  sky: '#30454b', sky2: '#3a4b4f', dusk: '#4c5252', dusk2: '#635b54', horizon: '#7c6a5c',
  far: '#243339', far2: '#2c3d43', win: '#e6c27c', winDim: '#8c7a55',
  deck: '#46575b', deckL: '#556669', deckD: '#3a4a4e', deckTop: '#8d9895', parapet: '#5b6a6b', under: '#2c393e', joint: '#1f2b30',
  pier: '#647477', pierL: '#7d8f92', pierD: '#4a5b60', stain: '#55666a', pipe: '#38474c',
  wall: '#55656a', coping: '#6c7d80', wallD: '#43535a', mortar: '#4a5a5f', ghost: '#5d6d72', moss: '#3d4c4a',
  walk: '#4c5a60', walkL: '#586870', seam: '#3d4b51', curb: '#55646a', road: '#2b353b', roadNear: '#232c31', lane: '#8c9598',
  post: '#283b40', postL: '#3a4d52', head: '#596d6c', headL: '#6c7f7e', lit: '#e3bb72', litHot: '#f0d28f',
  paper: '#d8d3c2', paperD: '#b7b0a0', ink: '#2b2b30', red: '#8f4a3f', photo: '#7a8a8f',
  tarp: '#718077', tarp2: '#7a8a80', tarpL: '#8d9c8e', pole: '#544b3d', box: '#c9b389', boxD: '#a8926c',
  bottle: '#a8c7bd', bottle2: '#8fb3a6', glint: '#dfe6e3', plastic: '#c9d3d3', plasticD: '#a9b6b6', can: '#9aa3a1',
  bin: '#4d5a5e', binFront: '#5c6a6e', binRib: '#455257', binRim: '#6d7b7e', binSkirt: '#3f4b4f', lid: '#8a9693', lidL: '#a3ada9', lidD: '#70807e', mouth: '#2b3537',
  bag: '#1d2528', bagL: '#3a4750', wheel: '#1d2528', hub: '#4a5560', grime: '#5a5148', label: '#8fa39e',
};

// 棋盘抖动做带间接缝与污渍，避免大面平涂在 3.5 倍放大下发虚。
function dither(c, x, y, w, h, color, step = 2, phase = 0) {
  c.fillStyle = color;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) % step; xx < w; xx += step) c.fillRect(x + xx, y + yy, 1, 1);
}

function skyline(c, tick) {
  const bands = [[52, 22, M.sky], [74, 18, M.sky2], [92, 16, M.dusk], [108, 14, M.dusk2], [122, 14, M.horizon]];
  for (const [y, h, color] of bands) px(c, 0, y, 480, h, color);
  for (let i = 1; i < bands.length; i++) dither(c, 0, bands[i][0] - 1, 480, 2, bands[i][2], 2, i);
  const blocks = [[0, 104, 34], [30, 92, 44], [70, 112, 26], [92, 86, 40], [128, 100, 30], [154, 78, 48], [198, 96, 36], [230, 108, 26], [252, 84, 44], [292, 100, 32], [320, 90, 48], [364, 106, 30], [390, 80, 42], [428, 98, 34], [458, 88, 30]];
  for (const [i, [x, top, w]] of blocks.entries()) {
    px(c, x, top, w, 136 - top, i % 2 ? M.far2 : M.far);
    for (let wy = top + 5; wy < 132; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) {
      const k = (wx * 7 + wy * 13) % 11;
      if (k > 4) continue;
      // 少数窗子按 tick 慢慢明灭，远处有人在活动
      const blink = (wx + wy + Math.floor(tick / 45)) % 17 === 0;
      px(c, wx, wy, 2, 3, blink || k > 1 ? M.winDim : M.win);
    }
  }
  px(c, 170, 70, 1, 8, M.far); px(c, 166, 68, 9, 2, M.far); px(c, 336, 84, 8, 6, M.far2); px(c, 339, 80, 2, 4, M.far2);
}

function deck(c) {
  px(c, 0, 0, 480, 48, M.deck);
  px(c, 0, 0, 480, 3, M.deckTop); px(c, 0, 3, 480, 7, M.parapet); px(c, 0, 10, 480, 2, M.deckL);
  for (let x = 8; x < 480; x += 40) { px(c, x, 3, 2, 7, M.deck); px(c, x + 20, 12, 2, 24, M.deckD); }
  for (const x of [60, 176, 302, 412]) dither(c, x, 24, 10, 12, M.deckD, 2, x % 2);
  px(c, 0, 34, 480, 4, M.deckD); px(c, 0, 38, 480, 10, M.under); dither(c, 0, 48, 480, 5, M.under, 2, 1);
  px(c, 238, 0, 4, 48, M.joint); px(c, 236, 30, 8, 2, M.deckD);
}

function poster(c, x, y) {
  px(c, x, y, 44, 40, M.paper); px(c, x, y, 44, 7, M.red);
  px(c, x + 4, y + 11, 30, 3, M.ink); px(c, x + 4, y + 17, 34, 3, M.ink); px(c, x + 4, y + 23, 22, 3, M.ink); px(c, x + 4, y + 29, 20, 8, M.photo);
  // 右半按阶梯撕掉，露出胶印；撕口留一片卷边和挂着的纸屑
  for (const [tx, ty, th] of [[24, 0, 9], [28, 9, 8], [22, 17, 8], [26, 25, 8], [20, 33, 7]]) px(c, x + tx, y + ty, 44 - tx, th, M.ghost);
  px(c, x + 22, y + 33, 5, 4, M.paperD); px(c, x + 31, y + 12, 3, 2, M.paper); px(c, x + 27, y + 26, 2, 3, M.paperD);
}

function wall(c) {
  px(c, 0, 136, 480, 64, M.wall); px(c, 0, 136, 480, 4, M.coping); px(c, 0, 194, 480, 6, M.wallD);
  for (let row = 0; row < 4; row++) {
    const y = 152 + row * 12;
    px(c, 0, y, 480, 1, M.mortar);
    for (let x = row % 2 * 12; x < 480; x += 24) px(c, x, y - 11, 1, 11, M.mortar);
  }
  dither(c, 0, 186, 480, 8, M.moss, 3, 0);
  for (let i = 0; i < 6; i++) px(c, 210 + i * 2, 142 + i * 4, 1, 5, M.seam);
  poster(c, 100, 146);
}

function pavement(c) {
  px(c, 0, 200, 480, 40, M.walk); px(c, 0, 200, 480, 2, M.walkL);
  for (let x = 6; x < 480; x += 24) px(c, x, 202, 1, 38, M.seam);
  px(c, 0, 221, 480, 1, M.seam);
  for (let x = 0; x < 480; x += 53) px(c, x + 9, 212 + x % 7, 6, 1, M.walkL);
  px(c, 150, 233, 16, 5, M.joint); for (let i = 0; i < 4; i++) px(c, 152 + i * 4, 234, 1, 3, M.seam);
  px(c, 0, 240, 480, 6, M.curb); px(c, 0, 240, 480, 2, M.pierL);
  px(c, 0, 246, 480, 12, M.road); px(c, 0, 258, 480, 12, M.roadNear); px(c, 0, 246, 480, 1, M.joint);
  for (let x = 10; x < 480; x += 46) px(c, x, 255, 22, 2, M.lane);
  px(c, 400, 260, 16, 4, M.pipe); px(c, 402, 259, 12, 1, M.pierD); px(c, 404, 261, 8, 1, M.road);
  px(c, 60, 247, 40, 4, '#40525c'); px(c, 66, 248, 10, 1, '#5a7078');
}

function pier(c, x, shade) {
  px(c, x, 46, 46, 156, M.pier); px(c, x + 5, 46, 7, 156, M.pierL); px(c, x + 38, 46, 8, 156, M.pierD);
  for (let y = 70; y < 196; y += 24) px(c, x + 2, y, 42, 2, M.stain);
  dither(c, x + 3, 150, 40, 50, M.stain, 3, shade);
  px(c, x - 4, 196, 54, 10, M.pierD); px(c, x - 4, 196, 54, 2, M.pierL);
}

function tarp(c, tick) {
  const sway = Math.floor(tick / 9) % 2;
  px(c, 444, 149, 14, 1, M.pole);
  for (let i = 0; i < 7; i++) { const sx = 456 + i * 3 + sway; px(c, sx, 150 + i * 4, 480 - sx, 4, i % 2 ? M.tarp : M.tarp2); }
  px(c, 456 + sway, 150, 24 - sway, 1, M.tarpL);
  px(c, 470, 148, 4, 54, M.pole);
  px(c, 452, 182, 24, 18, M.box); px(c, 452, 182, 24, 3, M.boxD); px(c, 463, 182, 2, 18, M.boxD);
}

function lamp(c, x) {
  px(c, x, 100, 6, 100, M.post); px(c, x + 1, 100, 1, 100, M.postL);
  px(c, x - 4, 194, 14, 8, M.post); px(c, x - 2, 192, 10, 2, M.postL);
  px(c, x - 8, 94, 22, 9, M.head); px(c, x - 8, 94, 22, 2, M.headL);
  px(c, x - 5, 103, 16, 7, M.lit);
}

// 灯光单独压在最后：站进光柱里的人和桶都会被暖光染到一点。
function lampGlow(c, x, tick) {
  const flicker = tick % 89 < 3;
  if (!flicker) px(c, x - 3, 103, 12, 1, M.litHot);
  const bands = [[110, 14, 20], [124, 22, 34], [146, 26, 50], [172, 32, 70], [204, 38, 96]];
  bands.forEach(([y, h, w], i) => px(c, x + 3 - w / 2, y, w, h, `rgba(227,187,114,${(flicker ? 0.07 : 0.12) - i * 0.015})`));
}

function litter(c, tick) {
  px(c, 300, 229, 9, 3, M.bottle); px(c, 309, 230, 2, 2, M.bottle2); px(c, 301, 229, 5, 1, M.glint);
  px(c, 378, 223, 3, 9, M.bottle2); px(c, 378, 221, 3, 2, M.glint); px(c, 378, 226, 3, 2, M.bottle);
  px(c, 236, 236, 7, 3, M.can); px(c, 74, 226, 4, 1, M.paper); px(c, 412, 218, 3, 2, M.paper);
  px(c, 384, 227, 12, 5, M.plastic); px(c, 386, 225, 5, 3, M.glint); px(c, 388, 230, 6, 1, M.plasticD);
  // 一只塑料袋沿排水沟被风推着翻滚
  const bx = ((tick * 0.6) % 520) - 20, tumble = Math.floor(tick / 5) % 2;
  px(c, bx, 247 + tumble, 10 - tumble * 2, 5 - tumble, M.plastic); px(c, bx + 2, 245 + tumble * 2, 4, 3, M.glint); px(c, bx + 3, 250, 5, 1, M.plasticD);
}

function backdrop(c, tick) {
  px(c, 0, 0, 480, 270, M.sky);
  skyline(c, tick);
  deck(c);
  wall(c);
  pavement(c);
  pier(c, 12, 0); pier(c, 398, 1);
  px(c, 402, 46, 3, 154, M.pipe); px(c, 401, 60, 5, 2, M.pierD); px(c, 401, 150, 5, 2, M.pierD); dither(c, 399, 176, 9, 20, M.moss, 2, 0);
  px(c, 20, 118, 26, 12, M.paper); px(c, 22, 120, 22, 8, M.red); px(c, 25, 122, 3, 4, M.ink); px(c, 31, 122, 3, 4, M.ink); px(c, 37, 122, 4, 2, M.ink);
  tarp(c, tick);
  lamp(c, 292);
  litter(c, tick);
}

function bin(c, open) {
  px(c, 328, 230, 48, 3, 'rgba(0,0,0,.28)');
  px(c, 330, 182, 42, 47, M.bin); px(c, 333, 185, 36, 41, M.binFront);
  for (let x = 336; x < 368; x += 6) px(c, x, 188, 1, 34, M.binRib);
  px(c, 330, 182, 42, 2, M.binRim); px(c, 330, 222, 42, 7, M.binSkirt);
  px(c, 352, 200, 12, 9, M.binSkirt); px(c, 352, 200, 12, 1, M.binRim); px(c, 363, 200, 1, 9, M.binRim);
  px(c, 338, 194, 9, 6, M.label); px(c, 340, 196, 5, 2, '#2c383e');
  px(c, 333, 217, 8, 5, M.grime); px(c, 344, 219, 5, 3, M.grime);
  px(c, 372, 186, 3, 10, M.binRim);
  px(c, 334, 228, 8, 5, M.wheel); px(c, 360, 228, 8, 5, M.wheel); px(c, 337, 230, 2, 2, M.hub); px(c, 363, 230, 2, 2, M.hub);
  if (open) {
    px(c, 333, 176, 36, 7, M.mouth);
    px(c, 335, 172, 16, 6, M.bag); px(c, 337, 173, 6, 1, M.bagL); px(c, 354, 174, 4, 4, M.paper); px(c, 360, 175, 6, 3, M.bottle);
    // 盖子绕后沿铰链竖起
    px(c, 362, 152, 12, 28, M.lid); px(c, 372, 152, 2, 28, M.lidL); px(c, 364, 154, 3, 24, M.lidD); px(c, 360, 150, 12, 4, M.lid);
  } else {
    px(c, 328, 176, 46, 6, M.lid); px(c, 328, 176, 46, 1, M.lidL); px(c, 344, 173, 14, 3, M.lid); px(c, 328, 181, 46, 1, M.lidD);
    px(c, 330, 181, 8, 4, M.bag);
  }
  // 桶脚下那只垃圾袋：马哥翻的是它
  px(c, 316, 214, 30, 18, M.bag); px(c, 318, 212, 22, 4, M.bag); px(c, 320, 216, 10, 2, M.bagL); px(c, 322, 210, 6, 3, M.bagL);
}

function luggage(c, x, y, tipped = false, held = false) {
  if (tipped) {
    px(c, x - 2, y + 30, 34, 2, 'rgba(0,0,0,.25)');
    px(c, x, y + 20, 30, 9, '#4a4a52'); px(c, x + 2, y + 22, 26, 5, '#5f5f69'); px(c, x + 2, y + 22, 26, 1, '#6f6f7a');
    px(c, x + 9, y + 22, 1, 5, '#252c31'); px(c, x + 19, y + 22, 1, 5, '#252c31');
    px(c, x + 30, y + 22, 8, 2, '#8e9898'); px(c, x + 30, y + 26, 8, 2, '#8e9898'); px(c, x + 37, y + 21, 2, 8, '#a0a7a4');
    px(c, x + 4, y + 29, 6, 3, '#15191e'); px(c, x + 20, y + 29, 6, 3, '#15191e');
    return;
  }
  px(c, x - 1, y + 32, 25, 2, 'rgba(0,0,0,.25)');
  px(c, x, y, 22, 29, '#4a4a52'); px(c, x + 2, y + 2, 18, 25, '#5f5f69'); px(c, x + 2, y + 2, 1, 25, '#6f6f7a');
  px(c, x + 3, y + 8, 16, 2, '#252c31'); px(c, x + 3, y + 16, 16, 1, '#3f3f47'); px(c, x + 3, y + 24, 16, 1, '#3f3f47');
  for (const [cx, cy] of [[0, 0], [19, 0], [0, 26], [19, 26]]) px(c, x + cx, y + cy, 3, 3, '#6a6a74');
  px(c, x + 12, y + 18, 5, 3, M.paper); px(c, x + 5, y + 19, 4, 3, M.red);
  px(c, x + 10, y - 8, 3, 8, '#4a4a52'); if (held) px(c, x - 7, y + 4, 9, 2, '#8e9898');
  px(c, x + 2, y + 29, 6, 4, '#15191e'); px(c, x + 14, y + 29, 6, 4, '#15191e'); px(c, x + 4, y + 30, 2, 2, '#a0a7a4'); px(c, x + 16, y + 30, 2, 2, '#a0a7a4');
}

function sack(c, x, y, slipped) {
  const dy = slipped ? 28 : 0;
  if (slipped) px(c, x - 1, y + dy + 17, 25, 2, 'rgba(0,0,0,.25)');
  px(c, x, y + dy, 22, 18, '#d7cfaa'); px(c, x + 2, y - 3 + dy, 18, 4, '#ece5c4'); px(c, x + 8, y - 6 + dy, 6, 3, '#c9c19c'); px(c, x + 7, y - 4 + dy, 8, 1, M.red);
  dither(c, x + 1, y + 1 + dy, 20, 16, '#c9c19c', 3, 1);
  px(c, x + 2, y + 3 + dy, 18, 1, '#a99c78'); px(c, x + 2, y + 16 + dy, 18, 1, '#b3aa88');
  px(c, x + 7, y + 7 + dy, 8, 2, '#73725e'); px(c, x + 9, y + 10 + dy, 1, 5, '#73725e'); px(c, x + 12, y + 10 + dy, 1, 5, '#73725e'); px(c, x + 15, y + 12 + dy, 2, 3, '#73725e');
}

function tears(c, x, y, tick) {
  const drop = tick % 2;
  px(c, x, y, 1, 3 + drop, '#8fc3e6'); px(c, x + 7, y + 1, 1, 2 + drop, '#8fc3e6');
}

// 脚下的软阴影；坐姿腿伸出去，阴影跟着拉宽。
function shadow(c, x, pose) {
  const sit = pose === 'sit';
  px(c, x - 1, 231, sit ? 36 : 26, 3, 'rgba(0,0,0,.28)'); px(c, x + 3, 234, sit ? 28 : 18, 1, 'rgba(0,0,0,.18)');
}

export function drawMeetingScene(c, view) {
  const { beat, tick, choreo } = view;
  backdrop(c, tick);
  bin(c, beat === 'bin' || beat === 'rush');
  const { xuanX, fanX, maX } = choreo;
  const actor = (x, who, pose, frame, opts) => { shadow(c, x, pose); person(c, x, 186, who, pose, frame, opts); };
  const stride = Math.floor(tick / 2) % 4;
  // 行李和袋子都画在人后面：编排里人和箱子会交错，被身体挡住比压在脸上好看得多。
  if (beat === 'walk' || beat === 'bin') {
    luggage(c, xuanX + 33, 202, false, true); luggage(c, fanX + 33, 202, false, true); sack(c, fanX - 8, 181, false);
    const walk = beat === 'walk';
    actor(xuanX, 'xuan', walk ? 'walk' + stride : 'stand', stride, { arm: 'reach' });
    actor(fanX, 'fan', walk ? 'walk' + ((stride + 2) % 4) : 'stand', stride, { arm: 'reach' });
    actor(maX, 'ma', walk ? 'stand' : 'bend', 0, { flip: true });
  } else if (beat === 'rush' || beat === 'recognize') {
    // 箱子丢在桶边那拍站的地方，两个人空着手冲过去
    luggage(c, 157, 202); luggage(c, 227, 202); sack(c, fanX - 8, 181, false);
    const rush = beat === 'rush';
    actor(xuanX, 'xuan', rush ? 'walk' + stride : 'stand', stride, { arm: rush ? 'reach' : 'none' });
    actor(fanX, 'fan', rush ? 'walk' + ((stride + 2) % 4) : 'stand', stride, { arm: rush ? 'reach' : 'none' });
    actor(maX, 'ma', rush ? 'bend' : 'stand', 0, { flip: true });
  } else if (beat === 'hug' || beat === 'wipe') {
    luggage(c, 151, 200, true); luggage(c, 268, 200, true); sack(c, 274, 185, true);
    actor(xuanX, 'xuan', 'stand', 0, { arm: beat });
    actor(maX, 'ma', 'stand', 0, { flip: true, arm: beat });
    actor(fanX, 'fan', 'stand', 0, { flip: true, arm: beat });
    if (beat === 'hug') px(c, xuanX + 15, 204, fanX - xuanX + 6, 3, '#d9a577');
    tears(c, xuanX + 15, 199, tick); tears(c, maX + 8, 199, tick + 1); tears(c, fanX + 7, 199, tick);
  } else if (beat === 'smoke') {
    const holder = choreo.cigaretteCarrier;
    const transfer = choreo.cigaretteTransfer;
    // 坐成一排后行李收到两头，袋子靠在轩哥的箱子边
    luggage(c, xuanX - 30, 202); luggage(c, fanX + 33, 202); sack(c, xuanX - 50, 185, true);
    actor(xuanX, 'xuan', 'sit', 0, { arm: transfer?.includes('xuan') ? 'reach' : 'none', cig: holder === 'xuan', ember: 1 });
    actor(maX, 'ma', 'sit', 0, { flip: true, arm: transfer?.includes('ma') ? 'reach' : 'none', cig: holder === 'ma', ember: 1 });
    actor(fanX, 'fan', 'sit', 0, { flip: true, arm: transfer?.includes('fan') ? 'reach' : 'none', cig: holder === 'fan', ember: 1 });
    const anchors = {
      xuan: personAnchors(xuanX, 186, 'sit', 0, {}).cigarette,
      ma: personAnchors(maX, 186, 'sit', 0, { flip: true }).cigarette,
      fan: personAnchors(fanX, 186, 'sit', 0, { flip: true }).cigarette,
    };
    if (transfer) {
      const [from, to] = transfer;
      tossCig(c, anchors[from][0], anchors[from][1], anchors[to][0], anchors[to][1], choreo.transferProgress, '#e9e2d2', 5, 1);
    } else if (holder) {
      smokeCurl(c, anchors[holder][0], anchors[holder][1] - 1, tick, holder.length, 0.6);
    }
  } else {
    // 回营：尿素袋隔一阵换一次肩
    const shoulder = Math.floor(tick / 40) % 2 ? maX + 10 : maX - 8;
    luggage(c, xuanX + 33, 202, false, true); luggage(c, fanX + 33, 202, false, true); sack(c, shoulder, 181, false);
    actor(xuanX, 'xuan', 'walk' + stride, stride, { arm: 'reach' });
    actor(maX, 'ma', 'walk' + ((stride + 1) % 4), stride, {});
    actor(fanX, 'fan', 'walk' + ((stride + 2) % 4), stride, { arm: 'reach' });
  }
  lampGlow(c, 292, tick);
}
