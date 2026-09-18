// 像素绘制层：角色小人、头像与表情、桥下、天际线、放映场面。地图、弹窗与开场共用。
import { actionPose } from './pixel-actions.js';
// 三人服装按当前角色设定；场景和道具仍共用像素原语。
export function px(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// 棋盘抖动：两色间隔像素，像素画里表现雾、污渍和明暗过渡。
function dither(c, x, y, w, h, color, step = 2, phase = 0) {
  c.fillStyle = color;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) % step; xx < w; xx += step) c.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
}

const SKIN = '#d9a577', SKIN_D = '#b98358', SKIN_L = '#ecc19a', OUT = '#141a1f', EYE = '#1c2026';
const WHO = {
  xuan: { hair: '#1e1a1c', skin: '#ecc19a', skinD: '#d9a577', skinL: '#f3d3b2', top: '#252b2e', topL: '#3c4548', topD: '#161b1e', inner: '#30383c', pants: '#2c3138', pantsD: '#20242a', shoe: '#1f2226', shoeD: '#7b8081' },
  fan: { hair: '#d8b35d', skin: '#b98358', skinD: '#986747', skinL: '#d9a577', top: '#c69a32', topL: '#e0bb57', topD: '#987028', inner: '#467aa1', pants: '#456784', pantsD: '#304c67', shoe: '#b8832d', shoeD: '#79562c' },
  ma: { hair: '#1e1a1c', skin: '#b98358', skinD: '#986747', skinL: '#d9a577', top: '#252b2e', topL: '#3c4548', topD: '#161b1e', inner: '#252b2e', pants: '#626b70', pantsD: '#465056', shoe: '#d8d6cf', shoeD: '#737d83', shortSleeve: true },
};

