// 人物：轩哥弯腰修收音机、马哥站在火边叼烟；凡哥躺在床上，由 props 的 bed() 负责画。
// 造型按现行设定：轩哥黑发黑衬衫黑西裤黑皮鞋皮肤白、马哥黑短袖灰牛仔白灰运动鞋小麦色。
// 每个姿势都是手摆关节点再用 limb() 连线，没有骨架系统，换一个动作就要重摆一遍。
import { lin, rgba, rect, rr, ell, poly, blob, line, curve, limb, soft } from './camp-target-1080-paint.js';

const XUAN = { skin: '#ecc9a8', skinD: '#cfa583', hair: '#202226', hairL: '#42464e', shirt: '#2b3137', shirtL: '#4a535b', pants: '#20252b', pantsL: '#383f47', shoe: '#14171a', sole: '#565a5e' };
const MA = { skin: '#c8905f', skinD: '#a06f45', hair: '#232022', hairL: '#443c3e', tee: '#2b3136', teeL: '#48515a', jeans: '#6f787d', jeansL: '#8b9499', jeansD: '#525a5f', shoe: '#d8d6cf', sole: '#aeb4b5' };
// 火在马哥右侧、轩哥背后：给朝火一面描一道暖边，人物才从夜色里分出来
const RIM = 'rgba(255,175,95,0.55)';
const INK = 'rgba(8,10,14,0.55)';

function head(c, x, y, r, p, facing) {
  ell(c, x + facing * 1, y + 4, r - 1, r - 2, p.skinD);
  ell(c, x, y, r, r + 1, lin(c, x - r, 0, x + r, 0, facing > 0 ? [[0, p.skinD], [0.55, p.skin], [1, p.skin]] : [[0, p.skin], [0.45, p.skin], [1, p.skinD]]));
  // 耳朵与眼睑各一笔：这个尺寸下五官越少越像插画，越多越像贴图
  ell(c, x - facing * (r - 2), y + 2, 3.5, 4.5, p.skinD);
  line(c, [[x + facing * 5, y - 1], [x + facing * 10, y - 2]], '#2a2226', 1.6, 0.8);
}

// 轩哥：坐在矮凳上朝右弯向桌子，台灯只照到他的手和脸
export function xuanBent(c, x, base) {
  const hip = [x, base - 54], sh = [x + 36, base - 126], hd = [x + 56, base - 148];
  soft(c, x + 26, base + 2, 44, 8, [6, 9, 13], 0.5);
  // 后腿、后臂先画，被躯干压住一部分才有前后
  limb(c, hip[0] + 4, hip[1] + 2, x + 52, base - 56, 20, XUAN.pants, XUAN.pantsL, 0.2, -0.5); limb(c, x + 52, base - 56, x + 56, base - 8, 16, XUAN.pants, XUAN.pantsL, 0.4, 0);
  rr(c, x + 48, base - 10, 30, 11, 4, XUAN.shoe); rect(c, x + 48, base - 2, 30, 3, XUAN.sole);
  limb(c, sh[0] + 4, sh[1] + 4, x + 62, base - 84, 15, XUAN.shirt, XUAN.shirtL, 0.3, -0.4); limb(c, x + 62, base - 84, x + 120, base - 88, 13, XUAN.skin, null);
  // 躯干：前倾的圆角块，肩线比胯线更靠右，后背一道亮边是台灯的余光
  blob(c, [[hip[0] - 16, hip[1] + 6], [hip[0] - 10, hip[1] - 30], [sh[0] - 14, sh[1] - 8], [sh[0] + 12, sh[1] - 12], [sh[0] + 22, sh[1] + 10], [hip[0] + 22, hip[1] + 12], [hip[0], hip[1] + 14]],
    lin(c, hip[0] - 10, 0, sh[0] + 20, 0, [[0, XUAN.shirt], [0.7, XUAN.shirtL], [1, '#4a545c']]), INK);
  curve(c, [[hip[0] - 16, hip[1] - 2], [hip[0] - 12, hip[1] - 26], [sh[0] - 16, sh[1] - 6], [sh[0] + 4, sh[1] - 12]], RIM, 3, 0.8);
  // 前腿：大腿几乎平放在凳上，小腿垂下，皮鞋点地
  limb(c, hip[0], hip[1] + 6, x + 44, base - 52, 22, XUAN.pants, XUAN.pantsL, 0, -0.6); limb(c, x + 44, base - 52, x + 44, base - 8, 17, XUAN.pants, XUAN.pantsL, -0.4, 0);
  rr(c, x + 36, base - 10, 32, 11, 4, XUAN.shoe); rect(c, x + 36, base - 2, 32, 3, XUAN.sole); rr(c, x + 40, base - 9, 12, 4, 2, 'rgba(255,255,255,0.12)');
  // 头低着看手里的活儿；头发黑，额发一撇
  limb(c, sh[0] + 8, sh[1] - 6, hd[0] - 6, hd[1] + 8, 12, XUAN.skinD, null);
  head(c, hd[0], hd[1], 17, XUAN, 1);
  blob(c, [[hd[0] - 18, hd[1] + 2], [hd[0] - 16, hd[1] - 14], [hd[0], hd[1] - 20], [hd[0] + 16, hd[1] - 12], [hd[0] + 12, hd[1] - 2], [hd[0] + 2, hd[1] - 8], [hd[0] - 10, hd[1] - 4]],
    lin(c, hd[0] - 18, 0, hd[0] + 16, 0, [[0, XUAN.hair], [0.6, XUAN.hairL], [1, XUAN.hair]]));
  curve(c, [[hd[0] - 12, hd[1] - 12], [hd[0] - 18, hd[1] - 2], [hd[0] - 14, hd[1] + 10]], RIM, 2.5, 0.7);
  curve(c, [[hd[0] + 8, hd[1] - 10], [hd[0] + 16, hd[1] + 2], [hd[0] + 10, hd[1] + 14]], 'rgba(255,240,210,0.6)', 2, 0.8);
  // 前臂：搭在桌沿，手里捏着螺丝刀伸进收音机
  limb(c, sh[0] + 2, sh[1] + 6, x + 60, base - 90, 15, XUAN.shirt, XUAN.shirtL, -0.3, -0.5); limb(c, x + 60, base - 90, x + 102, base - 94, 13, XUAN.skin, '#f5dcc2', -0.2, -0.6);
  rr(c, x + 96, base - 100, 14, 12, 5, XUAN.skin); line(c, [[x + 108, base - 96], [x + 126, base - 104]], '#c9c1ae', 3); line(c, [[x + 106, base - 95], [x + 112, base - 98]], '#b6493f', 6);
  rr(c, x + 114, base - 96, 14, 12, 5, XUAN.skinD);
}

