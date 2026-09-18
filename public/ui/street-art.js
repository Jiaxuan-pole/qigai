import { px, skyline } from './pixel.js';
import { streetSprite } from './street-people.js';
import { actionFrame, walkFrame } from './animation.js';
import { passersby } from '../game/npcs.js';
import { drawDistrictStorefronts } from './storefront-art.js';
import { drawStreetObjects } from './street-props.js';
import { drawConflictNpc, drawStreetNpc } from './npc-art.js';
import { drawCafeScene } from './coffee-art.js';
import { drawCardhallScene } from './cardhall-art.js';
import { drawFurnitureStoreScene } from './furniture-store-art.js';
import { fishingPosition } from './street.js';

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

const RESIDENTS = {
  market: [['clerk', 204, 324], ['vendor', 592, 323]],
  recycle: [['worker', 212, 329], ['clerk', 736, 330]],
  station: [['clerk', 282, 329], ['vendor', 621, 331]],
  cinema: [['student', 439, 329], ['clerk', 877, 330]],
  service: [['volunteer', 168, 328], ['clerk', 660, 330]],
  river: [['student', 258, 338], ['elder', 906, 338]],
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
}

export function streetPose(actor, moving, action, override, now, reduced) {
  if (actor?.life === 'downed') return 'sit';
  if (moving) return walkFrame(now, reduced);
  if (override) return override;
  if (action) return actionFrame(action, now, reduced);
  return !reduced && now % 7800 < 480 ? 'idle1' : 'stand';
}

export function drawStreet(c, state, district, actorId, x, moving, now, reduced, actions = {}, overrides = {}, positions = {}) {
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
    for (const id of ['xuan', 'fan', 'ma']) {
      const { x, y } = fishingPosition(id);
      px(c, x - 34, y - 16, 68, 52, '#584c3f');
      px(c, x - 31, y - 13, 62, 46, '#9d835c');
      for (let row = 0; row < 6; row++) px(c, x - 31, y - 12 + row * 8, 62, 2, '#705b42');
      px(c, x - 28, y + 36, 7, 12, '#594f43'); px(c, x + 21, y + 36, 7, 12, '#594f43');
      px(c, x - 22, y - 20, 44, 5, '#c0a071');
    }
  }
  for (const [i, [kind, residentX, residentY]] of (RESIDENTS[district] || []).entries()) {
    drawStreetNpc(c, { kind }, residentX, residentY, reduced ? 0 : Math.floor(now / 700), { pose: 'stand', facing: i ? -1 : 1, scale: 1 });
  }
  drawStreetObjects(c, district, wet, reduced ? 0 : Math.floor(now / 220));
  const people = state.seed !== undefined && state.daily?.begged && state.relations
    ? passersby(state, district, state.slot)
    : [{ id: 'cleaner', job: '保洁阿姨' }, { id: 'rider', job: '外卖骑手' }, { id: 'commuter', job: '上班族' }, { id: 'elder', job: '退休大爷' }];
  for (let i = 0; i < people.length; i++) {
    const phase = reduced ? 0 : (now / 90 + i * 21) % 72;
    const direction = phase < 36 ? 1 : -1;
    const offset = reduced ? 0 : (phase < 36 ? phase : 72 - phase) - 18;
    drawStreetNpc(c, people[i], [145, 800, 550, 350, 888, 65][i] + offset, 359 + i % 2 * 8, reduced ? 0 : Math.floor(now / 250) + i, { facing: direction, scale: 1.2 });
  }
  }
  if (!['camp', 'cafe', 'cardhall', 'furniture'].includes(district)) {
    px(c, 63, 299, 84, 82, '#141a1f'); px(c, 67, 303, 76, 74, '#705d49');
    px(c, 73, 310, 30, 43, '#d7cbb1'); px(c, 108, 317, 28, 48, '#e6dfcc');
    for (let i = 0; i < 4; i++) { px(c, 77, 318 + i * 7, 21, 2, '#5a4633'); px(c, 113, 325 + i * 7, 18, 2, '#5a4633'); }
    px(c, 72, 381, 6, 32, '#5a4633'); px(c, 132, 381, 6, 32, '#5a4633');
  }
  const streetEvents = (state.events || []).filter(event => event.district === district && ['open', 'reserved', 'combat'].includes(event.status));
  for (const [i, event] of streetEvents.entries()) {
    if (!['street_thugs', 'chengguan_sweep'].includes(event.templateId)) continue;
    const x = 190 + i % 3 * 270, y = 420 + i % 3 * 32 - 64;
    const kind = event.templateId === 'street_thugs' ? 'thug' : 'chengguan';
    drawConflictNpc(c, x - 39, y, kind, 'stand', 0, 1, 1.2);
    drawConflictNpc(c, x + 13, y + 3, kind === 'thug' ? 'thug_hood' : kind, 'stand', 0, -1, 1.2);
  }
  const poses = {};
  for (const [id, actor] of Object.entries(state.actors).sort(([a], [b]) => (positions[a]?.y || 427) - (positions[b]?.y || 427))) {
    if (actor.location !== district || !['active', 'downed'].includes(actor.life)) continue;
    const selected = id === actorId;
    const pose = streetPose(actor, selected && moving, actions[id], overrides[id], now, reduced);
    const position = district === 'river' && pose.startsWith('fish') ? fishingPosition(id) : positions[id];
    const personX = position?.x ?? (selected ? x : id === 'xuan' ? 316 : id === 'fan' ? 605 : 775);
    poses[id] = pose;
    const personY = position ? position.y - 76 : district === 'river' && pose.startsWith('fish') ? 335 : 351;
    streetSprite(c, personX - 24, personY, id, 2, pose, position?.facing ?? 1);
    c.fillStyle = '#e6dfcc'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
    c.fillText({ xuan: '轩哥', fan: '凡哥', ma: '马哥' }[id], personX, personY - 4);
  }
  if (district !== 'cafe' && wet) for (let i = 0; i < 48; i++) px(c, (i * 79 + (reduced ? 0 : Math.floor(now / 35))) % 960, (i * 41 + (reduced ? 0 : Math.floor(now / 24))) % 540, 2, 9, '#91aab2');
  if (district !== 'cafe' && night) { c.fillStyle = 'rgba(8,20,34,.20)'; c.fillRect(0, 0, 960, 540); }
  return poses;
}
