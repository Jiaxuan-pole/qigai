import { px } from './pixel.js';

import { fuelCount } from '../game/camp.js';
import { furnitureRect, isFurniture, sleepSurfaceFor } from '../game/furniture.js';
import { drawFloorSheet, drawFurnitureSprite, drawParcel } from './furniture-art.js';

export const CAMP_SPOTS = [
  { id: 'bed', name: '地铺 · 睡觉', x: 340, y: 410 },
  { id: 'storage', name: '物资箱', x: 570, y: 410 },
  { id: 'fire', name: '油桶篝火', x: 800, y: 410 },
  { id: 'tv', name: '旧电视', x: 1120, y: 410 },
  { id: 'workbench', name: '修理位', x: 1390, y: 410 },
];

export function campSpotsFor(state) {
  const bed = ['xuan', 'fan', 'ma'].map((id) => sleepSurfaceFor(state, id)).find((surface) => surface?.kind === 'bed');
  return CAMP_SPOTS.map((spot) => spot.id === 'bed' && bed?.anchor
    ? { ...spot, name: '床铺 · 睡觉', x: bed.anchor.x + 60, y: bed.anchor.y + 45 }
    : { ...spot });
}

const COL = {
  out: '#141a1f', concrete: '#59666a', concreteLight: '#748080', steel: '#33434a',
  board: '#9f8661', boardLight: '#c7ad7c', box: '#876a48', paper: '#d7cbb1',
};

function line(c, x, y, w, color) { px(c, x, y, w, 2, color); }

function skyline(c, w, night) {
  px(c, 0, 0, w, 350, night ? '#213540' : '#809095');
  px(c, 0, 110, w, 210, night ? '#304651' : '#a1aaa3');
  for (let i = 0; i < 25; i++) {
    const x = i * 71 - 24, top = 135 + (i * 37 % 45), h = 220 - top;
    px(c, x, top, 55 + (i % 4) * 8, h, night ? '#344850' : '#7d8f91');
    for (let yy = top + 13; yy < 290; yy += 18) for (let xx = x + 8; xx < x + 53; xx += 13)
      if ((xx + yy + i) % 3) px(c, xx, yy, 4, 7, night ? '#8d8770' : '#b5bbb3');
  }
  px(c, 0, 300, w, 50, night ? '#334b52' : '#79959a');
  for (let x = 0; x < w; x += 39) line(c, x, 318 + x % 9, 13, night ? '#668389' : '#a8bdba');
}

function bridge(c, w, h) {
  px(c, 0, 0, w, 79, '#26343b');
  px(c, 0, 68, w, 12, '#121f27');
  for (let x = 0; x < w; x += 78) { px(c, x, 14, 7, 53, '#3b4c53'); px(c, x + 7, 56, 54, 5, '#34474e'); }
  px(c, 0, 235, w, 5, '#718080');
  px(c, 0, 240, w, 206, '#425052');
  px(c, 0, 240, w, 4, '#5b6968');
  px(c, 0, 309, w, 2, '#536061');
  px(c, 0, 380, w, 2, '#52605e');
  for (let x = 0; x < w; x += 156) {
    px(c, x + 41, 269, 2, 40, '#3a484a');
    px(c, x + 116, 312, 2, 68, '#3a484a');
    line(c, x + 24, 291, 17, '#647170');
    line(c, x + 88, 354, 23, '#62706d');
    line(c, x + 35, 431, 19, '#566360');
  }
  for (const x of [34, 1510]) {
    px(c, x, 75, 74, h - 145, COL.out);
    px(c, x + 5, 79, 64, h - 156, COL.concrete);
    px(c, x + 12, 85, 7, h - 175, COL.concreteLight);
    for (let y = 102; y < h - 75; y += 44) line(c, x + 22, y, 38, '#647073');
  }
  px(c, 0, 446, w, h - 446, '#414c4c');
  px(c, 0, 446, w, 8, '#596662');
  for (let x = 0; x < w; x += 104) { line(c, x + 5, 482 + x % 9, 52, '#66706a'); px(c, x + 67, 511, 18, 2, '#2b3838'); }
}