// 三个小人：24×38 的站姿基准，原点在左上，脚底在 y+37。pose: stand | walk0..walk3 | crouch | sit
export function sprite(c, x, y, who, scale = 1, pose = 'stand') {
  const k = WHO[who] || WHO.xuan;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(scale, scale);
  const walk = pose.startsWith('walk');
  const action = /^(work|beg|smoke|phone|sketch|repair|stall|wash|rest|carry|fish|talk|cook)([012])$/.exec(pose);
  const wf = walk ? (Number(pose.slice(4)) || 0) % 4 : 0;
  const crouch = pose === 'crouch' || ['work', 'repair', 'wash'].includes(action?.[1]);
  const sit = pose === 'sit' || pose === 'sitlook' || ['rest', 'fish', 'cook'].includes(action?.[1]);
  const dy = crouch ? 8 : sit ? 4 : 0;
  const bob = walk && wf % 2 === 1 ? 1 : 0;
  const legOff = walk ? [3, 0, -3, 0][wf] : 0;
  const armOff = walk ? [-2, 0, 2, 0][wf] : 0;
  // 影子
  px(c, 0, 35, 24, 3, 'rgba(10,18,24,0.45)');
  // 腿与脚
  if (crouch) {
    px(c, 1, 29, 22, 7, OUT); px(c, 2, 30, 20, 5, k.pants); px(c, 2, 30, 20, 1, k.pantsD);
    px(c, 0, 34, 10, 4, OUT); px(c, 14, 34, 10, 4, OUT); px(c, 1, 34, 8, 3, k.shoe); px(c, 15, 34, 8, 3, k.shoe); px(c, 1, 36, 8, 1, k.shoeD); px(c, 15, 36, 8, 1, k.shoeD);
  } else if (sit) {
    px(c, 3, 26, 14, 9, OUT); px(c, 4, 27, 12, 7, k.pants); px(c, 10, 30, 20, 6, OUT); px(c, 11, 31, 18, 4, k.pants); px(c, 11, 31, 18, 1, k.pantsD);
    px(c, 26, 29, 8, 7, OUT); px(c, 27, 30, 6, 5, k.shoe); px(c, 27, 34, 6, 1, k.shoeD); px(c, 22, 33, 5, 3, k.shoe);
  } else {
    px(c, 5 + legOff, 26 - bob, 8, 10, OUT); px(c, 11 - legOff, 26 - bob, 8, 10, OUT);
    px(c, 6 + legOff, 27 - bob, 6, 8, k.pants); px(c, 12 - legOff, 27 - bob, 6, 8, k.pants);
    px(c, 6 + legOff, 27 - bob, 2, 8, k.pantsD); px(c, 12 - legOff, 27 - bob, 2, 8, k.pantsD);
    px(c, 3 + legOff, 33 - bob, 10, 5, OUT); px(c, 11 - legOff, 33 - bob, 10, 5, OUT);
    px(c, 4 + legOff, 34 - bob, 8, 3, k.shoe); px(c, 12 - legOff, 34 - bob, 8, 3, k.shoe); px(c, 4 + legOff, 36 - bob, 8, 1, k.shoeD); px(c, 12 - legOff, 36 - bob, 8, 1, k.shoeD);
  }
  // 躯干（含轮廓、左亮右暗）
  const ty = 13 + dy - bob;
  px(c, 3, ty, 18, 15, OUT); px(c, 4, ty + 1, 16, 13, k.top); px(c, 4, ty + 1, 5, 13, k.topL); px(c, 16, ty + 1, 4, 13, k.topD);
  // 手臂：走路时前后摆
  const la = 15 + dy - bob + armOff, ra = 15 + dy - bob - armOff;
  if (sit) { px(c, 0, ty + 2, 5, 11, OUT); px(c, 1, ty + 3, 3, 9, k.shortSleeve ? k.skin : k.topL); px(c, 19, ty + 2, 5, 9, OUT); px(c, 20, ty + 3, 3, 7, k.shortSleeve ? k.skin : k.topD); px(c, 1, ty + 11, 3, 2, k.skin); px(c, 20, ty + 9, 3, 2, k.skin); }
  else if (crouch) { px(c, 0, ty + 2, 5, 12, OUT); px(c, 1, ty + 3, 3, 10, k.shortSleeve ? k.skin : k.topL); px(c, 19, ty + 2, 5, 12, OUT); px(c, 20, ty + 3, 3, 10, k.shortSleeve ? k.skin : k.topD); px(c, 1, ty + 12, 3, 2, k.skin); px(c, 20, ty + 12, 3, 2, k.skin); }
  else { px(c, 0, la, 5, 12, OUT); px(c, 1, la + 1, 3, 10, k.shortSleeve ? k.skin : k.topL); px(c, 19, ra, 5, 12, OUT); px(c, 20, ra + 1, 3, 10, k.shortSleeve ? k.skin : k.topD); px(c, 1, la + 11, 3, 2, k.skin); px(c, 20, ra + 11, 3, 2, k.skin); }
  if (k.shortSleeve) { px(c, 1, la + 1, 3, 4, k.topL); px(c, 20, ra + 1, 3, 4, k.topD); }
  // 各人衣着特征
  if (who === 'xuan') {
    px(c, 8, ty + 1, 4, 3, '#778387'); px(c, 13, ty + 1, 4, 3, '#778387');
    px(c, 11, ty + 4, 3, 8, k.inner); px(c, 12, ty + 7, 1, 1, '#778387');
    px(c, 12, ty + 10, 1, 1, '#778387'); px(c, 5, ty + 11, 3, 1, k.topD);
    px(c, 6, ty + 5, 3, 2, k.topL); px(c, 6, ty + 7, 3, 1, k.topD);
  } else if (who === 'fan') {
    px(c, 8, ty + 2, 8, 11, k.inner);
    px(c, 6, ty + 1, 3, 11, k.topL); px(c, 16, ty + 1, 3, 11, k.topD);
    px(c, 11, ty + 5, 2, 1, '#6a9ab8');
    px(c, 5, ty + 10, 3, 1, k.topD); px(c, 16, ty + 10, 3, 1, k.topL);
  } else {
    px(c, 8, ty + 1, 8, 2, k.topD); px(c, 10, ty + 3, 4, 2, k.skinD);
    px(c, 5, ty + 10, 3, 1, k.topL); px(c, 16, ty + 10, 3, 1, k.topL);
  }
  // 头：脸、头发、眼睛、轮廓
  const hy = dy - bob;
  px(c, 5, hy, 14, 14, OUT);
  px(c, 6, hy + 4, 12, 9, k.skin); px(c, 6, hy + 11, 12, 2, k.skinD); px(c, 7, hy + 5, 4, 2, k.skinL);
  px(c, 6, hy + 1, 12, 4, k.hair); px(c, 5, hy + 3, 2, 5, k.hair); px(c, 17, hy + 3, 2, 4, k.hair);
  if (who === 'fan') { px(c, 4, hy + 2, 2, 2, k.hair); px(c, 18, hy + 1, 3, 2, k.hair); px(c, 9, hy, 2, 2, k.hair); px(c, 14, hy, 3, 1, k.hair); }
  else { px(c, 6, hy + 4, 12, 1, k.hair); px(c, 6, hy + 5, 2, 1, k.hair); }
  if (who === 'ma') dither(c, 8, hy + 10, 8, 3, k.skinD, 3, 0);
  px(c, 9 + (pose === 'sitlook' ? 1 : 0), hy + 7, 2, 2, EYE); px(c, 14 + (pose === 'sitlook' ? 1 : 0), hy + 7, 2, 2, EYE); px(c, 9 + (pose === 'sitlook' ? 1 : 0), hy + 7, 1, 1, '#f2efe6'); px(c, 14 + (pose === 'sitlook' ? 1 : 0), hy + 7, 1, 1, '#f2efe6');
  if (pose === 'sitlook') { px(c, 18, hy + 5, 3, 7, k.skinD); px(c, 19, hy + 7, 2, 2, k.skinL); }
  if (action) actionPose(c, k, action[1], Number(action[2]), dy, who);
  if (pose === 'idle1') {
    if (who === 'xuan') { px(c, 19, 15, 5, 7, k.topD); px(c, 17, 20, 4, 3, k.skin); }
    else if (who === 'fan') { px(c, 17, 16, 7, 4, k.topD); px(c, 12, 17, 6, 3, k.skin); }
    else { px(c, 18, 16, 6, 6, k.skin); px(c, 16, 20, 5, 3, k.skinD); }
  }
  c.restore();
}

