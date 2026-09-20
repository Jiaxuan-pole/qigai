// 营地里的家什：床、地铺、物资箱、包裹、油桶与火、修理桌、展架、晾晒架、猫。
// 每件都是手摆的贝塞尔与渐变，没有任何可复用的“瓦片”，这正是原生 1080 手绘路线的成本所在。
import { hash, lin, rad, rgba, rect, rr, ell, poly, blob, line, curve, limb, soft, stipple, drips } from './camp-target-1080-paint.js';

const WOOD = ['#7a6248', '#5a4633', '#3d2f24'], METAL = ['#5a6268', '#3a4146', '#262b2f'];

function shadow(c, x, y, rx, ry, a = 0.5) { soft(c, x, y, rx, ry, [6, 9, 13], a); }

// 床：铁架 + 脏床垫 + 枕头 + 被子。sleeper 为 true 时被子里有人（凡哥），只画出他背对镜头的黄发、黄外套肩线和露出的靴子
export function bed(c, x, base, blanket, sleeper) {
  const L = 224, mat = base - 46;
  shadow(c, x + L / 2, base + 2, L / 2 + 10, 12, 0.55);
  // 铁床架：床头床尾各一根竖杆，中间横杆，腿细
  line(c, [[x + 6, base], [x + 6, mat - 44]], METAL[0], 7); line(c, [[x + L - 6, base], [x + L - 6, mat - 16]], METAL[0], 7);
  line(c, [[x + 30, base], [x + 30, mat + 18]], METAL[1], 5); line(c, [[x + L - 30, base], [x + L - 30, mat + 18]], METAL[1], 5);
  rr(c, x + 2, mat - 48, 9, 9, 4, METAL[0]); rr(c, x + L - 10, mat - 20, 9, 9, 4, METAL[0]);
  line(c, [[x + 4, mat + 20], [x + L - 4, mat + 20]], METAL[0], 5); line(c, [[x + 6, base - 12], [x + L - 6, base - 12]], METAL[1], 3, 0.8);
  line(c, [[x + 6, mat - 22], [x + L - 6, mat - 22]], METAL[0], 2, 0.5);
  // 床垫：脏米色，边角塌陷，用渐变压出厚度
  rr(c, x + 8, mat - 6, L - 16, 28, 8, lin(c, 0, mat - 6, 0, mat + 22, [[0, '#8f8877'], [0.5, '#7c7566'], [1, '#5c574c']]));
  line(c, [[x + 12, mat + 8], [x + L - 12, mat + 8]], '#4f4a42', 1.5, 0.5);
  stipple(c, x + 10, mat - 4, L - 20, 18, '#4a463d', 0.25, 90, x);
  // 枕头
  blob(c, [[x + 14, mat - 4], [x + 30, mat - 18], [x + 62, mat - 16], [x + 74, mat - 4], [x + 60, mat + 2], [x + 26, mat + 2]], lin(c, 0, mat - 18, 0, mat + 2, [[0, '#b3ada0'], [1, '#807b70']]));
  if (sleeper) {
    // 凡哥侧躺面朝墙：黄发在枕头上，脖颈一线小麦色，外套肩线盖在被子外
    line(c, [[x + 70, mat - 10], [x + 88, mat - 12]], '#b98358', 9);
    ell(c, x + 58, mat - 12, 17, 15, lin(c, x + 41, 0, x + 75, 0, [[0, '#a4822c'], [0.5, '#d8b24a'], [1, '#b8922f']]));
    blob(c, [[x + 64, mat - 4], [x + 74, mat - 12], [x + 76, mat - 2], [x + 70, mat + 2]], '#c8905f');
    curve(c, [[x + 46, mat - 22], [x + 56, mat - 27], [x + 70, mat - 22]], '#ecd27a', 2, 0.55);
    blob(c, [[x + 80, mat], [x + 86, mat - 18], [x + 100, mat - 27], [x + 124, mat - 29], [x + 142, mat - 24], [x + 140, mat - 4]], lin(c, 0, mat - 30, 0, mat - 2, [[0, '#e1b94e'], [0.6, '#c69a32'], [1, '#8c6a20']]), 'rgba(8,10,14,0.45)');
    blob(c, [[x + 82, mat - 12], [x + 88, mat - 24], [x + 100, mat - 26], [x + 98, mat - 16], [x + 90, mat - 10]], '#a4822c');
    curve(c, [[x + 100, mat - 26], [x + 122, mat - 30], [x + 140, mat - 24]], '#f0cf6a', 2, 0.5);
  }
  // 被子：几段鼓起的波浪，褶皱用低透明度暗线，边缘一道更暗的翻边
  const top = sleeper ? mat - 24 : mat - 12, bx = x + (sleeper ? 118 : 70);
  blob(c, [[bx, mat - 4], [bx + 16, top], [bx + 60, top - 6], [bx + 100, top + 2], [x + L - 12, top + 8], [x + L - 6, mat + 14], [bx - 6, mat + 16]],
    lin(c, 0, top - 6, 0, mat + 16, [[0, blanket[1]], [0.45, blanket[0]], [1, blanket[2]]]));
  curve(c, [[bx + 30, top + 4], [bx + 52, mat - 2], [bx + 66, mat + 12]], blanket[2], 2, 0.55);
  curve(c, [[bx + 80, top + 6], [bx + 96, mat], [bx + 90, mat + 14]], blanket[2], 2, 0.4);
  curve(c, [[bx + 2, mat - 2], [bx + 40, top - 2], [bx + 96, top + 4], [x + L - 14, top + 10]], blanket[1], 2.5, 0.35);
  rr(c, bx - 4, mat + 10, x + L - 4 - bx, 8, 3, blanket[2]);
  if (sleeper) {
    // 靴子没脱就躺下了：黄靴从被角伸出来，中间一截蓝牛仔裤
    rect(c, x + L - 18, mat - 6, 16, 14, '#3f5d7a');
    for (const by of [mat - 8, mat + 4]) {
      blob(c, [[x + L - 10, by - 6], [x + L + 6, by - 8], [x + L + 12, by], [x + L + 30, by + 2], [x + L + 36, by + 8], [x + L + 32, by + 13], [x + L - 8, by + 13]], lin(c, 0, by - 8, 0, by + 13, [[0, '#c9933a'], [1, '#8f6320']]), 'rgba(8,10,14,0.45)');
      rect(c, x + L - 9, by + 10, 44, 3, '#3a2c18'); line(c, [[x + L - 2, by - 3], [x + L + 8, by + 4]], '#5a3e14', 1.5, 0.6);
    }
  }
}