function canopy(c, rain, tick) {
  const raised = rain >= 2;
  px(c, 150, 176, 578, 10, COL.out);
  for (let x = 158; x < 718; x += 30) {
    const y = 163 + (x % 5);
    px(c, x, y, 32, 19, raised ? '#a49770' : '#718077');
    line(c, x + 3, y + 3, 25, raised ? '#c0b389' : '#8d9c8e');
  }
  px(c, 170, 183, 7, 226, '#544b3d'); px(c, 696, 183, 7, 226, '#544b3d');
  if (rain >= 3) {
    px(c, 154, 183, 563, 7, '#b7a980');
    for (let x = 205; x < 700; x += 95) px(c, x, 189, 3, 25, '#c6b894');
  }
  if (rain < 3) for (let x = 232; x < 675; x += 110) px(c, x, 177 + ((tick + x) % 3), 2, 13, '#a9c2c2');
}

function campFurniture(state) {
  const seen = new Set();
  const sealed = new Set((state.camp?.parcels ?? []).filter((parcel) => parcel.status === 'sealed').flatMap((parcel) => parcel.itemUids ?? []));
  return (state.camp?.placements ?? []).flatMap((placement) => {
    const item = state.items?.find((candidate) => candidate.uid === placement.uid);
    const rect = furnitureRect(item?.itemId, placement.slot, placement.rotation);
    if (!item || item.container !== 'camp' || sealed.has(item.uid) || seen.has(item.uid) || !isFurniture(item.itemId) || !rect) return [];
    seen.add(item.uid);
    return [{ ...rect, itemId: item.itemId, rotation: placement.rotation }];
  }).sort((a, b) => a.y + a.h - b.y - b.h);
}

function floorSheets(c, state) {
  const actors = ['xuan', 'fan', 'ma'].filter((id) => state.actors?.[id]?.life === 'active');
  if (!actors.length) {
    for (let i = 0; i < (state.camp?.floorSheets ?? 2); i++) drawFloorSheet(c, 185 + i * 150, 390, ['xuan', 'fan', 'ma'][i]);
    return;
  }
  for (const who of actors) {
    const surface = sleepSurfaceFor(state, who);
    if (surface?.kind === 'floor' && surface.anchor) drawFloorSheet(c, surface.anchor.x - 45, surface.anchor.y - 12, who);
  }
}

function parcels(c, state) {
  const sealed = (state.camp?.parcels ?? []).filter((parcel) => parcel.status === 'sealed' &&
    parcel.itemUids?.some((uid) => state.items?.some((item) => item.uid === uid && item.container === 'parcel:' + parcel.id)));
  if (sealed.length) drawParcel(c, 650, 380, sealed.length);
}

function storage(c) {
  for (const [x, y, w, h] of [[530, 331, 85, 46], [588, 348, 60, 29], [637, 360, 56, 28]]) {
    px(c, x, y, w, h, COL.out); px(c, x + 3, y + 4, w - 6, h - 7, COL.box);
    line(c, x + 2, y + 11, w - 4, '#b19060'); px(c, x + Math.floor(w / 2), y + 3, 5, h - 5, '#695334');
  }
  px(c, 556, 322, 30, 12, '#566573'); px(c, 560, 323, 22, 3, '#9ca8a9');
  px(c, 633, 352, 28, 9, COL.paper);
}

function supplies(c) {
  px(c, 1018, 410, 35, 14, COL.out); px(c, 1021, 412, 29, 10, '#655749');
  px(c, 1056, 414, 22, 9, '#74624e'); px(c, 1062, 406, 8, 8, '#677073');
  px(c, 1024, 408, 22, 3, COL.boardLight);
}

function fire(c, lit, tick) {
  px(c, 757, 370, 86, 12, '#20282a');
  px(c, 765, 370, 70, 49, COL.out); px(c, 769, 375, 62, 41, '#574c41');
  line(c, 770, 383, 61, '#73614c'); line(c, 770, 405, 61, '#3a322c');
  px(c, 782, 389, 15, 16, '#303030'); px(c, 793, 394, 16, 10, '#323334');
  if (!lit) { px(c, 774, 365, 52, 5, '#596063'); return; }
  const sway = Math.floor(tick / 5) % 3;
  c.fillStyle = 'rgba(240,165,78,0.13)'; c.fillRect(700, 302, 200, 140);
  px(c, 783, 355 - sway, 38, 19 + sway, '#dc733b');
  px(c, 790, 345 + sway, 22, 21, '#efac58');
  px(c, 797, 339 - sway, 9, 18, '#f7da91');
  for (let i = 0; i < 5; i++) px(c, 787 + ((i * 13 + tick) % 35), 333 - ((tick * 2 + i * 9) % 24), 3, 3, '#f2bd70');
}