export const MOODS = ['normal', 'tired', 'sick', 'sad', 'happy', 'hungry', 'cold', 'hurt'];

// 由角色状态推表情，按危险程度排优先级。
export function moodOf(p) {
  if (!p) return 'normal';
  if (p.life === 'downed') return 'hurt';
  if (p.health < 40) return 'hurt';
  if (p.diseases && p.diseases.length) return 'sick';
  if (p.warmth < 30) return 'cold';
  if (p.food < 25) return 'hungry';
  if (p.energy < 30) return 'tired';
  if (p.mind < 35) return 'sad';
  if (p.mind >= 70) return 'happy';
  return 'normal';
}

// 半身像（32×38 逻辑尺寸）：脸大一点才看得出表情。
function bust(c, who, mood) {
  const k = WHO[who] || WHO.xuan;
  px(c, 0, 0, 32, 38, '#192a32');
  for (let y = 4; y < 38; y += 7) px(c, 0, y, 32, 1, '#22353d');
  // 肩膀与衣领
  px(c, 2, 27, 28, 11, OUT); px(c, 3, 28, 26, 10, k.top); px(c, 3, 28, 8, 10, k.topL); px(c, 21, 28, 8, 10, k.topD);
  if (who === 'xuan') { px(c, 11, 28, 4, 3, '#778387'); px(c, 18, 28, 4, 3, '#778387'); px(c, 15, 31, 2, 7, k.inner); px(c, 16, 33, 1, 1, '#778387'); }
  else if (who === 'fan') { px(c, 12, 28, 9, 10, k.inner); px(c, 8, 29, 4, 9, k.topL); px(c, 21, 29, 4, 9, k.topD); }
  else { px(c, 13, 28, 7, 2, k.topD); px(c, 15, 30, 3, 2, k.skinD); px(c, 5, 31, 4, 3, k.topL); px(c, 23, 31, 4, 3, k.topL); }
  // 头
  px(c, 6, 2, 20, 26, OUT); px(c, 7, 6, 18, 20, k.skin); px(c, 7, 22, 18, 4, k.skinD); px(c, 8, 7, 5, 3, k.skinL);
  px(c, 5, 12, 2, 6, OUT); px(c, 25, 12, 2, 6, OUT); px(c, 6, 13, 1, 4, k.skinD); px(c, 25, 13, 1, 4, k.skinD);
  px(c, 7, 3, 18, 6, k.hair); px(c, 6, 6, 3, 8, k.hair); px(c, 23, 6, 3, 7, k.hair);
  if (who === 'fan') { px(c, 5, 4, 3, 3, k.hair); px(c, 24, 2, 4, 3, k.hair); px(c, 12, 1, 4, 2, k.hair); px(c, 18, 1, 5, 2, k.hair); px(c, 9, 8, 6, 2, k.hair); }
  else { px(c, 7, 8, 18, 2, k.hair); px(c, 7, 10, 3, 2, k.hair); px(c, 20, 9, 5, 2, k.hair); }
  if (who === 'ma') dither(c, 10, 21, 12, 3, k.skinD, 3, 1);
  // 眉、眼、嘴按表情变化
  const sick = mood === 'sick', tired = mood === 'tired', sad = mood === 'sad', happy = mood === 'happy', hungry = mood === 'hungry', cold = mood === 'cold', hurt = mood === 'hurt';
  if (sick) dither(c, 7, 6, 18, 20, '#8fb27a', 3, 0);
  if (cold) dither(c, 7, 6, 18, 20, '#bcd2df', 3, 1);
  const browY = happy ? 10 : cold ? 10 : 11;
  const brow = k.hair;
  if (sad) { px(c, 9, browY + 1, 2, 1, brow); px(c, 11, browY, 3, 1, brow); px(c, 18, browY, 3, 1, brow); px(c, 21, browY + 1, 2, 1, brow); }
  else if (hurt) { px(c, 9, browY, 2, 1, brow); px(c, 11, browY + 1, 3, 1, brow); px(c, 18, browY + 1, 3, 1, brow); px(c, 21, browY, 2, 1, brow); }
  else { px(c, 9, browY, 5, 1, brow); px(c, 18, browY, 5, 1, brow); }
  const eyeY = 13;
  if (happy) { px(c, 9, eyeY + 1, 5, 1, EYE); px(c, 9, eyeY, 1, 1, EYE); px(c, 13, eyeY, 1, 1, EYE); px(c, 18, eyeY + 1, 5, 1, EYE); px(c, 18, eyeY, 1, 1, EYE); px(c, 22, eyeY, 1, 1, EYE); }
  else if (tired) { px(c, 9, eyeY + 1, 5, 2, EYE); px(c, 18, eyeY + 1, 5, 2, EYE); px(c, 9, eyeY + 3, 5, 1, '#5a6a8c'); px(c, 18, eyeY + 3, 5, 1, '#5a6a8c'); px(c, 10, eyeY + 1, 1, 1, '#f2efe6'); px(c, 19, eyeY + 1, 1, 1, '#f2efe6'); }
  else if (hurt) { px(c, 9, eyeY + 1, 5, 1, EYE); px(c, 18, eyeY, 4, 3, EYE); px(c, 19, eyeY, 1, 1, '#f2efe6'); }
  else if (sick) { px(c, 9, eyeY, 4, 3, EYE); px(c, 18, eyeY + 1, 4, 3, EYE); px(c, 10, eyeY, 1, 1, '#f2efe6'); px(c, 19, eyeY + 1, 1, 1, '#f2efe6'); }
  else { px(c, 9, eyeY, 4, 3, EYE); px(c, 18, eyeY, 4, 3, EYE); px(c, 10, eyeY, 1, 1, '#f2efe6'); px(c, 19, eyeY, 1, 1, '#f2efe6'); }
  const mouthY = 21;
  const lip = cold ? '#6b7fa8' : '#7a3f34';
  if (happy) { px(c, 12, mouthY, 8, 1, lip); px(c, 11, mouthY - 1, 1, 1, lip); px(c, 20, mouthY - 1, 1, 1, lip); px(c, 13, mouthY + 1, 6, 1, '#f2efe6'); px(c, 7, 17, 3, 2, '#e08a7a'); px(c, 22, 17, 3, 2, '#e08a7a'); }
  else if (sad) { px(c, 13, mouthY, 6, 1, lip); px(c, 12, mouthY + 1, 1, 1, lip); px(c, 19, mouthY + 1, 1, 1, lip); px(c, 22, 16, 1, 4, '#8fc3e6'); px(c, 22, 20, 2, 1, '#8fc3e6'); }
  else if (hungry) { px(c, 13, mouthY - 1, 6, 4, OUT); px(c, 14, mouthY, 4, 2, '#5a2a26'); }
  else if (hurt) { for (let i = 0; i < 4; i++) px(c, 12 + i * 2, mouthY + (i % 2), 2, 1, lip); }
  else if (sick) { for (let i = 0; i < 4; i++) px(c, 12 + i * 2, mouthY + ((i + 1) % 2), 2, 1, lip); }
  else if (tired) { px(c, 13, mouthY + 1, 6, 1, lip); }
  else if (cold) { px(c, 13, mouthY, 6, 1, lip); px(c, 13, mouthY, 1, 1, '#4d5f8a'); px(c, 15, mouthY, 1, 1, '#4d5f8a'); px(c, 17, mouthY, 1, 1, '#4d5f8a'); }
  else { px(c, 13, mouthY, 6, 1, lip); }
  // 小记号：汗、绷带、冷线、疲惫的 z
  if (hurt) { px(c, 8, 8, 6, 6, '#eee9df'); px(c, 8, 10, 6, 2, '#d9c9c0'); px(c, 10, 8, 2, 6, '#d9c9c0'); }
  if (hurt || sick || hungry) { px(c, 25, 9, 2, 3, '#8fc3e6'); px(c, 25, 8, 1, 1, '#8fc3e6'); }
  if (cold) { px(c, 3, 6, 1, 3, '#bcd2df'); px(c, 4, 9, 1, 2, '#bcd2df'); px(c, 28, 8, 1, 3, '#bcd2df'); px(c, 27, 11, 1, 2, '#bcd2df'); }
  if (tired) { px(c, 26, 3, 4, 1, '#e6dfcc'); px(c, 28, 4, 1, 1, '#e6dfcc'); px(c, 27, 5, 1, 1, '#e6dfcc'); px(c, 26, 6, 4, 1, '#e6dfcc'); }
}