// 地铺：纸板 + 叠好的橄榄绿毯 + 卷成枕头的外套
export function floorSheet(c, x, base) {
  shadow(c, x + 80, base + 2, 88, 10, 0.5);
  poly(c, [[x, base], [x + 6, base - 12], [x + 158, base - 14], [x + 166, base]], lin(c, 0, base - 14, 0, base, [[0, '#9a8a68'], [1, '#6f6249']]));
  line(c, [[x + 40, base - 12], [x + 44, base - 1]], '#5a4e3a', 1.5, 0.7); line(c, [[x + 110, base - 13], [x + 114, base - 1]], '#5a4e3a', 1.5, 0.7);
  blob(c, [[x + 30, base - 12], [x + 44, base - 36], [x + 96, base - 40], [x + 140, base - 30], [x + 150, base - 12], [x + 90, base - 8]], lin(c, 0, base - 40, 0, base - 8, [[0, '#7d8664'], [0.5, '#5f6a52'], [1, '#3f4838']]));
  curve(c, [[x + 46, base - 24], [x + 90, base - 30], [x + 138, base - 20]], '#3f4838', 2, 0.5);
  blob(c, [[x + 10, base - 12], [x + 18, base - 32], [x + 44, base - 34], [x + 52, base - 16], [x + 36, base - 10]], lin(c, 0, base - 34, 0, base - 10, [[0, '#5a6066'], [1, '#353a40']]));
}

