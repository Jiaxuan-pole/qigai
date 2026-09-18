import { px, skyline } from './pixel.js';
import { streetSprite } from './street-people.js';
import { actionFrame, walkFrame } from './animation.js';
import { passersby } from '../game/npcs.js';
import { drawDistrictStorefronts } from './storefront-art.js';
import { drawStreetObjects } from './street-props.js';
import { drawStreetNpc } from './npc-art.js';
import { drawCafeScene } from './coffee-art.js';
import { drawCardhallScene } from './cardhall-art.js';
import { drawFurnitureStoreScene } from './furniture-store-art.js';

export const STREET_NAMES = {
  camp: '旧桥营地', market: '老街早夜市', recycle: '电子回收巷',
  station: '站前街', cinema: '旧影院与广场', service: '公共服务站街区', river: '河岸步道', cafe: '街角咖啡店', cardhall: '棋牌馆', furniture: '家具城',
};

const SCENES = {
  camp: { sky: '#30454b', wall: '#647477', roof: '#46575b', awning: '#a49a7d', name: '旧桥下' },
  market: { sky: '#40504d', wall: '#a48a65', roof: '#69534a', awning: '#ce9b64', name: '老街集市' },
  recycle: { sky: '#36474a', wall: '#637674', roof: '#4f5f61', awning: '#90977e', name: '回收工坊' },
  station: { sky: '#3e5258', wall: '#87958c', roof: '#626d69', awning: '#bd8b5b', name: '站前候车' },
  cinema: { sky: '#4b4550', wall: '#86756d', roof: '#665760', awning: '#c6a768', name: '旧影院' },
  service: { sky: '#3b5154', wall: '#869e9b', roof: '#4b6971', awning: '#9eae9e', name: '公共服务' },
  river: { sky: '#3a555d', wall: '#5e7776', roof: '#455d5d', awning: '#9caa84', name: '河堤' },
};

function lamp(c, x, night) {
  px(c, x, 316, 6, 130, '#283b40');
  px(c, x - 8, 310, 22, 9, '#596d6c');
  px(c, x - 5, 319, 16, 7, night ? '#e3bb72' : '#a8aaa1');
  if (night) { c.fillStyle = 'rgba(227,187,114,.12)'; c.beginPath(); c.moveTo(x - 5, 326); c.lineTo(x + 11, 326); c.lineTo(x + 67, 472); c.lineTo(x - 63, 472); c.fill(); }
}

function prop(c, x, kind, tick) {
  if (kind === 'crate') { px(c, x, 397, 46, 34, '#705d49'); px(c, x + 4, 401, 38, 26, '#9b7a55'); px(c, x + 7, 405, 32, 3, '#c0a071'); }
  if (kind === 'bin') { px(c, x, 401, 34, 39, '#364d52'); px(c, x - 3, 396, 40, 7, '#607574'); px(c, x + 9, 409, 16, 4, '#a7b1b3'); }
  if (kind === 'bench') { px(c, x, 392, 80, 10, '#957755'); px(c, x + 4, 402, 72, 8, '#b18d61'); px(c, x + 12, 410, 5, 22, '#4b5b5d'); px(c, x + 64, 410, 5, 22, '#4b5b5d'); }
  if (kind === 'reeds') for (let i = 0; i < 8; i++) { const rx = x + i * 8; px(c, rx, 389 - i % 3 * 6, 2, 38, '#6d8364'); px(c, rx - 2, 386 - i % 3 * 6, 5, 8, '#a8a171'); }
  if (kind === 'puddle') { px(c, x, 457, 70, 5, '#567c86'); px(c, x + 12 + tick % 6, 458, 24, 1, '#a1b9b6'); }
}

function river(c, tick) {
  px(c, 0, 250, 960, 112, '#587c83');
  px(c, 0, 229, 960, 18, '#31474b');
  for (let i = 0; i < 13; i++) { px(c, i * 77, 230, 5, 29, '#3c5559'); px(c, i * 77 + 10, 240, 45, 3, '#4d6263'); }
  for (let i = 0; i < 18; i++) px(c, i * 61 - tick % 61, 272 + i % 5 * 13, 31, 2, '#87aaa8');
  px(c, 0, 360, 960, 30, '#687d72');
  px(c, 0, 389, 960, 12, '#a9aa86');
  for (let i = 0; i < 10; i++) { px(c, i * 106, 335, 8, 55, '#5e7371'); px(c, i * 106, 338, 106, 5, '#819793'); }
  for (let i = 0; i < 4; i++) { px(c, 110 + i * 235, 294, 6, 54, '#30454b'); px(c, 100 + i * 235, 291, 26, 5, '#d3c49f'); }
  prop(c, 40, 'reeds', tick); prop(c, 852, 'reeds', tick);
  px(c, 432, 323, 150, 11, '#584c3f'); px(c, 438, 326, 138, 5, '#a08a62');
  for (let i = 0; i < 8; i++) px(c, 443 + i * 17, 326, 2, 8, '#584c3f');
  px(c, 450, 333, 7, 46, '#5f5547'); px(c, 559, 333, 7, 46, '#5f5547');
  px(c, 445, 355, 20, 3, '#a8a071'); px(c, 556, 354, 16, 3, '#a8a071');
  px(c, 457, 315, 2, 15, '#bec7b1'); px(c, 459, 313, 38, 2, '#bec7b1');
  px(c, 495, 315 + tick % 3, 2, 24, '#b7c7c5');
}