export function portrait(canvas, who, mood = 'normal') {
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.setTransform(1, 0, 0, 1, 0, 0);
  bust(c, who, mood);
}

// 对话弹窗用的大头像（48×56）：同一张半身像放大 1.5。
export function bigPortrait(canvas, who, mood = 'normal') {
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.setTransform(1.5, 0, 0, 1.5, 0, 0);
  bust(c, who, mood);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

// 天际线：w×h 画布，dawn 为 0-1 的亮度。远近两层楼，远层更暗更矮，楼顶有水箱和天线。
export function skyline(c, w, h, dawn = 1) {
  const sky = dawn < 0.5 ? '#2a3a46' : dawn < 0.8 ? '#4e6672' : '#6a8288';
  px(c, 0, 0, w, h, sky);
  px(c, 0, h * 0.2, w, h * 0.28, dawn < 0.5 ? '#3c4f58' : '#879795');
  dither(c, 0, h * 0.44, w, h * 0.08, dawn < 0.5 ? '#3c4f58' : '#879795', 2, 0);
  const k = w / 480;
  const far = [[10, 70, 30, 80], [62, 56, 26, 94], [120, 78, 36, 72], [200, 50, 24, 100], [300, 72, 40, 78], [372, 60, 30, 90], [440, 76, 34, 74]];
  for (const [x, y, bw, bh] of far) { px(c, x * k, y * k, bw * k, bh * k, dawn < 0.5 ? '#354852' : '#6e8388'); for (let wy = y + 8; wy < y + bh - 6; wy += 10) for (let wx = x + 5; wx < x + bw - 3; wx += 8) if ((wx * 3 + wy) % 5 === 0 && dawn < 0.9) px(c, wx * k, wy * k, 2 * k, 3 * k, '#c9b07a'); }
  const buildings = [[0, 46, 38, 100], [44, 31, 47, 112], [98, 61, 34, 90], [139, 24, 52, 128], [202, 40, 34, 117], [244, 14, 48, 140], [308, 44, 40, 105], [359, 35, 52, 114], [424, 61, 55, 90]];
  for (const [x, y, bw, bh] of buildings) {
    px(c, x * k, y * k, bw * k, bh * k, '#566f78');
    px(c, (x + 3) * k, (y + 3) * k, (bw - 6) * k, (bh - 3) * k, '#5e7780');
    px(c, x * k, y * k, bw * k, 2 * k, '#748a91');
    if (bw > 44) { px(c, (x + 6) * k, (y - 7) * k, 9 * k, 7 * k, '#4b6069'); px(c, (x + 5) * k, (y - 8) * k, 11 * k, 2 * k, '#6b8087'); }
    if (bh > 120) px(c, (x + bw / 2) * k, (y - 14) * k, 1 * k, 14 * k, '#8a9398');
    for (let wy = y + 10; wy < y + bh - 7; wy += 13) for (let wx = x + 7; wx < x + bw - 4; wx += 10) px(c, wx * k, wy * k, 3 * k, 5 * k, (wx + wy) % 3 === 0 && dawn < 0.9 ? '#e0c987' : (wx + wy) % 7 === 0 ? '#4f666e' : '#789093');
  }
}

// 桥下场景（480×270 逻辑尺寸）。opts: rain, snow, night, camp(防雨等级), beds, art, dust(粒子数组), car(x 或 null), fire(布尔), cat(布尔), tick
export function bridgeScene(c, opts = {}) {
  const tick = opts.tick || 0;
  skyline(c, 480, 270, opts.dawn ?? 1);
  // 桥面：路面、栏杆、桥底阴影
  px(c, 0, 16, 480, 17, '#414e55'); px(c, 0, 28, 480, 8, '#263b47'); px(c, 0, 8, 480, 5, '#abb0a0'); px(c, 0, 13, 480, 3, '#8b938e');
  for (let x = 0; x < 480; x += 30) px(c, x, 0, 3, 10, '#667477');
  for (let x = 6; x < 480; x += 30) px(c, x, 4, 24, 1, '#7c8a8b');
  dither(c, 0, 36, 480, 6, '#263b47', 2, 0);
  if (opts.car !== null && opts.car !== undefined) { px(c, opts.car, 6, 34, 9, '#b9b39a'); px(c, opts.car + 4, 3, 22, 5, '#8fa0a5'); px(c, opts.car + 3, 14, 6, 3, '#222'); px(c, opts.car + 25, 14, 6, 3, '#222'); px(c, opts.car + 33, 8, 2, 3, '#ffe9a8'); }
  // 桥柱：亮面、暗面、横缝、水渍与污斑
  for (const [x, w, l, d, shade] of [[45, 38, '#81908a', '#435b64', 0], [393, 41, '#788981', '#3d5760', 1]]) {
    px(c, x, 33, w, 162, '#697d7c'); px(c, x + 6, 34, 8, 163, l); px(c, x + w - 7, 34, 7, 163, d);
    for (let y = 56; y < 180; y += 27) px(c, x + 1, y, w - 2, 2, '#596d70');
    dither(c, x + 3, 140, w - 6, 55, '#54666a', 3, shade); px(c, x + 12, 60, 2, 40, '#5d6f72'); px(c, x + w - 14, 90, 1, 60, '#5a6c6f');
    px(c, x - 4, 190, w + 8, 6, '#54666a');
  }
  // 地面：远处更亮，近处更暗，有裂缝与碎石
  px(c, 0, 176, 480, 94, '#3e5256'); px(c, 0, 191, 480, 4, '#677675'); px(c, 0, 235, 480, 35, '#33474c');
  dither(c, 0, 228, 480, 8, '#33474c', 2, 0);
  for (let x = 0; x < 480; x += 29) { px(c, x, 252 + (x % 7), 17, 1, '#52686b'); px(c, x + 13, 208 + (x % 9), 7, 2, '#586c6c'); px(c, x + 22, 244 + (x % 5), 3, 2, '#4a5e62'); }
  // 水洼
  px(c, 246, 246, 60, 10, '#405a62'); px(c, 242, 250, 68, 4, '#405a62'); px(c, 252, 248, 18, 1, '#6a848c'); px(c, 276 + (Math.floor(tick / 18) % 3), 252, 10, 1, '#6a848c');
  px(c, 20, 240, 34, 6, '#405a62'); px(c, 26, 241, 10, 1, '#6a848c');
  // 营地：篷布（有褶）、床铺、箱子
  const camp = opts.camp ?? 1;
  px(c, 95, 137, 122, 4, '#7a7062'); px(c, 100, 130, 5, 86, '#4f483f'); px(c, 205, 131, 5, 83, '#4f483f');
  for (let x = 100; x < 214; x += 12) px(c, x, 133 - (x % 3), 12, 10, camp >= 2 ? '#b4a77b' : '#8e947d');
  for (let x = 104; x < 214; x += 24) px(c, x, 135, 1, 8, camp >= 2 ? '#9c8f66' : '#78806a');
  px(c, 110, 151, 95, 57, '#33434b'); dither(c, 110, 151, 95, 10, '#2a373d', 2, 0);
  px(c, 109, 196, 91, 15, '#7e6b55'); px(c, 112, 189, 45, 12, '#b1a487'); px(c, 114, 191, 20, 3, '#c9bd9c'); px(c, 161, 194, 37, 8, '#678087'); px(c, 163, 195, 12, 2, '#82a0a8');
  if (opts.beds >= 3) { px(c, 230, 198, 50, 12, '#7e6b55'); px(c, 233, 192, 28, 10, '#b1a487'); }
  px(c, 310, 193, 35, 29, '#8b7257'); px(c, 310, 191, 35, 5, '#aa9070'); px(c, 326, 194, 2, 26, '#b29c7a'); px(c, 313, 200, 8, 6, '#6e5a44');
  // 纸板牌与行李箱
  px(c, 222, 200, 26, 20, '#c9b389'); px(c, 222, 200, 26, 2, '#a8926c'); px(c, 226, 205, 18, 2, '#5a4633'); px(c, 226, 210, 12, 2, '#5a4633'); px(c, 226, 215, 16, 2, '#5a4633');
  px(c, 252, 194, 18, 28, '#4a4a52'); px(c, 254, 196, 14, 24, '#5f5f69'); px(c, 257, 188, 8, 6, '#4a4a52'); px(c, 252, 206, 18, 2, '#33333a');
  // 灯与涂鸦
  px(c, 354, 105, 3, 110, '#273d46'); px(c, 349, 101, 14, 7, opts.night ? '#f0c96b' : '#e2bb73'); px(c, 350, 107, 11, 7, '#b39765');
  if (opts.art > 0) for (let i = 0; i < Math.min(opts.art, 5); i++) { px(c, 52, 112 + i * 7, 23, 3, ['#ddaa68', '#79b5aa', '#b18b91', '#d5c9a1', '#b1bd83'][i]); }
  // 油桶篝火：夜里或指定时烧着
  if (opts.fire ?? opts.night) {
    px(c, 282, 214, 22, 26, '#3a3a3a'); px(c, 284, 216, 18, 22, '#4d4740'); px(c, 282, 214, 22, 2, '#5c5650'); px(c, 282, 224, 22, 1, '#2f2a26'); px(c, 282, 232, 22, 1, '#2f2a26');
    px(c, 287, 228, 4, 6, '#2a2320'); dither(c, 284, 218, 18, 20, '#6b4a2e', 3, 1);
    const f = Math.floor(tick / 5) % 3;
    px(c, 286, 206 - f, 14, 9 + f, '#e2833a'); px(c, 289, 202 - f * 2, 8, 6 + f, '#f1c46b'); px(c, 291, 199 - f, 4, 4, '#fbe7a1'); px(c, 284 + f, 210, 3, 4, '#e2833a'); px(c, 299 - f, 209, 3, 5, '#e2833a');
    for (let i = 0; i < 4; i++) { const t = (tick * 2 + i * 9) % 30; px(c, 290 + ((i * 5 + t) % 9), 198 - t, 1, 1, i % 2 ? '#f1c46b' : '#e2833a'); }
    c.fillStyle = 'rgba(240,170,80,0.10)'; c.fillRect(250, 180, 90, 70);
  }
  // 橘猫：蜷在纸板旁，耳朵偶尔动一下
  if (opts.cat !== false) { px(c, 236, 226, 16, 7, '#c98b4a'); px(c, 249, 222, 6, 6, '#c98b4a'); px(c, 250 + (Math.floor(tick / 40) % 2), 220, 2, 3, '#c98b4a'); px(c, 253, 220, 2, 3, '#c98b4a'); px(c, 238, 228, 10, 2, '#e6b37a'); px(c, 232, 230, 5, 3, '#c98b4a'); px(c, 251, 225, 1, 1, '#2b2b30'); }
  if (opts.night && Array.isArray(opts.who)) {
    const places = [[248, 209], [311, 207], [345, 211]];
    opts.who.slice(0, 3).forEach((id, i) => sprite(c, places[i][0], places[i][1], id, 1, 'sit'));
  }
  if (opts.rain) for (let i = 0; i < 40; i++) { const x = (i * 53 + tick * 3) % 480, y = (i * 37 + tick * 9) % 255; px(c, x, y, 1, 7, '#9ab1ad'); }
  if (opts.rain) for (let i = 0; i < 7; i++) {
    const spread = Math.floor((tick + i * 7) % 20 / 4), x = 18 + i * 67, y = 244 + i % 3 * 4;
    px(c, x - spread, y - (spread < 3 ? spread : 0), 2, 1, '#9ab1ad');
    px(c, x + spread + 2, y - (spread < 3 ? spread : 0), 2, 1, '#9ab1ad');
  }
  if (opts.snow) for (let i = 0; i < 40; i++) { const x = (i * 47 + tick) % 480, y = (i * 31 + tick * 2) % 255; px(c, x, y, 2, 2, '#e8eef0'); }
  for (const d of opts.dust || []) px(c, d.x, d.y, 2, 2, '#b9b0a0');
  if (opts.night) { c.fillStyle = 'rgba(12,29,47,0.32)'; c.fillRect(0, 0, 480, 270); }
}

// 营地放映（480×270）：桥下夜景 + 箱子上的电视 + 坐着看的人。opts: who(数组), guest(布尔), tick, camp, beds, art, rain
export function screeningScene(c, opts = {}) {
  const tick = opts.tick || 0;
  bridgeScene(c, { dawn: 0.2, night: true, camp: opts.camp ?? 1, beds: opts.beds ?? 2, art: opts.art ?? 0, rain: opts.rain, tick, car: null, fire: true, cat: true });
  // 电视机：箱子上一台旧 CRT，天线歪着。
  px(c, 296, 150, 62, 46, '#23272b'); px(c, 300, 154, 54, 36, '#111518'); px(c, 302, 156, 50, 32, '#0c1a22');
  px(c, 326, 138, 2, 12, '#8a9096'); px(c, 318, 132, 10, 2, '#8a9096'); px(c, 328, 130, 12, 2, '#8a9096');
  px(c, 303, 191, 48, 4, '#2c3136'); px(c, 350, 160, 3, 3, '#c9443a');
  // 画面：三条色带缓慢滚动，偶尔一帧闪白，像素质量的“短片”。
  const bands = ['#5c7f8a', '#b59b6e', '#7a8f6a', '#8b6f7d'];
  for (let i = 0; i < 4; i++) {
    const y = 156 + ((i * 8 + Math.floor(tick / 6)) % 32);
    px(c, 302, y, 50, 6, bands[(i + Math.floor(tick / 40)) % bands.length]);
  }
  if (tick % 47 === 0) px(c, 302, 156, 50, 32, '#d8e2e6');
  for (let y = 156; y < 188; y += 3) px(c, 302, y, 50, 1, 'rgba(0,0,0,0.18)');
  // 屏幕蓝光洒到地上和人身上。
  const glow = 0.08 + 0.05 * Math.abs(Math.sin(tick / 9));
  c.fillStyle = `rgba(150,190,215,${glow.toFixed(3)})`;
  c.beginPath(); c.moveTo(300, 190); c.lineTo(354, 190); c.lineTo(400, 262); c.lineTo(180, 262); c.closePath(); c.fill();
  // 观众坐成一排，面朝电视；客人是个灰扑扑的路人身形。
  const who = opts.who || ['xuan', 'fan', 'ma'];
  who.forEach((id, i) => sprite(c, 262 + i * 30, 204, id, 1, Math.floor(tick / 70 + i * 3) % 8 === 0 ? 'sitlook' : 'sit'));
  if (opts.guest) { const gx = 232; px(c, gx + 4, 214, 11, 6, '#5a5f63'); px(c, gx + 5, 208, 9, 7, '#b39a82'); px(c, gx + 3, 220, 13, 9, '#4b5058'); px(c, gx + 1, 229, 8, 5, '#3a3f46'); px(c, gx + 10, 229, 8, 5, '#3a3f46'); px(c, gx + 3, 206, 11, 3, '#2f3338'); }
}