// 物资箱：两只木箱错位叠放，上箱贴了张记饭数的纸条
export function crates(c, x, base) {
  shadow(c, x + 60, base + 2, 70, 10, 0.55);
  const crate = (cx, cy, w, h, seed) => {
    rr(c, cx, cy, w, h, 3, lin(c, cx, 0, cx + w, 0, [[0, WOOD[1]], [0.3, WOOD[0]], [1, WOOD[1]]]));
    for (let i = 1; i < 3; i++) line(c, [[cx + 4, cy + (h / 3) * i], [cx + w - 4, cy + (h / 3) * i]], WOOD[2], 2, 0.6);
    line(c, [[cx + 6, cy + 4], [cx + 6, cy + h - 4]], WOOD[2], 3, 0.5); line(c, [[cx + w - 6, cy + 4], [cx + w - 6, cy + h - 4]], WOOD[2], 3, 0.5);
    stipple(c, cx + 2, cy + 2, w - 4, h - 4, '#2a1f16', 0.28, 70, seed, 2);
    rect(c, cx, cy, w, 3, 'rgba(255,240,210,0.16)');
  };
  crate(x, base - 62, 118, 62, 11); crate(x + 12, base - 118, 96, 58, 23);
  poly(c, [[x + 30, base - 104], [x + 74, base - 106], [x + 72, base - 74], [x + 28, base - 72]], '#cfc4a6');
  for (let i = 0; i < 3; i++) line(c, [[x + 40 + i * 9, base - 98], [x + 42 + i * 9, base - 80]], '#3a3430', 2.5, 0.8);
  rr(c, x + 76, base - 136, 22, 20, 3, lin(c, x + 76, 0, x + 98, 0, [[0, '#6d7679'], [0.4, '#9aa3a5'], [1, '#5c6467']]));
  rect(c, x + 76, base - 130, 22, 6, '#b6493f');
}

// 家具包裹：蓝灰防水布裹着一堆家什，绳子十字捆着，露出一条椅子腿
export function parcel(c, x, base) {
  shadow(c, x + 44, base + 2, 54, 10, 0.5);
  line(c, [[x + 66, base - 90], [x + 82, base - 130]], WOOD[0], 6); line(c, [[x + 78, base - 118], [x + 90, base - 116]], WOOD[1], 4);
  blob(c, [[x, base], [x + 6, base - 40], [x + 22, base - 86], [x + 50, base - 100], [x + 80, base - 82], [x + 92, base - 40], [x + 90, base]],
    lin(c, x, 0, x + 92, 0, [[0, '#3f4c4f'], [0.4, '#5b6a6c'], [1, '#334042']]));
  curve(c, [[x + 8, base - 30], [x + 40, base - 46], [x + 86, base - 32]], '#a88f66', 3, 0.85);
  curve(c, [[x + 40, base - 98], [x + 46, base - 50], [x + 42, base]], '#a88f66', 3, 0.85);
  curve(c, [[x + 14, base - 60], [x + 30, base - 74], [x + 56, base - 92]], 'rgba(200,215,220,0.25)', 6, 1);
  stipple(c, x + 4, base - 90, 84, 88, '#1e2628', 0.3, 60, 37, 2);
}

