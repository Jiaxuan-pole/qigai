// 刮刮乐：画票面，盖刮层，拖动擦除；单格擦除面积到 60% 自动露出；全部刮开与手刮结果一致。
import { px } from './pixel.js';

const W = 360, H = 240;

function cellRects(face) {
  if (face.style === 'street') {
    const out = [{ x: 140, y: 42, w: 80, h: 40, kind: 'win' }];
    face.cells.forEach((cell, i) => out.push({ x: 24 + (i % 3) * 112, y: 104 + Math.floor(i / 3) * 62, w: 96, h: 50, kind: 'cell', i }));
    return out;
  }
  if (face.style === 'bells') return face.rows.map((r, i) => ({ x: 24, y: 40 + i * 48, w: 312, h: 40, kind: 'row', i }));
  return face.cells.map((cell, i) => ({ x: 24 + (i % 4) * 82, y: 40 + Math.floor(i / 4) * 62, w: 72, h: 52, kind: 'cell', i }));
}

function drawFace(c, face, revealed) {
  px(c, 0, 0, W, H, face.style === 'street' ? '#e9dcc2' : face.style === 'bells' ? '#efe4c9' : '#dfe8ea');
  c.fillStyle = face.style === 'street' ? '#c0392b' : face.style === 'bells' ? '#8e6b2e' : '#2f6f8f';
  c.font = 'bold 20px sans-serif'; c.textAlign = 'left';
  c.fillText(face.style === 'street' ? '街角即开彩' : face.style === 'bells' ? '三个铃铛' : '好日子', 24, 28);
  c.font = '12px sans-serif'; c.fillStyle = '#5a4633';
  c.fillText('¥' + (face.price ?? 5) + ' · 返还含本金', 240, 28);
  const rects = cellRects(face);
  for (const r of rects) {
    px(c, r.x, r.y, r.w, r.h, '#fbf6ea');
    c.strokeStyle = '#8a7a5a'; c.lineWidth = 2; c.strokeRect(r.x, r.y, r.w, r.h);
    c.fillStyle = '#2b2b2b'; c.textAlign = 'center';
    if (r.kind === 'win') { c.font = '11px sans-serif'; c.fillText('中奖号码', r.x + r.w / 2, r.y - 4); c.font = 'bold 22px sans-serif'; c.fillText(String(face.winning), r.x + r.w / 2, r.y + 28); }
    else if (face.style === 'street') { const cell = face.cells[r.i]; const hit = cell.n === face.winning; c.font = 'bold 20px sans-serif'; c.fillStyle = hit ? '#c0392b' : '#2b2b2b'; c.fillText(String(cell.n), r.x + r.w / 2, r.y + 22); c.font = '12px sans-serif'; c.fillText('¥' + cell.prize, r.x + r.w / 2, r.y + 42); }
    else if (face.style === 'bells') { const row = face.rows[r.i]; const hit = row.syms[0] === row.syms[1] && row.syms[1] === row.syms[2]; c.font = 'bold 16px sans-serif'; c.fillStyle = hit ? '#c0392b' : '#2b2b2b'; row.syms.forEach((s, k) => c.fillText(s, r.x + 40 + k * 70, r.y + 26)); c.font = 'bold 14px sans-serif'; c.fillText('¥' + row.prize, r.x + 270, r.y + 26); }
    else { const cell = face.cells[r.i]; c.font = 'bold 18px sans-serif'; c.fillStyle = cell.hit ? '#c0392b' : '#4a5a60'; c.fillText(cell.hit ? '¥' + cell.prize : cell.icon, r.x + r.w / 2, r.y + 32); }
  }
  return rects;
}

// 返回控制器：{ revealAll, destroy }
export function mountScratch(canvas, face, revealedInit, onReveal) {
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const rects = drawFace(base.getContext('2d'), face, revealedInit);
  const cover = document.createElement('canvas'); cover.width = W; cover.height = H;
  const cc = cover.getContext('2d');
  cc.fillStyle = '#9a9a9a'; cc.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { cc.fillStyle = i % 2 ? '#b5b5b5' : '#7f7f7f'; cc.fillRect((i * 37) % W, (i * 53) % H, 6, 3); }
  cc.fillStyle = '#5e5e5e'; cc.font = 'bold 16px sans-serif'; cc.textAlign = 'center';
  for (let i = 0; i < rects.length; i++) cc.fillText('刮开', rects[i].x + rects[i].w / 2, rects[i].y + rects[i].h / 2 + 6);
  const revealed = new Set(revealedInit || []);
  const clearRect = (r) => { cc.clearRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); };
  rects.forEach((r, i) => { if (revealed.has(i)) clearRect(r); });
  let drawing = false, dirty = true;
  const paint = () => { c.clearRect(0, 0, W, H); c.drawImage(base, 0, 0); c.drawImage(cover, 0, 0); };
  paint();
  function erasedRatio(r) {
    const d = cc.getImageData(r.x, r.y, r.w, r.h).data;
    let clear = 0;
    for (let i = 3; i < d.length; i += 4 * 3) if (d[i] === 0) clear++;
    return clear / (d.length / 12);
  }
  function checkCells() {
    const newly = [];
    rects.forEach((r, i) => { if (!revealed.has(i) && erasedRatio(r) >= 0.6) { revealed.add(i); clearRect(r); newly.push(i); } });
    if (newly.length) { paint(); onReveal([...revealed], rects.length); }
  }
  function pos(e) { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; }
  function erase(e) { const [x, y] = pos(e); cc.save(); cc.globalCompositeOperation = 'destination-out'; cc.beginPath(); cc.arc(x, y, 16, 0, Math.PI * 2); cc.fill(); cc.restore(); dirty = true; paint(); }
  canvas.onpointerdown = (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); erase(e); };
  canvas.onpointermove = (e) => { if (drawing) erase(e); };
  canvas.onpointerup = canvas.onpointercancel = () => { drawing = false; checkCells(); };
  const timer = setInterval(() => { if (dirty) { dirty = false; checkCells(); } }, 250);
  return {
    revealAll() { rects.forEach((r, i) => { revealed.add(i); clearRect(r); }); paint(); onReveal([...revealed], rects.length); },
    total: rects.length,
    destroy() { clearInterval(timer); canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = null; },
  };
}