// 马哥：面朝火站着，手插兜，叼烟，重心落在近侧腿。手臂贴着躯干走，短袖只在肩头露一截
export function maStanding(c, x, base, tick) {
  const hd = [x, base - 176];
  soft(c, x + 4, base + 2, 42, 8, [6, 9, 13], 0.55);
  // 远侧腿与臂先画，被躯干压住
  limb(c, x + 14, base - 84, x + 18, base - 44, 22, MA.jeansD, null); limb(c, x + 18, base - 44, x + 20, base - 8, 19, MA.jeansD, null);
  rr(c, x + 8, base - 10, 34, 11, 5, '#c4c2bb'); rect(c, x + 8, base - 2, 34, 3, MA.sole);
  limb(c, x + 24, base - 142, x + 30, base - 110, 15, MA.skinD, null); limb(c, x + 30, base - 110, x + 20, base - 86, 13, MA.skinD, null);
  // 躯干：黑短袖，肩宽腰窄，右侧一道火的暖边
  blob(c, [[x - 30, base - 150], [x, base - 154], [x + 30, base - 150], [x + 28, base - 116], [x + 23, base - 82], [x - 23, base - 82], [x - 28, base - 116]],
    lin(c, x - 30, 0, x + 30, 0, [[0, MA.tee], [0.55, MA.teeL], [1, '#5a5148']]), INK);
  curve(c, [[x - 20, base - 100], [x, base - 108], [x + 20, base - 100]], '#161a1d', 2, 0.5);
  curve(c, [[x + 24, base - 148], [x + 30, base - 116], [x + 24, base - 84]], RIM, 3, 0.85);
  // 近侧腿：灰牛仔，膝盖一道折痕，白灰运动鞋
  limb(c, x - 12, base - 84, x - 14, base - 44, 25, MA.jeans, MA.jeansL, -0.4, 0); limb(c, x - 14, base - 44, x - 14, base - 8, 21, MA.jeans, MA.jeansL, -0.4, 0);
  curve(c, [[x - 24, base - 46], [x - 14, base - 40], [x - 4, base - 46]], MA.jeansD, 2, 0.6);
  rr(c, x - 30, base - 10, 38, 12, 5, lin(c, 0, base - 10, 0, base + 2, [[0, '#e6e4dd'], [1, MA.shoe]])); rect(c, x - 30, base - 2, 38, 3, MA.sole); line(c, [[x - 24, base - 6], [x, base - 6]], '#9aa0a2', 1.5, 0.8);
  curve(c, [[x + 8, base - 40], [x + 14, base - 24], [x + 14, base - 8]], RIM, 2.5, 0.6);
  // 近侧臂：肩头一截袖子，上臂露肤，前臂斜插进裤兜
  limb(c, x - 24, base - 144, x - 31, base - 112, 17, MA.skin, '#dba876', -0.5, -0.2); limb(c, x - 31, base - 112, x - 18, base - 84, 14, MA.skin, '#dba876', -0.5, -0.2);
  blob(c, [[x - 32, base - 152], [x - 14, base - 154], [x - 10, base - 134], [x - 22, base - 126], [x - 36, base - 132]], MA.tee, INK);
  curve(c, [[x - 24, base - 84], [x - 14, base - 78], [x - 2, base - 84]], MA.jeansD, 2.5, 0.8);
  // 头：短黑发，侧脸朝右，烟头一点橘红
  limb(c, x, base - 150, x + 2, base - 162, 13, MA.skinD, null);
  head(c, hd[0], hd[1], 18, MA, 1);
  blob(c, [[hd[0] - 19, hd[1] + 4], [hd[0] - 19, hd[1] - 12], [hd[0] - 6, hd[1] - 21], [hd[0] + 12, hd[1] - 18], [hd[0] + 18, hd[1] - 8], [hd[0] + 10, hd[1] - 9], [hd[0] - 4, hd[1] - 6]],
    lin(c, hd[0] - 19, 0, hd[0] + 18, 0, [[0, MA.hair], [0.6, MA.hairL], [1, MA.hair]]));
  curve(c, [[hd[0] + 10, hd[1] - 16], [hd[0] + 19, hd[1] - 2], [hd[0] + 14, hd[1] + 14]], RIM, 2.5, 0.8);
  line(c, [[hd[0] + 15, hd[1] + 8], [hd[0] + 30, hd[1] + 4]], '#e8e2d2', 2.5);
  const puff = 0.5 + Math.sin(tick / 12) * 0.5;
  c.save(); c.globalCompositeOperation = 'lighter'; soft(c, hd[0] + 31, hd[1] + 3, 5, 5, [255, 110, 40], 0.6 + puff * 0.4); c.restore();
  ell(c, hd[0] + 30, hd[1] + 4, 1.6, 1.6, '#ff9a4a');
  soft(c, hd[0] + 40 + puff * 6, hd[1] - 14 - puff * 10, 10 + puff * 6, 7, [150, 155, 158], 0.12);
}