// 油桶：竖向渐变做圆柱，两道箍，锈斑，下方几只透火的洞
export function drum(c, x, base) {
  shadow(c, x + 46, base + 3, 62, 12, 0.6);
  rr(c, x, base - 138, 92, 138, 5, lin(c, x, 0, x + 92, 0, [[0, '#3a2c25'], [0.28, '#6e4f3f'], [0.5, '#7d5c49'], [0.8, '#4c3a31'], [1, '#2c221d']]));
  for (const ry of [base - 104, base - 50]) { rect(c, x, ry, 92, 8, 'rgba(0,0,0,0.35)'); rect(c, x, ry, 92, 3, 'rgba(255,225,190,0.18)'); }
  rr(c, x - 2, base - 142, 96, 10, 4, lin(c, x, 0, x + 96, 0, [[0, '#4a3a31'], [0.5, '#8a6a55'], [1, '#3a2c25']]));
  stipple(c, x + 4, base - 132, 84, 126, '#9a5d38', 0.35, 90, 51, 3);
  stipple(c, x + 4, base - 132, 84, 126, '#1c1411', 0.35, 60, 52, 3);
  drips(c, x + 6, base - 100, 80, 60, '#2a1c15', 0.35, 7, 53);
  // 透火的洞：洞口本身当发光体，在夜色叠加后还会被 flames() 再补一遍
  for (const [hx, hy, hr] of [[x + 24, base - 34, 6], [x + 46, base - 28, 5], [x + 66, base - 36, 6], [x + 36, base - 72, 4]]) {
    ell(c, hx, hy, hr + 1.5, hr, '#1a120e'); ell(c, hx, hy, hr, hr - 1.5, '#ffb347');
  }
}
// 火：多条火舌的贝塞尔轮廓随 tick 摆动，外圈 lighter 叠加做光晕，中心接近白
export function flames(c, x, top, tick) {
  const cx = x + 46;
  c.save(); c.globalCompositeOperation = 'lighter';
  soft(c, cx, top - 30, 120, 90, [255, 120, 40], 0.35 + Math.sin(tick / 7) * 0.05);
  c.restore();
  const tongues = [[-22, 0.9, 0], [0, 1.25, 1.7], [20, 0.95, 3.1], [-8, 1.1, 4.4], [12, 0.7, 5.9]];
  for (const [dx, sc, ph] of tongues) {
    const sway = Math.sin(tick / 9 + ph) * 8, h = (70 + Math.sin(tick / 6 + ph) * 12) * sc;
    const pts = [[cx + dx - 16 * sc, top], [cx + dx - 14 * sc + sway * 0.4, top - h * 0.45], [cx + dx + sway, top - h], [cx + dx + 14 * sc + sway * 0.6, top - h * 0.5], [cx + dx + 16 * sc, top]];
    c.save(); c.shadowColor = 'rgba(255,140,60,0.9)'; c.shadowBlur = 26;
    blob(c, pts, lin(c, 0, top, 0, top - h, [[0, 'rgba(255,190,90,0.95)'], [0.5, 'rgba(255,130,50,0.9)'], [1, 'rgba(255,90,40,0)']]));
    c.restore();
    blob(c, pts.map(([px, py]) => [cx + dx + (px - cx - dx) * 0.5, top + (py - top) * 0.62]), 'rgba(255,240,200,0.85)');
  }
  for (let i = 0; i < 9; i++) {
    const t = (tick * 1.6 + i * 37) % 110, sx = cx - 20 + hash(i * 3) * 40 + Math.sin((tick + i * 20) / 10) * 8, sy = top - 30 - t * 1.4;
    c.save(); c.globalAlpha = Math.max(0, 1 - t / 110); ell(c, sx, sy, 1.6, 1.6, '#ffd27a'); c.restore();
  }
}
// 烟：一串越升越大越淡的软团，往右上飘向桥外
export function smoke(c, x, y, tick) {
  for (let i = 0; i < 11; i++) {
    const t = ((tick * 0.7 + i * 33) % 360) / 360, r = 18 + t * 70, drift = Math.sin(t * 6 + i) * 20;
    const warm = Math.max(0, 1 - t * 3);
    soft(c, x + t * 200 + drift, y - t * 520, r, r * 0.8, [150 + warm * 90, 150 + warm * 20, 150 - warm * 60], (1 - t) * 0.14);
  }
}

