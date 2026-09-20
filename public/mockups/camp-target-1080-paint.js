// 原生 1080p 效果图的画笔盒。和像素管线的 px/dither 完全不通用：这里全是抗锯齿路径、渐变、软阴影，
// 目的是让同一构图在「一画面像素等于一屏幕像素」下呈现手绘插画质感，供和 480/960 像素版并排比较。
export const W = 1920, H = 1080;

// 可复现的伪随机：同一 seed 每帧同一结果，纹理和雨点才不会每帧抖动
export const hash = (i) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

export function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}
export function rad(c, x, y, r0, r1, stops) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}
export const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

export function rect(c, x, y, w, h, fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
export function rr(c, x, y, w, h, r, fill, stroke) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
export function ell(c, x, y, rx, ry, fill, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
}
export function poly(c, pts, fill, stroke, lw = 1.5) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
// 过顶点中点的二次贝塞尔闭合曲线：被子、烟、猫、头发这些软东西不能有折角
export function blob(c, pts, fill, stroke, lw = 1.5) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  c.beginPath();
  let m = mid(pts[n - 1], pts[0]);
  c.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i]; m = mid(p, pts[(i + 1) % n]); c.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
export function line(c, pts, color, lw = 1, alpha = 1) {
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke(); c.restore();
}
export function curve(c, pts, color, lw = 1, alpha = 1) {
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]); c.stroke(); c.restore();
}
// 圆头粗线画四肢：先一笔本色，再在朝光一侧叠一笔窄亮色，一根线就有体积，不用为每段肢体建多边形
export function limb(c, x0, y0, x1, y1, w, color, light, lx = -0.35, ly = -0.35) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  if (light) {
    c.strokeStyle = light; c.lineWidth = Math.max(2, w * 0.35);
    c.beginPath(); c.moveTo(x0 + lx * w * 0.5, y0 + ly * w * 0.5); c.lineTo(x1 + lx * w * 0.5, y1 + ly * w * 0.5); c.stroke();
  }
}
// 软椭圆：中心到边缘透明的径向渐变，用于地面落影、光斑、雾、烟团
export function soft(c, x, y, rx, ry, rgb, alpha = 1) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx); c.globalAlpha *= alpha;
  c.fillStyle = rad(c, 0, 0, 0, rx, [[0, rgba(rgb, 1)], [0.55, rgba(rgb, 0.45)], [1, rgba(rgb, 0)]]);
  c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
}
// 点刻纹理：混凝土、木头、布料没有它就是塑料
export function stipple(c, x, y, w, h, color, alpha, n, seed, size = 2) {
  c.save(); c.globalAlpha *= alpha; c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const s = size * (0.4 + hash(seed + i * 3 + 2));
    c.fillRect(x + hash(seed + i * 3) * w, y + hash(seed + i * 3 + 1) * h, s, s * (0.6 + hash(seed + i * 7)));
  }
  c.restore();
}
// 铅笔排线：斜向平行细线带轻微抖动，剖面大块墙面靠它像插画而不像色块
export function hatch(c, x, y, w, h, spacing, alpha, color = '#080b0f', angle = -0.7, seed = 0) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.globalAlpha *= alpha; c.strokeStyle = color; c.lineWidth = 1;
  const len = Math.hypot(w, h), cx = x + w / 2, cy = y + h / 2;
  const nx = Math.cos(angle + Math.PI / 2), ny = Math.sin(angle + Math.PI / 2), dx = Math.cos(angle), dy = Math.sin(angle);
  for (let d = -len / 2; d < len / 2; d += spacing) {
    const j = (hash(seed + d) - 0.5) * spacing * 0.7, ox = cx + (d + j) * nx, oy = cy + (d + j) * ny;
    c.beginPath(); c.moveTo(ox - dx * len, oy - dy * len); c.lineTo(ox + dx * len, oy + dy * len); c.stroke();
  }
  c.restore();
}
// 竖向流痕：桥底、桥柱、油桶上的水渍和锈迹
export function drips(c, x, y, w, h, color, alpha, n, seed) {
  c.save(); c.globalAlpha *= alpha; c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const dx = x + hash(seed + i * 5) * w, dw = 1.5 + hash(seed + i * 5 + 1) * 5, dh = h * (0.25 + hash(seed + i * 5 + 2) * 0.75);
    c.beginPath(); c.roundRect(dx, y, dw, dh, dw / 2); c.fill();
  }
  c.restore();
}
// 喷漆字：同色 shadowBlur 做喷雾晕边
export function spray(c, text, x, y, size, color, rot = 0, alpha = 0.7, font = '900 {s}px "PingFang SC","Hiragino Sans GB",sans-serif') {
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= alpha;
  c.font = font.replace('{s}', size); c.textBaseline = 'top'; c.fillStyle = color;
  c.shadowColor = color; c.shadowBlur = size * 0.35;
  c.fillText(text, 0, 0); c.restore();
}
export function ink(c, text, x, y, size, color, rot = 0, alpha = 0.9) {
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= alpha;
  c.font = `700 ${size}px "Xingkai SC","Kaiti SC","STKaiti","PingFang SC",serif`; c.textBaseline = 'top'; c.fillStyle = color;
  c.fillText(text, 0, 0); c.restore();
}
// 噪点贴图只生成一次，每帧用 overlay 混合叠一层，压掉渐变的塑料光滑
let grainPattern = null;
export function grain(c, alpha = 0.09) {
  if (!grainPattern) {
    const t = document.createElement('canvas'); t.width = t.height = 256;
    const g = t.getContext('2d'); const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = 90 + Math.floor(hash(i) * 110); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); grainPattern = c.createPattern(t, 'repeat');
  }
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = alpha; c.fillStyle = grainPattern; c.fillRect(0, 0, W, H); c.restore();
}