// 头像：64×76 的矢量半身像，CSS 缩到 32×38 显示，边缘是抗锯齿而不是像素阶梯
export function bust(c, who, mood) {
  const p = who === 'xuan' ? XUAN : who === 'fan' ? { skin: '#d9a577', skinD: '#b98358', hair: '#d8b24a', hairL: '#ecd27a', top: '#c69a32', topL: '#e1b94e', under: '#467aa1' } : { ...MA, top: MA.tee, topL: MA.teeL };
  const top = p.top || p.shirt, topL = p.topL || p.shirtL;
  rect(c, 0, 0, 64, 76, '#17232a');
  blob(c, [[6, 76], [10, 54], [24, 46], [40, 46], [54, 54], [58, 76]], lin(c, 6, 0, 58, 0, [[0, top], [0.7, topL], [1, top]]));
  if (p.under) poly(c, [[26, 48], [38, 48], [32, 60]], p.under);
  rr(c, 28, 38, 8, 12, 3, p.skinD);
  ell(c, 32, 28, 13, 15, lin(c, 19, 0, 45, 0, [[0, p.skinD], [0.5, p.skin], [1, p.skin]]));
  blob(c, [[19, 30], [18, 16], [32, 10], [46, 16], [45, 30], [40, 20], [26, 20]], lin(c, 19, 0, 45, 0, [[0, p.hair], [0.6, p.hairL], [1, p.hair]]));
  if (who === 'fan') blob(c, [[20, 24], [24, 14], [36, 12], [44, 22], [38, 18], [30, 22]], p.hairL);
  const eyeY = mood === 'sad' ? 31 : 29;
  for (const ex of [26, 38]) { line(c, [[ex - 3, eyeY], [ex + 3, eyeY - (mood === 'sad' ? -1 : 0)]], '#2a2226', 2); }
  if (mood === 'hungry') line(c, [[28, 38], [36, 38]], '#8a5a4a', 1.5); else if (mood === 'sad') curve(c, [[28, 39], [32, 37], [36, 39]], '#8a5a4a', 1.5); else curve(c, [[28, 37], [32, 39], [36, 37]], '#8a5a4a', 1.5);
}

// 快捷栏图标 80×80 缩到 40×40：罐头、绷带
export function itemIcon(c, kind) {
  if (kind === 'can') {
    rr(c, 20, 14, 40, 52, 6, lin(c, 20, 0, 60, 0, [[0, '#6d7679'], [0.35, '#a7b0b2'], [0.7, '#8a9396'], [1, '#5c6467']]));
    rect(c, 20, 30, 40, 20, '#b6493f'); rect(c, 20, 36, 40, 6, '#e8dcc0');
    ell(c, 40, 15, 20, 5, '#c5ccce'); ell(c, 40, 15, 16, 3.5, '#8a9396');
  } else {
    rr(c, 16, 22, 48, 36, 12, lin(c, 0, 22, 0, 58, [[0, '#f0ece2'], [1, '#c2bcae']]));
    ell(c, 24, 40, 8, 16, '#d9d3c4'); ell(c, 24, 40, 4, 10, '#8f897b');
    rect(c, 34, 22, 30, 8, '#b9c9d0');
  }
}