// 修理桌：木桌，桌上开着壳的收音机、螺丝刀、零件，右端一只台灯照着活儿
export function table(c, x, base) {
  const top = base - 84;
  shadow(c, x + 66, base + 2, 80, 10, 0.5);
  for (const lx of [x + 10, x + 122]) line(c, [[lx, base], [lx, top + 8]], WOOD[1], 7);
  line(c, [[x + 14, top + 30], [x + 118, top + 30]], WOOD[2], 3, 0.7);
  rr(c, x - 4, top, 140, 12, 2, lin(c, 0, top, 0, top + 12, [[0, '#8a6f52'], [0.4, '#6d5642'], [1, '#402f22']]));
  stipple(c, x - 2, top + 1, 136, 10, '#2a1f16', 0.3, 40, 61, 2);
  // 收音机：外壳掀开，喇叭网、旋钮、几根彩线
  rr(c, x + 34, top - 40, 60, 40, 4, lin(c, 0, top - 40, 0, top, [[0, '#5d656b'], [1, '#353b40']]));
  rr(c, x + 40, top - 34, 26, 24, 2, '#262b2f'); for (let i = 0; i < 5; i++) line(c, [[x + 42, top - 30 + i * 4.5], [x + 64, top - 30 + i * 4.5]], '#4a5257', 1.2, 0.9);
  ell(c, x + 80, top - 24, 6, 6, '#c9c1ae'); ell(c, x + 80, top - 24, 2, 2, '#333');
  ell(c, x + 80, top - 9, 4, 4, '#a9a294');
  poly(c, [[x + 34, top - 40], [x + 94, top - 40], [x + 100, top - 58], [x + 40, top - 56]], '#4a5257');
  curve(c, [[x + 60, top - 40], [x + 70, top - 50], [x + 84, top - 44]], '#c94a3c', 1.5); curve(c, [[x + 64, top - 40], [x + 78, top - 52], [x + 90, top - 46]], '#e0b14a', 1.5);
  line(c, [[x + 90, top - 58], [x + 104, top - 96]], '#9aa3a5', 2);
  line(c, [[x + 6, top - 4], [x + 28, top - 14]], '#c9c1ae', 3); line(c, [[x + 4, top - 3], [x + 12, top - 7]], '#b6493f', 6);
  for (let i = 0; i < 5; i++) ell(c, x + 104 + hash(i) * 14, top - 3 - hash(i + 9) * 3, 2, 1.5, '#aeb4b5');
  // 台灯：圆底座、两段弯臂、灯罩朝左下压着收音机
  ell(c, x + 128, top - 2, 12, 4, '#3a3f43');
  limb(c, x + 128, top - 3, x + 138, top - 60, 4, '#5a6268', '#8a9296'); limb(c, x + 138, top - 60, x + 104, top - 88, 4, '#5a6268', '#8a9296');
  poly(c, [[x + 86, top - 96], [x + 118, top - 104], [x + 128, top - 76], [x + 92, top - 66]], lin(c, x + 86, 0, x + 128, 0, [[0, '#9a9c94'], [1, '#5b5e5a']]));
  ell(c, x + 108, top - 72, 14, 5, '#ffe7b0');
}
export function lampBulb(c, x, base) { const top = base - 84; c.save(); c.globalCompositeOperation = 'lighter'; soft(c, x + 106, top - 70, 26, 14, [255, 230, 170], 0.9); c.restore(); }
export function stool(c, x, base) {
  shadow(c, x + 18, base + 2, 26, 7, 0.4);
  line(c, [[x + 4, base], [x + 10, base - 44]], WOOD[1], 5); line(c, [[x + 32, base], [x + 26, base - 44]], WOOD[1], 5); line(c, [[x + 18, base], [x + 18, base - 44]], WOOD[2], 4, 0.8);
  rr(c, x, base - 50, 36, 8, 4, lin(c, 0, base - 50, 0, base - 42, [[0, '#8a6f52'], [1, '#5a4633']]));
}

// 作品展架：两根竖杆两道横杆，晾衣夹夹着凡哥的两张画，画的内容是他眼里的城市
export function artRack(c, x, base) {
  for (const px of [x, x + 118]) { line(c, [[px, base], [px, base - 380]], WOOD[1], 6); line(c, [[px - 1, base], [px - 1, base - 380]], WOOD[0], 2, 0.5); }
  line(c, [[x - 6, base - 360], [x + 124, base - 360]], WOOD[1], 4); line(c, [[x - 6, base - 210], [x + 124, base - 210]], WOOD[1], 4);
  const painting = (px, py, w, h, seed) => {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
    rr(c, px, py, w, h, 1, '#d8d0bd'); c.restore();
    rr(c, px + 4, py + 4, w - 8, h - 8, 0, lin(c, 0, py, 0, py + h, [[0, '#7e8a92'], [0.6, '#4d5960'], [1, '#2e363b']]));
    for (let i = 0; i < 6; i++) { const bw = 6 + hash(seed + i) * 12, bh = 14 + hash(seed + i + 3) * (h * 0.5); rect(c, px + 6 + i * ((w - 14) / 6), py + h - 6 - bh, bw, bh, i % 2 ? '#3a444a' : '#2a3338'); }
    ell(c, px + w * 0.62, py + h * 0.42, 3, 3, '#e3bb72'); line(c, [[px + 8, py + h * 0.3], [px + w - 8, py + h * 0.26]], 'rgba(220,210,190,0.35)', 3, 1);
    for (const cx of [px + 12, px + w - 12]) rr(c, cx - 3, py - 8, 6, 14, 1, '#a88f66');
  };
  painting(x + 8, base - 352, 100, 76, 71); painting(x + 22, base - 200, 72, 92, 83);
}