export function streetPose(actor, moving, action, override, now, reduced) {
  if (actor?.life === 'downed') return 'sit';
  if (moving) return walkFrame(now, reduced);
  if (override) return override;
  if (action) return actionFrame(action, now, reduced);
  return !reduced && now % 7800 < 480 ? 'idle1' : 'stand';
}

export function drawStreet(c, state, district, actorId, x, moving, now, reduced, actions = {}, overrides = {}) {
  const scene = SCENES[district] || SCENES.camp;
  const night = state.slot === 3;
  const wet = ['rain', 'storm'].includes(state.weatherKind);
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (district === 'cafe') {
    drawCafeScene(c, { night, weatherKind: state.weatherKind, tick: reduced ? 0 : Math.floor(now / 300) });
  } else if (district === 'cardhall') {
    drawCardhallScene(c, { night, weatherKind: state.weatherKind, tick: reduced ? 0 : Math.floor(now / 300) });
  } else if (district === 'furniture') {
    drawFurnitureStoreScene(c, { night, weatherKind: state.weatherKind, tick: reduced ? 0 : Math.floor(now / 300) });
  } else {
  px(c, 0, 0, 960, 540, scene.sky);
  skyline(c, 960, 210, night ? 0.35 : 1);
  px(c, 0, 175, 960, 130, '#33484d');
  if (district === 'river') river(c, reduced ? 0 : Math.floor(now / 180));
  else drawDistrictStorefronts(c, district, night, reduced ? 0 : Math.floor(now / 300));
  px(c, 0, 395, 960, 47, '#6a7774');
  px(c, 0, 435, 960, 11, '#a4a693');
  px(c, 0, 446, 960, 94, '#3b4c51');
  for (let i = 0; i < 8; i++) px(c, 30 + i * 130, 503, 67, 3, '#97a19b');
  lamp(c, 105, night); lamp(c, 825, night);
  if (district === 'market') prop(c, 250, 'crate', 0);
  if (district === 'service' || district === 'cinema') prop(c, 688, 'bench', 0);
  if (district === 'river') prop(c, 688, 'reeds', 0);
  if (wet) { prop(c, 178, 'puddle', reduced ? 0 : Math.floor(now / 220)); prop(c, 770, 'puddle', reduced ? 0 : Math.floor(now / 220)); }
  if (district === 'river') {
    px(c, 530, 375, 430, 38, '#587c83'); px(c, 530, 375, 430, 5, '#a9aa86');
    for (let i = 0; i < 8; i++) px(c, 540 + i * 51, 388 + i % 2 * 12, 25, 2, '#87aaa8');
    px(c, 420, 404, 112, 11, '#7b6b51'); px(c, 432, 415, 8, 26, '#594f43'); px(c, 513, 415, 8, 26, '#594f43');
  }
  drawStreetObjects(c, district, wet, reduced ? 0 : Math.floor(now / 220));
  if (state.seed !== undefined && state.daily?.begged && state.relations) {
    const people = passersby(state, district, state.slot);
    for (let i = 0; i < people.length; i++) drawStreetNpc(c, people[i], [115, 815, 572, 367, 905, 70][i], 383 + (i % 2) * 3, reduced ? 0 : Math.floor(now / 350));
  } else {
    drawStreetNpc(c, { id: 'cleaner', job: '保洁阿姨' }, 115, 383);
    drawStreetNpc(c, { id: 'rider', job: '外卖骑手' }, 815, 383);
  }
  }
  const poses = {};
  for (const [id, actor] of Object.entries(state.actors)) {
    if (actor.location !== district || !['active', 'downed'].includes(actor.life)) continue;
    const selected = id === actorId;
    const personX = selected ? x : id === 'xuan' ? 316 : id === 'fan' ? 605 : 775;
    const pose = streetPose(actor, selected && moving, actions[id], overrides[id], now, reduced);
    poses[id] = pose;
    streetSprite(c, personX - 24, district === 'river' && pose.startsWith('fish') ? 335 : 351, id, 2, pose);
    c.fillStyle = '#e6dfcc'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
    c.fillText({ xuan: '轩哥', fan: '凡哥', ma: '马哥' }[id], personX, 347);
  }
  if (district !== 'cafe' && wet) for (let i = 0; i < 48; i++) px(c, (i * 79 + (reduced ? 0 : Math.floor(now / 35))) % 960, (i * 41 + (reduced ? 0 : Math.floor(now / 24))) % 540, 2, 9, '#91aab2');
  if (district !== 'cafe' && night) { c.fillStyle = 'rgba(8,20,34,.20)'; c.fillRect(0, 0, 960, 540); }
  return poses;
}