function artWall(c, count) {
  px(c, 1180, 205, 220, 5, '#596762');
  for (let i = 0; i < Math.min(count, 7); i++) {
    const x = 1193 + (i % 4) * 50, y = 218 + Math.floor(i / 4) * 45;
    px(c, x, y, 42, 34, '#293239'); px(c, x + 3, y + 3, 36, 28, '#d7c6a2');
    px(c, x + 7, y + 13, 12, 11, ['#9d6a52', '#607e83', '#92935b'][i % 3]);
    px(c, x + 20, y + 8, 12, 17, ['#637585', '#b58563', '#677e69'][i % 3]);
  }
}

function tv(c, present, night, tick) {
  px(c, 1084, 388, 91, 34, COL.box); line(c, 1090, 393, 75, COL.boardLight);
  if (!present) { px(c, 1109, 382, 44, 5, '#4c5051'); return; }
  px(c, 1095, 337, 70, 51, COL.out); px(c, 1100, 342, 60, 37, '#4d5553');
  px(c, 1104, 346, 51, 29, night ? '#749197' : '#56666c');
  for (let y = 349; y < 373; y += 5) line(c, 1106, y + (tick % 2), 46, night ? '#aac5c6' : '#72878c');
  px(c, 1112, 380, 39, 5, '#2f3331'); px(c, 1147, 381, 4, 4, '#e3bb72');
  px(c, 1129, 328, 2, 9, '#353f41'); px(c, 1133, 326, 17, 2, '#353f41');
}

function workbench(c, installed) {
  px(c, 1332, 381, 120, 10, installed ? '#ad9169' : '#655b4b');
  px(c, 1342, 391, 6, 37, '#514636'); px(c, 1436, 391, 6, 37, '#514636');
  if (!installed) { px(c, 1360, 372, 60, 5, '#625d51'); return; }
  px(c, 1345, 367, 46, 12, '#5b6870'); px(c, 1349, 369, 36, 3, '#9aa7a8');
  px(c, 1404, 361, 13, 19, '#8d9b9b'); px(c, 1411, 356, 4, 8, '#aeb5ae');
  px(c, 1422, 374, 19, 5, '#4b5559');
}

function laundry(c, installed, tick) {
  px(c, 936, 227, 2, 105, '#716955'); px(c, 1460, 227, 2, 145, '#716955');
  line(c, 938, 234, 523, '#b0a088');
  if (!installed) return;
  for (let i = 0; i < 5; i++) {
    const x = 955 + i * 92, sway = tick ? Math.floor(tick / 30 + i) % 2 : 0;
    px(c, x, 235, 4, 7, '#bdad86');
    px(c, x - 5 + sway, 242, 44, 37, ['#8d9b96', '#aa8e76', '#697c88'][i % 3]);
    px(c, x + 5, 270, 28, 3, '#5d6d70');
  }
}

function cat(c, tick) {
  px(c, 705, 417, 43, 11, '#b27843'); px(c, 736, 408, 14, 14, '#c18a4f');
  px(c, 738, 403 - (Math.floor(tick / 35) % 2), 5, 7, '#b27843'); px(c, 746, 403, 5, 7, '#b27843');
  px(c, 744, 413, 2, 2, '#202629'); px(c, 696, 421, 14, 4, '#a2693c');
}

export function renderCampStreet(c, { state = {}, tick = 0, width = 1600, height = 540, night = false } = {}) {
  const rain = state.camp?.rain ?? 1;
  const art = state.art ?? 0;
  const facilities = state.camp?.facilities ?? [];
  const hasTv = state.items?.some((item) => item.itemId === 'tv') || state.flags?.screeningVenueUnlocked;
  const fuel = fuelCount(state);
  const frame = tick || 0;
  const furniture = campFurniture(state);
  c.save();
  skyline(c, width, night);
  bridge(c, width, height);
  canopy(c, rain, frame);
  floorSheets(c, state);
  storage(c);
  supplies(c);
  parcels(c, state);
  for (const item of furniture) drawFurnitureSprite(c, item.itemId, item.x, item.y, item.rotation, { night });
  artWall(c, art);
  laundry(c, facilities.includes('drying_rack'), frame);
  tv(c, hasTv, night, frame);
  workbench(c, facilities.includes('repair_table'));
  fire(c, fuel > 0, frame);
  cat(c, frame);
  if (night) {
    c.fillStyle = 'rgba(10,25,40,0.22)'; c.fillRect(0, 0, width, height);
    px(c, 119, 198, 10, 8, '#e3bb72'); px(c, 120, 206, 8, 4, '#ae965c');
    c.fillStyle = 'rgba(227,187,114,0.08)'; c.fillRect(110, 200, 90, 174);
  }
  c.restore();
}