// 晾晒架：两根杆之间一根下垂的绳，挂着深色卫衣、牛仔裤、灰 T 恤，湿衣服底下一片渍
export function dryingRack(c, x, base) {
  ell(c, x + 8, base, 14, 4, 'rgba(60,80,95,0.5)'); ell(c, x + 58, base, 20, 4, 'rgba(60,80,95,0.5)'); ell(c, x + 104, base, 14, 4, 'rgba(60,80,95,0.5)');
  for (const px of [x, x + 116]) { line(c, [[px, base], [px, base - 190]], METAL[1], 5); line(c, [[px - 10, base], [px + 10, base]], METAL[1], 5); }
  curve(c, [[x, base - 186], [x + 58, base - 170], [x + 116, base - 186]], '#8f8a7a', 2.5);
  // 卫衣：带帽子，肩宽下窄
  blob(c, [[x + 6, base - 178], [x + 44, base - 176], [x + 46, base - 110], [x + 30, base - 96], [x + 8, base - 108]], lin(c, 0, base - 178, 0, base - 96, [[0, '#343c41'], [1, '#1f2529']]));
  blob(c, [[x + 14, base - 176], [x + 26, base - 190], [x + 40, base - 178], [x + 28, base - 170]], '#2b3236');
  // 牛仔裤：对折挂着，两条裤腿
  rr(c, x + 50, base - 176, 34, 84, 3, lin(c, x + 50, 0, x + 84, 0, [[0, '#2f4356'], [0.5, '#3f5468'], [1, '#2a3a4a']]));
  line(c, [[x + 67, base - 150], [x + 67, base - 96]], '#243444', 1.5, 0.8);
  // T 恤
  blob(c, [[x + 86, base - 176], [x + 112, base - 178], [x + 114, base - 120], [x + 100, base - 112], [x + 86, base - 122]], lin(c, 0, base - 178, 0, base - 112, [[0, '#8fa2a9'], [1, '#5f7178']]));
  for (const px of [x + 12, x + 40, x + 56, x + 80, x + 90, x + 108]) rr(c, px - 2, base - 184, 5, 12, 1, '#a88f66');
}
// 滴水单独一个动态过程：晾晒架下的水珠，落到地上散成一小圈
export function rackDrops(c, x, base, tick) {
  for (let i = 0; i < 6; i++) {
    const px = x + 12 + hash(i * 7) * 96, t = ((tick * 2 + i * 60) % 120) / 120, py = base - 110 + t * 110;
    c.save(); c.globalAlpha = 0.7 * (1 - t * 0.4); ell(c, px, py, 1.6, 4, '#bcd0dc'); c.restore();
    if (t > 0.92) { c.save(); c.globalAlpha = 0.35; c.strokeStyle = '#bcd0dc'; c.lineWidth = 1; c.beginPath(); c.ellipse(px, base, (t - 0.9) * 90, (t - 0.9) * 22, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
  }
}

// 橘猫蜷在火边：身体一个软团，虎斑几道短弧，尾巴一笔渐细
export function cat(c, x, base) {
  shadow(c, x + 34, base + 2, 40, 8, 0.45);
  blob(c, [[x, base - 6], [x + 6, base - 30], [x + 34, base - 40], [x + 64, base - 30], [x + 70, base - 8], [x + 36, base]], lin(c, 0, base - 40, 0, base, [[0, '#d9a061'], [0.5, '#c98b4a'], [1, '#8d5e2e']]));
  for (const [sx, sy] of [[x + 20, base - 30], [x + 34, base - 36], [x + 48, base - 32]]) curve(c, [[sx - 4, sy + 10], [sx, sy], [sx + 6, sy + 10]], '#a86f36', 3, 0.8);
  limb(c, x + 64, base - 14, x + 20, base - 6, 9, '#c98b4a', '#e0ac6d', 0, -0.4); limb(c, x + 24, base - 6, x + 4, base - 12, 6, '#c98b4a', '#e0ac6d', 0, -0.4);
  blob(c, [[x + 56, base - 26], [x + 60, base - 44], [x + 72, base - 46], [x + 82, base - 38], [x + 80, base - 22], [x + 62, base - 18]], lin(c, 0, base - 46, 0, base - 18, [[0, '#e6b37a'], [1, '#c98b4a']]));
  poly(c, [[x + 60, base - 40], [x + 62, base - 54], [x + 70, base - 44]], '#c98b4a'); poly(c, [[x + 76, base - 44], [x + 82, base - 56], [x + 84, base - 40]], '#c98b4a');
  line(c, [[x + 66, base - 34], [x + 71, base - 33]], '#5a3a1e', 1.5); line(c, [[x + 76, base - 33], [x + 81, base - 34]], '#5a3a1e', 1.5);
  ell(c, x + 74, base - 28, 2, 1.5, '#8a4a3a');
}
