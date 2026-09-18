// 像素城市地图：街区、道路、店面热点按钮、三个小人的位置与行走动画。
import { px, sprite, skyline, moodOf } from './pixel.js';
import { streetSprite } from './street-people.js';
import { $, esc } from './core.js';
import { settledActionPoses, actionFrame, walkFrame, easedProgress, sceneTick, changedTurn } from './animation.js';
import { StreetJourney, neighbors, walkStep } from './street.js';
import { drawStreet, streetPose, STREET_NAMES } from './street-art.js';
import { CAMP_SPOTS, campSpotsFor, renderCampStreet } from './camp-art.js';
import { sleepSurfaceFor, furnitureRect } from '../game/furniture.js';
import { drawSleepers, drawFloorBubble } from './sleep-scene.js';
import { STREET_OBJECTS } from './street-props.js';
import { drawFurnitureOverview } from './furniture-store-art.js';

export const DISTRICT_POS = { recycle: [170, 122], service: [790, 122], camp: [150, 330], market: [480, 290], station: [800, 330], cinema: [480, 470], river: [352, 130], cafe: [270, 445], cardhall: [700, 475], furniture: [570, 122] };
const NEIGHBORS = neighbors;
export const SHOP_POS = { convenience: [548, 262], lottery_kiosk: [862, 296], recycle_shop: [176, 96], pharmacy: [736, 96], bathhouse: [846, 96], art_hardware: [396, 452], tavern: [746, 388], clinic: [792, 168], coffee_shop: [286, 421], furniture_store: [570, 94] };
const SPOT_POS = { breakfast: [416, 262], water: [724, 168], wall: [566, 452], cards: [726, 296], board: [206, 306], box: [96, 372], studio: [480, 522], fishing: [398, 156], cardhall: [700, 475] };
const OFFSET = { xuan: -34, fan: 0, ma: 34 };
const NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };

const M = { canvas: null, c: null, pos: {}, actions: {}, sleeping: [], anim: null, handlers: {}, tick: 0, raf: 0, state: null, selDistrict: null, mode: 'overview', streetDistrict: null, streetX: 480, streetDir: 0, streetSprint: false, streetMoveAt: 0, streetEdge: null, streetTravel: null, route: null, selectedActor: 'xuan', journey: null, shops: [], districts: [], events: [], nightDay: null, campHotspots: CAMP_SPOTS, actorPose: {} };
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initMap(handlers) {
  M.canvas = $('map');
  M.c = M.canvas.getContext('2d');
  M.c.imageSmoothingEnabled = false;
  M.handlers = handlers;
  M.journey = new StreetJourney(handlers);
  const street = $('street');
  M.streetC = street?.getContext('2d');
  if (M.streetC) M.streetC.imageSmoothingEnabled = false;
  $('overviewMode')?.addEventListener?.('click', () => setMapMode('overview'));
  $('streetMode')?.addEventListener?.('click', () => setMapMode('street'));
  $('streetDistrict')?.addEventListener?.('change', (e) => viewStreet(e.target.value));
  const walking = (direction) => (e) => { e.preventDefault(); setStreetDirection(direction, e.shiftKey); };
  for (const [id, direction] of [['walkLeft', -1], ['walkRight', 1]]) {
    const button = $(id);
    button?.addEventListener?.('pointerdown', walking(direction));
    button?.addEventListener?.('pointerup', stopStreetWalking);
    button?.addEventListener?.('pointercancel', stopStreetWalking);
    button?.addEventListener?.('pointerleave', stopStreetWalking);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', onStreetKey);
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') M.streetSprint = false; if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) stopStreetWalking(); });
    window.addEventListener('blur', stopStreetWalking);
  }
  if ($('streetControls')?.addEventListener) setMapMode('street');
  loop();
}

function onStreetKey(e) {
  if (!M.state || e.altKey || e.ctrlKey || e.metaKey || e.target?.closest?.('input,textarea,select,[contenteditable],.modal,.tut-root') || interactionBlocked()) return;
  if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setMapMode(M.mode === 'street' ? 'overview' : 'street'); return; }
  if (M.mode !== 'street' || e.repeat && M.streetDir) return;
  if (e.key === 'Shift') { M.streetSprint = true; return; }
  const direction = ['ArrowLeft', 'a', 'A'].includes(e.key) ? -1 : ['ArrowRight', 'd', 'D'].includes(e.key) ? 1 : 0;
  if (!direction) return;
  e.preventDefault(); setStreetDirection(direction, e.shiftKey);
}

function interactionBlocked() {
  return Boolean(document.querySelector?.('#modalOverlay.open,.tut-root,.intro,.fishing-qte-overlay,#plannerOverlay:not([hidden])'));
}

function setStreetDirection(direction, sprint = false) {
  M.streetDir = direction;
  M.streetSprint = sprint;
  M.streetMoveAt = performance.now();
}

function stopStreetWalking() {
  M.streetDir = 0;
  M.streetSprint = false;
  M.streetMoveAt = 0;
}

export function setMapMode(mode) {
  if (!['street', 'overview'].includes(mode)) return;
  M.mode = mode;
  stopStreetWalking();
  if (mode === 'overview') { if (M.route) M.route.cancelled = true; M.journey?.cancel(); $('streetTransition')?.classList?.remove('active'); }
  if (mode === 'street' && !M.streetDistrict) M.streetDistrict = M.state?.actors?.[M.selectedActor]?.location || 'camp';
  $('mapWrap')?.classList?.toggle('street-view', mode === 'street');
  if ($('streetControls')) $('streetControls').hidden = mode !== 'street';
  $('overviewMode')?.setAttribute?.('aria-pressed', String(mode === 'overview'));
  $('streetMode')?.setAttribute?.('aria-pressed', String(mode === 'street'));
  refreshStreetUI();
}

export function viewStreet(district) {
  if (!DISTRICT_POS[district]) return;
  if (M.nightDay !== null && district !== 'camp') return;
  M.streetDistrict = district;
  M.streetX = district === 'camp' ? 800 : 480;
  M.streetEdge = null;
  setMapMode('street');
  if (M.state) updateStreetOverlay(M.state, M.shops, M.events);
}

export function setNightExploration(day) {
  M.nightDay = day;
  if (day !== null) viewStreet('camp');
  $('mapWrap')?.classList?.toggle('night-exploration', day !== null);
  if ($('mapTitle')) $('mapTitle').textContent = day !== null ? `第${day}夜 · 旧桥营地` : `雾城 · ${M.districts.length}个街区`;
  if ($('overviewMode')) $('overviewMode').disabled = false;
  if ($('streetDistrict')) $('streetDistrict').disabled = day !== null;
  refreshStreetUI();
}

export function setCampHotspots(spots) {
  M.campHotspots = spots;
  if (M.state) updateStreetOverlay(M.state, M.shops, M.events);
}

export function setActorPose(actorId, pose) {
  if (!['xuan', 'fan', 'ma'].includes(actorId)) return;
  if (pose === 'sit') M.actorPose[actorId] = pose;
  else delete M.actorPose[actorId];
}

function refreshStreetUI() {
  if (!M.state || !M.streetDistrict) return;
  const actor = M.state.actors[M.selectedActor];
  const here = actor?.location === M.streetDistrict;
  const select = $('streetDistrict');
  if (select && select.value !== M.streetDistrict) select.value = M.streetDistrict;
  const status = $('streetStatus');
  if (status) status.textContent = M.nightDay !== null ? `第${M.nightDay}夜 · 营地散步 · 今夜不出街` : here ? `${STREET_NAMES[M.streetDistrict]} · ${NAMES[M.selectedActor]}在此 · 左右键或触屏行走` : `${STREET_NAMES[M.streetDistrict]} · 仅查看，${NAMES[M.selectedActor]}在${STREET_NAMES[actor?.location] || '别处'}`;
  const exits = $('streetExits');
  if (!exits) return;
  exits.replaceChildren();
  if (!here || !M.streetEdge) return;
  if (M.nightDay !== null) { exits.textContent = '夜里不能离开营地'; return; }
  for (const district of NEIGHBORS[M.streetDistrict] || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `从${M.streetEdge === 'left' ? '左' : '右'}路口前往${STREET_NAMES[district]} · 体力2`;
    button.onclick = async () => {
      await startRoute(district);
    };
    exits.append(button);
  }
}

async function showStreetTransition(district) {
  const el = $('streetTransition');
  if (!el) return;
  el.innerHTML = `<span>${esc(STREET_NAMES[district])}</span>`;
  announceStreetArrival(district);
  el.classList.add('active');
  await M.journey.transition(district, reducedMotion() || document.hidden);
  if (!M.journey.transitionName) el.classList.remove('active');
}

function announceStreetArrival(district) {
  const root = $('mapWrap');
  let announcer = root?.querySelector?.('.street-transition-announce');
  if (!announcer && root?.append) {
    announcer = document.createElement('span');
    announcer.className = 'sr-only street-transition-announce';
    announcer.setAttribute('aria-live', 'polite');
    root.append(announcer);
  }
  if (announcer) announcer.textContent = `到达${STREET_NAMES[district]}`;
}

export function routeFor(state, actorId, district) {
  const actor = state?.actors?.[actorId];
  if (!actor || actor.life !== 'active') return { error: '角色当前不能移动。' };
  if (state.pendingMorning || state.pending?.bins?.length || state.pending?.beg?.length || state.pending?.cards || state.pending?.casino || state.pending?.fishingQte?.length || state.pending?.riverFight || state.pending?.workGames?.length || state.phase && state.phase !== 'planning') return { error: '先处理当前待办互动。' };
  if (M.nightDay !== null) return { error: '夜里不能离开营地。' };
  if (!DISTRICT_POS[district]) return { error: '没有这条街。' };
  if (actor.location === district) return { steps: [], cost: 0 };
  const prev = { [actor.location]: null }, queue = [actor.location];
  while (queue.length) {
    const current = queue.shift();
    for (const next of NEIGHBORS[current] || []) {
      if (next in prev) continue;
      prev[next] = current;
      if (next === district) {
        const route = [district];
        for (let at = district; prev[at]; at = prev[at]) route.unshift(prev[at]);
        const steps = route.slice(1), cost = steps.length * 2;
        return actor.energy >= cost ? { steps, cost } : { error: `体力不足，前往${STREET_NAMES[district]}需要${cost}点体力。`, steps, cost };
      }
      queue.push(next);
    }
  }
  return { error: '这条路现在走不通。' };
}

async function startRoute(district) {
  const plan = routeFor(M.state, M.selectedActor, district);
  if (plan.error || M.route) return false;
  if (!plan.steps.length) return true;
  const route = { actorId: M.selectedActor, cancelled: false };
  M.route = route;
  try {
    for (const next of plan.steps) {
      if (route.cancelled || M.route !== route || M.selectedActor !== route.actorId) return false;
      const moved = await M.journey?.travel(next);
      if (!moved) return false;
      if (route.cancelled || M.route !== route || M.selectedActor !== route.actorId) return false;
      M.streetDistrict = next;
      M.streetX = next === 'camp' ? 800 : 480;
      M.streetEdge = null;
      setMapMode('street');
      updateStreetOverlay(M.state, M.shops, M.events);
      await showStreetTransition(next);
    }
    refreshStreetUI();
    return true;
  } finally {
    if (M.route === route) M.route = null;
  }
}

export async function travelFromOverview(district) {
  if (M.mode !== 'overview') return false;
  return startRoute(district);
}

function loop() {
  const now = performance.now(), reduced = reducedMotion();
  M.tick = sceneTick(now, reduced);
  if (M.state && M.mode === 'overview') render(M.state, now, reduced);
  if (M.mode === 'street' && M.state && M.streetC) {
    if (interactionBlocked()) stopStreetWalking();
    const streetState = streetRenderState();
    const here = streetState.actors[M.selectedActor]?.location === M.streetDistrict;
    if (here && M.streetDir && !M.journey?.transitionName) {
      const elapsed = Math.min(50, Math.max(0, now - (M.streetMoveAt || now)));
      M.streetMoveAt = now;
      const next = walkStep(M.streetX, M.streetDir, elapsed * 0.24 * (M.streetSprint ? 1.9 : 1), M.streetDistrict === 'camp' ? 1600 : 960, M.streetDistrict === 'camp' ? 116 : 80);
      M.streetX = next.x;
      if (M.streetDir) { delete M.actorPose[M.selectedActor]; delete M.actions[M.selectedActor]; }
      if (M.streetEdge !== next.edge) { M.streetEdge = next.edge; refreshStreetUI(); }
    }
    stepStreetTravel(now);
    if (M.streetDistrict === 'camp') {
      if (M.hotspotLayoutWidth !== $('street')?.clientWidth) layoutCampHotspots($('streetOverlay'));
      const camera = Math.max(0, Math.min(640, M.streetX - 480));
      M.streetC.setTransform(1, 0, 0, 1, 0, 0);
      M.streetC.clearRect(0, 0, 960, 540);
      M.streetC.save(); M.streetC.translate(-camera, 0);
      renderCampStreet(M.streetC, { state: streetState, tick: reduced ? 0 : M.tick, width: 1600, height: 540, night: M.nightDay !== null || streetState.slot === 3 });
      const poses = {};
      const sleepers = M.nightDay === null ? M.sleeping.filter((id) => streetState.actors[id]?.location === 'camp') : [];
      const surfaces = Object.fromEntries(sleepers.map((id) => [id, sleepSurfaceFor(streetState, id)]));
      drawSleepers(M.streetC, surfaces, { now, reduced });
      for (const [id, actor] of Object.entries(streetState.actors)) {
        if (actor.location !== 'camp' || !['active', 'downed'].includes(actor.life)) continue;
        if (surfaces[id]?.anchor) { poses[id] = 'sleep'; continue; }
        const selected = id === M.selectedActor;
        const personX = selected ? M.streetX : { xuan: 420, fan: 1060, ma: 1320 }[id];
        const pose = streetPose(actor, selected && Boolean(M.streetDir || M.streetTravel), M.actions[id], M.actorPose[id], now, reduced);
        poses[id] = pose;
        streetSprite(M.streetC, personX - 36, 322, id, 3, pose);
      }
      drawFloorBubble(M.streetC, surfaces, M.selectedActor);
      $('street').dataset.poses = JSON.stringify(poses);
      M.streetC.restore();
    } else $('street').dataset.poses = JSON.stringify(drawStreet(M.streetC, streetState, M.streetDistrict, M.selectedActor, M.streetX, here && (M.streetDir !== 0 || M.streetTravel) && !M.streetEdge, now, reduced, M.actions, M.actorPose));
    if (M.streetDistrict === 'camp') {
      const camera = Math.max(0, Math.min(640, M.streetX - 480));
      for (const button of $('streetOverlay')?.querySelectorAll('[data-world-x]') || []) {
        const x = Number(button.dataset.worldX) - camera;
        button.style.left = `${x / 960 * 100}%`;
        const inset = (button.offsetWidth || 100) / ($('street')?.clientWidth || 960) * 480 + 8;
        button.hidden = x < inset || x > 960 - inset;
      }
    }
  }
  M.raf = requestAnimationFrame(loop);
}

function anchor(id, actorId) {
  const [x, y] = DISTRICT_POS[id] || DISTRICT_POS.camp;
  return [x + OFFSET[actorId], y + 10];
}

function path(from, to) {
  if (from === to) return [to];
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const n of NEIGHBORS[cur]) if (!(n in prev)) { prev[n] = cur; if (n === to) { const out = [to]; let k = to; while (prev[k]) { k = prev[k]; out.unshift(k); } return out; } q.push(n); }
  }
  return [from, to];
}

function finishAnimation(anim, snap) {
  if (M.anim !== anim) return;
  clearTimeout(anim.timer);
  if (snap) for (const w of anim.walkers) M.pos[w.id] = w.points[w.points.length - 1];
  M.anim = null;
  anim.resolve();
}

function streetRenderState() {
  const travel = M.streetTravel;
  if (!travel || !M.state?.actors?.[travel.actorId]) return M.state;
  return { ...M.state, actors: { ...M.state.actors, [travel.actorId]: { ...M.state.actors[travel.actorId], location: travel.district } } };
}

function finishStreetTravel(travel, snap = false) {
  if (M.streetTravel !== travel) return;
  clearTimeout(travel.timer);
  if (snap) M.streetX = travel.toX;
  M.streetTravel = null;
  travel.resolve();
}

function walkStreetSegment(district, fromX, toX, duration = 500) {
  if (reducedMotion() || document.hidden) { M.streetX = toX; return Promise.resolve(); }
  if (M.streetTravel) finishStreetTravel(M.streetTravel, true);
  return new Promise((resolve) => {
    const travel = { actorId: M.selectedActor, district, fromX, toX, duration, start: performance.now(), resolve, timer: null };
    travel.timer = setTimeout(() => finishStreetTravel(travel, true), duration + 100);
    M.streetTravel = travel;
  });
}

function stepStreetTravel(now) {
  const travel = M.streetTravel;
  if (!travel) return;
  const progress = easedProgress(now, travel.start, travel.duration);
  M.streetX = travel.fromX + (travel.toX - travel.fromX) * progress;
  if (progress >= 1) finishStreetTravel(travel, true);
}

// 结算后的行走动画：每人沿道路走到新街区，返回 Promise。
export function animateMoves(state, moves, executed = {}) {
  if (M.anim) finishAnimation(M.anim, false);
  M.state = state;
  M.actions = settledActionPoses(state, executed);
  M.sleeping = Object.entries(executed).filter(([id, task]) => task?.id === 'sleep' && state.actors[id]?.location === 'camp').map(([id]) => id);
  for (const id of Object.keys(state.actors)) M.pos[id] = anchor(state.actors[id].location, id);
  const walkers = moves.filter((m) => m.from !== m.to && state.actors[m.actorId]?.life === 'active').map((m) => { const nodes = path(m.from, m.to); return { id: m.actorId, points: nodes.map((n) => anchor(n, m.actorId)), seg: 0, start: performance.now() }; });
  for (const w of walkers) M.pos[w.id] = w.points[0];
  if (M.mode === 'street') { for (const w of walkers) M.pos[w.id] = w.points[w.points.length - 1]; return afterScheduledMove(moves); }
  if (reducedMotion() || !walkers.length) { for (const w of walkers) M.pos[w.id] = w.points[w.points.length - 1]; return afterScheduledMove(moves); }
  const visual = new Promise((resolve) => {
    // 后台标签页 rAF 会停：按段数给一个保底超时，到时直接落位。
    const segs = Math.max(...walkers.map((w) => w.points.length - 1));
    const anim = { walkers, resolve, timer: null };
    anim.timer = setTimeout(() => finishAnimation(anim, true), segs * 850 + 800);
    M.anim = anim;
  });
  return M.mode === 'street' ? visual.then(() => afterScheduledMove(moves)) : visual;
}

async function afterScheduledMove(moves) {
  const selected = moves.find((move) => move.actorId === M.selectedActor && move.from !== move.to);
  if (!selected || M.mode !== 'street' || M.nightDay !== null) return;
  M.streetDistrict = selected.from;
  M.streetX = selected.from === 'camp' ? 800 : 480;
  M.streetEdge = null;
  updateStreetOverlay(M.state, M.shops, M.events);
  const left = DISTRICT_POS[selected.to][0] < DISTRICT_POS[selected.from][0];
  const exitX = left ? (selected.from === 'camp' ? 116 : 80) : (selected.from === 'camp' ? 1484 : 880);
  await walkStreetSegment(selected.from, M.streetX, exitX, 520);
  M.streetDistrict = selected.to;
  const entryX = left ? (selected.to === 'camp' ? 1400 : 820) : (selected.to === 'camp' ? 200 : 140);
  M.streetX = entryX;
  M.streetEdge = null;
  stopStreetWalking();
  updateStreetOverlay(M.state, M.shops, M.events);
  await showStreetTransition(selected.to);
  const workX = selected.to === 'camp' ? 800 : 480;
  await walkStreetSegment(selected.to, entryX, workX, 440);
  refreshStreetUI();
}

function stepAnim(now, reduced) {
  const a = M.anim;
  if (!a) return;
  if (reduced) { finishAnimation(a, true); return; }
  let alive = false;
  for (const w of a.walkers) {
    if (w.seg >= w.points.length - 1) continue;
    alive = true;
    const [x1, y1] = w.points[w.seg], [x2, y2] = w.points[w.seg + 1];
    const t = easedProgress(now, w.start, 680);
    if (t >= 1) { w.seg += 1; w.start = now; M.pos[w.id] = [x2, y2]; }
    else M.pos[w.id] = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  }
  if (!alive) finishAnimation(a, false);
}

function road(c, a, b) {
  const [x1, y1] = DISTRICT_POS[a], [x2, y2] = DISTRICT_POS[b];
  c.strokeStyle = '#4b5a60'; c.lineWidth = 26; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1 + 30); c.lineTo(x2, y2 + 30); c.stroke();
  c.strokeStyle = '#9aa3a0'; c.lineWidth = 2; c.setLineDash([10, 12]);
  c.beginPath(); c.moveTo(x1, y1 + 30); c.lineTo(x2, y2 + 30); c.stroke(); c.setLineDash([]);
}

function building(c, x, y, w, h, wall, roof, windows = true) {
  const night = M.state && M.state.slot === 3;
  px(c, x + 4, y + 4, w, h, '#0e161b');
  px(c, x, y, w, h, wall);
  px(c, x, y, w, 6, roof); px(c, x, y + 6, w, 1, 'rgba(0,0,0,0.25)');
  // 右侧暗面、门、窗框；夜里窗户更多亮起
  px(c, x + w - 5, y + 6, 5, h - 6, 'rgba(0,0,0,0.18)');
  px(c, x + w - 20, y + h - 16, 12, 16, '#2b333a'); px(c, x + w - 18, y + h - 14, 8, 12, '#3d4a54'); px(c, x + w - 12, y + h - 9, 1, 2, '#e7cf8d');
  if (windows) for (let wy = y + 12; wy < y + h - 8; wy += 12) for (let wx = x + 6; wx < x + w - 24; wx += 12) { const lit = (wx + wy) % 5 === 0 || (night && (wx * 3 + wy) % 4 === 0); px(c, wx - 1, wy - 1, 7, 8, '#2f3b42'); px(c, wx, wy, 5, 6, lit ? '#e7cf8d' : '#6f8a92'); if (!lit) px(c, wx, wy, 2, 3, '#88a0a7'); }
}

// 路灯：夜里亮，脚下一圈暖光。
function lamp(c, x, y) {
  const night = M.state && M.state.slot === 3;
  px(c, x, y - 34, 3, 34, '#4b565b'); px(c, x - 3, y - 38, 9, 5, '#6a7579'); px(c, x - 2, y - 34, 7, 2, night ? '#f0c96b' : '#b7b099');
  if (night) { c.fillStyle = 'rgba(240,201,107,0.14)'; c.beginPath(); c.moveTo(x - 2, y - 32); c.lineTo(x + 5, y - 32); c.lineTo(x + 18, y + 6); c.lineTo(x - 15, y + 6); c.closePath(); c.fill(); }
}

// 表情气泡：头顶一个小白框，里面 5×5 的记号；normal 不画。
function moodBubble(c, x, y, mood) {
  if (mood === 'normal') return;
  px(c, x, y, 11, 10, '#141a1f'); px(c, x + 1, y + 1, 9, 8, '#f2efe6'); px(c, x + 2, y + 10, 2, 2, '#f2efe6'); px(c, x + 1, y + 10, 4, 1, '#141a1f');
  const g = { happy: '#c9443a', sad: '#4a7fb5', tired: '#5a6a8c', sick: '#6aa85a', hurt: '#c9443a', hungry: '#d99a3a', cold: '#6fb4d6' }[mood];
  const bx = x + 3, by = y + 3;
  if (mood === 'happy') { px(c, bx, by, 1, 1, g); px(c, bx + 4, by, 1, 1, g); px(c, bx, by + 3, 5, 1, g); px(c, bx + 1, by + 4, 3, 1, g); }
  else if (mood === 'sad') { px(c, bx + 2, by, 1, 3, g); px(c, bx + 1, by + 3, 3, 2, g); }
  else if (mood === 'tired') { px(c, bx, by, 5, 1, g); px(c, bx + 3, by + 1, 1, 1, g); px(c, bx + 2, by + 2, 1, 1, g); px(c, bx + 1, by + 3, 1, 1, g); px(c, bx, by + 4, 5, 1, g); }
  else if (mood === 'sick') { px(c, bx + 1, by, 3, 1, g); px(c, bx, by + 1, 1, 3, g); px(c, bx + 2, by + 2, 2, 1, g); px(c, bx + 1, by + 4, 3, 1, g); px(c, bx + 4, by + 3, 1, 1, g); }
  else if (mood === 'hurt') { px(c, bx + 2, by, 1, 5, g); px(c, bx, by + 2, 5, 1, g); }
  else if (mood === 'hungry') { px(c, bx, by + 2, 5, 1, g); px(c, bx + 1, by + 3, 3, 2, g); px(c, bx + 1, by, 1, 2, '#e6dfcc'); px(c, bx + 3, by, 1, 2, '#e6dfcc'); }
  else if (mood === 'cold') { px(c, bx + 2, by, 1, 5, g); px(c, bx, by + 2, 5, 1, g); px(c, bx + 1, by + 1, 1, 1, g); px(c, bx + 3, by + 3, 1, 1, g); px(c, bx + 3, by + 1, 1, 1, g); px(c, bx + 1, by + 3, 1, 1, g); }
}

export function drawDistrict(c, id, state) {
  const [x, y] = DISTRICT_POS[id];
  const night = state.slot === 3;
  px(c, x - 110, y - 74, 220, 130, '#2b3a40');
  px(c, x - 106, y - 70, 212, 122, '#33454b');
  if (id === 'camp') {
    px(c, x - 100, y - 68, 200, 22, '#5c6d70'); for (let i = 0; i < 6; i++) px(c, x - 96 + i * 34, y - 60, 22, 60, '#54666a');
    px(c, x - 60, y - 20, 120, 40, state.camp.rain >= 2 ? '#b4a77b' : '#8e947d'); px(c, x - 62, y - 22, 4, 60, '#4f483f'); px(c, x + 58, y - 22, 4, 60, '#4f483f');
    const beds = (state.camp?.placements || []).filter((placement) => state.items?.some((item) => item.uid === placement.uid && item.container === 'camp' && ['bed_basic', 'bed_comfort', 'legacy_bed'].includes(item.itemId))).length;
    for (let i = 0; i < Math.min(3, beds); i++) { px(c, x - 48 + i * 36, y + 8, 30, 14, '#7e6b55'); px(c, x - 45 + i * 36, y + 9, 8, 5, '#d7cbb1'); }
    px(c, x + 40, y - 60, 26, 34, '#d7cbb1'); px(c, x + 44, y - 54, 18, 2, '#8a6b4a'); px(c, x + 44, y - 46, 12, 2, '#8a6b4a');
    px(c, x - 100, y + 26, 32, 20, '#6b5a3f');
    for (let i = 0; i < Math.min(state.art, 4); i++) px(c, x - 98 + i * 6, y - 40 + i * 4, 10, 4, ['#ddaa68', '#79b5aa', '#b18b91', '#d5c9a1'][i]);
  } else if (id === 'market') {
    building(c, x - 100, y - 66, 74, 60, '#957954', '#cc9b68');
    px(c, x - 96, y - 40, 66, 4, '#f0c65a'); px(c, x - 90, y - 30, 20, 18, '#2b3d43'); px(c, x - 60, y - 30, 24, 18, '#5db27a');
    building(c, x + 10, y - 66, 90, 60, '#697778', '#9d7055');
    px(c, x - 70, y - 20, 36, 8, '#b17d5d'); px(c, x - 66, y - 30, 4, 10, '#d1bc90'); px(c, x - 40, y - 30, 4, 10, '#d1bc90'); for (let i = 0; i < 3; i++) px(c, x - 62 + i * 8 + (M.tick % 6), y - 44 - ((M.tick + i * 5) % 12), 3, 3, '#dfe6e3');
    px(c, x - 100, y + 10, 200, 40, '#3e4c50');
  } else if (id === 'recycle') {
    building(c, x - 90, y - 66, 120, 58, '#667472', '#ab9b77', false); px(c, x - 80, y - 46, 100, 34, '#263b45'); for (let i = 0; i < 4; i++) px(c, x - 74 + i * 24, y - 40, 16, 22, '#6e817d');
    px(c, x + 40, y - 50, 60, 44, '#5a5f57'); for (let i = 0; i < 5; i++) px(c, x + 44 + i * 11, y - 44 + (i % 2) * 8, 9, 20, '#8a7157');
    px(c, x - 100, y + 10, 200, 40, '#3e4c50');
  } else if (id === 'station') {
    building(c, x - 100, y - 70, 130, 64, '#687d7f', '#91a09a'); px(c, x - 90, y - 44, 110, 10, '#d0c1a2'); px(c, x - 80, y - 30, 30, 20, '#2b3d43'); px(c, x - 40, y - 30, 30, 20, '#2b3d43');
    building(c, x + 44, y - 60, 52, 54, '#8c3b34', '#c0392b', false); px(c, x + 50, y - 50, 40, 12, '#f2d16b'); px(c, x + 54, y - 34, 32, 18, '#2b3d43');
    px(c, x - 90, y + 26, 80, 10, '#8b7257'); px(c, x - 60, y + 36, 8, 8, '#d8c9a3'); px(c, x - 40, y + 36, 8, 8, '#d8c9a3');
    px(c, x - 100, y + 10, 200, 40, '#3e4c50');
  } else if (id === 'cinema') {
    building(c, x - 100, y - 70, 160, 62, '#786c64', '#b99964'); px(c, x - 60, y - 60, 90, 16, '#d8b96a'); px(c, x - 50, y - 36, 30, 26, '#182c39'); px(c, x - 10, y - 36, 30, 26, '#182c39');
    px(c, x + 66, y - 66, 34, 58, '#5c5148'); px(c, x + 70, y - 56, 26, 40, '#e6d7b3'); px(c, x + 74, y - 50, 8, 8, '#c0392b'); px(c, x + 86, y - 40, 6, 12, '#71bfc3');
    px(c, x - 100, y + 10, 200, 40, '#3e4c50');
  } else if (id === 'cafe') {
    px(c, x - 86, y - 62, 172, 57, '#382e2b');
    px(c, x - 84, y - 59, 168, 52, '#8a5c3b');
    px(c, x - 88, y - 64, 176, 8, '#bd8b56');
    px(c, x - 85, y - 52, 170, 5, '#dbab6b');
    px(c, x - 43, y - 51, 86, 18, '#332f2c');
    px(c, x - 8, y - 48, 16, 9, '#e3bb72');
    px(c, x + 7, y - 46, 5, 5, '#e3bb72');
    px(c, x - 7, y - 51, 2, 3, '#d9c9ae'); px(c, x, y - 53, 2, 4, '#d9c9ae');
    px(c, x - 74, y - 30, 87, 25, '#40342d');
    px(c, x - 71, y - 27, 81, 19, night ? '#f2cf87' : '#d3b483');
    px(c, x - 33, y - 27, 3, 19, '#71513b');
    px(c, x - 66, y - 17, 71, 5, '#68472f');
    px(c, x - 60, y - 23, 13, 6, '#d5c29b'); px(c, x - 47, y - 21, 4, 3, '#d5c29b');
    px(c, x - 16, y - 24, 11, 11, '#6d9165'); px(c, x - 12, y - 13, 6, 5, '#805b3a');
    px(c, x + 20, y - 31, 31, 27, '#3c3531');
    px(c, x + 23, y - 28, 25, 22, night ? '#f2cf87' : '#9fb4ae');
    px(c, x + 34, y - 28, 3, 22, '#d1a373'); px(c, x + 43, y - 17, 3, 3, '#e3bb72');
    px(c, x + 59, y - 28, 16, 22, '#604431');
    px(c, x + 62, y - 24, 10, 17, '#a6b5a8');
    px(c, x - 90, y + 10, 180, 40, '#3e4c50');
  } else if (id === 'service') {
    building(c, x - 100, y - 70, 200, 64, '#8c9b96', '#476c74'); for (let i = 0; i < 6; i++) px(c, x - 86 + i * 32, y - 60, 16, 5, '#d3d7bb');
    px(c, x - 90, y - 40, 40, 28, '#f3f3f0'); px(c, x - 78, y - 32, 16, 4, '#c0392b'); px(c, x - 72, y - 38, 4, 16, '#c0392b');
    px(c, x + 20, y - 40, 60, 28, '#a4c2b3'); px(c, x - 30, y - 40, 40, 28, '#344e5a'); px(c, x - 24, y - 34, 28, 16, '#c8b684');
    px(c, x - 100, y + 10, 200, 40, '#3e4c50');
  } else if (id === 'river') {
    px(c, x - 106, y - 64, 212, 52, '#547b82');
    for (let i = 0; i < 6; i++) px(c, x - 98 + i * 36, y - 48 + i % 3 * 8, 24, 2, '#92b0ae');
    px(c, x - 106, y - 8, 212, 12, '#8d9a80');
    for (let i = 0; i < 5; i++) { px(c, x - 90 + i * 44, y - 28, 4, 34, '#40585c'); px(c, x - 92 + i * 44, y - 28, 42, 4, '#6d8583'); }
    px(c, x - 102, y + 10, 204, 40, '#4a5b57');
    px(c, x + 48, y + 12, 34, 10, '#7b6b51');
  } else if (id === 'furniture') {
    drawFurnitureOverview(c, x, y, night);
  } else if (id === 'cardhall') {
    building(c, x - 92, y - 65, 184, 60, '#695e57', '#a78258', false);
    px(c, x - 81, y - 52, 162, 13, '#213d3c'); px(c, x - 73, y - 49, 146, 2, '#d8b96a');
    px(c, x - 70, y - 33, 48, 25, '#244c45'); px(c, x - 65, y - 28, 38, 15, '#267056');
    px(c, x - 15, y - 35, 30, 30, '#182a2b'); px(c, x - 11, y - 32, 22, 25, '#43645e'); px(c, x + 8, y - 21, 2, 3, '#e3bb72');
    px(c, x + 28, y - 33, 46, 25, '#244c45'); px(c, x + 33, y - 28, 36, 15, '#267056');
    px(c, x - 100, y + 10, 200, 40, '#3e4c50');
  }
  // 招牌下的小灯、路灯；雨天地面有反光条
  const wet = ['rain', 'storm'].includes(state.weatherKind);
  if (wet) for (let i = 0; i < 5; i++) px(c, x - 90 + i * 40 + (M.tick % 4), y + 14 + i * 6, 26, 1, 'rgba(180,200,210,0.22)');
  if (id !== 'camp') { lamp(c, x - 104, y + 40); lamp(c, x + 100, y + 40); }
  if (night) { c.fillStyle = 'rgba(12,29,47,0.28)'; c.fillRect(x - 110, y - 74, 220, 130); px(c, x - 60, y - 70, 3, 3, '#f0c96b'); px(c, x + 60, y - 70, 3, 3, '#f0c96b'); }
}

function render(state, now, reduced) {
  const c = M.c;
  const poses = {};
  c.setTransform(1, 0, 0, 1, 0, 0);
  const wx = state.weatherKind;
  px(c, 0, 0, 960, 540, wx === 'coldwave' || wx === 'cold' ? '#26343a' : '#2e3f46');
  skyline(c, 960, 130, state.slot === 3 ? 0.4 : 1);
  px(c, 0, 118, 960, 422, '#2e3f46');
  for (const a of Object.keys(NEIGHBORS)) for (const b of NEIGHBORS[a]) if (a < b) road(c, a, b);
  for (const id of Object.keys(DISTRICT_POS)) drawDistrict(c, id, state);
  stepAnim(now, reduced);
  for (const id of ['xuan', 'fan', 'ma']) {
    const p = state.actors[id];
    if (p.life === 'unrecruited' || p.life === 'dead') continue;
    if (!M.pos[id] || !M.anim) M.pos[id] = M.anim ? M.pos[id] : anchor(p.location, id);
    const [x, y] = M.pos[id];
    const walking = M.anim && M.anim.walkers.some((w) => w.id === id && w.seg < w.points.length - 1);
    const idle = !reduced && Math.floor(now / 7800 + ['xuan', 'fan', 'ma'].indexOf(id) * 2) % 3 === 0 && now % 7800 < 480 ? 'idle1' : 'stand';
    const pose = walking ? walkFrame(now) : p.life === 'downed' ? 'sit' : M.actions[id] ? actionFrame(M.actions[id], now, reduced) : idle;
    poses[id] = pose;
    // 小人 24×38，按 1.5 倍画：脚底落在原来的地面线上，名字仍居中。
    sprite(c, x - 14, y - 35, id, 1.5, pose);
    if (!walking && p.life === 'active') moodBubble(c, x + 18, y - 52, moodOf(p));
    c.fillStyle = p.life === 'downed' ? '#e57e6b' : '#e6dfcc'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
    c.fillText(NAMES[id] + (p.life === 'downed' ? ' 濒死' : ''), x + 4, y - 30);
  }
  if (wx === 'rain' || wx === 'storm') for (let i = 0; i < 90; i++) { const x = (i * 53 + M.tick * 3) % 960, y = (i * 37 + M.tick * 11) % 540; px(c, x, y, 1, 9, '#9ab1ad'); }
  if (wx === 'coldwave') for (let i = 0; i < 80; i++) { const x = (i * 47 + M.tick) % 960, y = (i * 31 + M.tick * 2) % 540; px(c, x, y, 2, 2, '#e8eef0'); }
  if (state.slot === 3) { c.fillStyle = 'rgba(8,20,34,0.25)'; c.fillRect(0, 0, 960, 540); }
  M.canvas.dataset.poses = JSON.stringify(poses);
}

export function setMapState(state, executed) {
  if (changedTurn(M.state, state)) {
    if (M.anim) finishAnimation(M.anim, false);
    if (!executed) { M.actions = {}; M.sleeping = []; }
  }
  M.state = state;
  M.journey?.setState(state, M.selectedActor);
  if (executed) { M.actions = settledActionPoses(state, executed); M.sleeping = Object.entries(executed).filter(([id, task]) => task?.id === 'sleep' && state.actors[id]?.location === 'camp').map(([id]) => id); }
  for (const id of Object.keys(state.actors)) if (!M.anim) M.pos[id] = anchor(state.actors[id].location, id);
}

// 覆盖层按钮：街区、店铺、热点事件。真实按钮，键盘可达。
export function updateOverlay(state, sel, shopsMeta, districtsMeta, events) {
  const selectionChanged = M.lastSelectedActor !== sel.actor;
  if (M.route && M.route.actorId !== sel.actor) M.route.cancelled = true;
  M.selectedActor = sel.actor;
  M.lastSelectedActor = sel.actor;
  M.journey?.setState(state, sel.actor);
  M.shops = shopsMeta; M.districts = districtsMeta; M.events = events;
  if (selectionChanged || !M.streetDistrict) { M.streetDistrict = M.nightDay !== null ? 'camp' : state.actors[sel.actor]?.location || 'camp'; M.streetX = M.streetDistrict === 'camp' ? 800 : 480; M.streetEdge = null; }
  const streetSelect = $('streetDistrict');
  if (streetSelect) streetSelect.innerHTML = districtsMeta.map((d) => `<option value="${d.id}" ${d.id === M.streetDistrict ? 'selected' : ''}>${esc(d.name)} · 查看</option>`).join('');
  const ov = $('mapOverlay');
  const pct = (x, y) => `left:${(x / 960 * 100).toFixed(2)}%;top:${(y / 540 * 100).toFixed(2)}%`;
  let html = '';
  const actor = state.actors[sel.actor];
  for (const d of districtsMeta) {
    const [x, y] = DISTRICT_POS[d.id];
    const route = routeFor(state, sel.actor, d.id);
    const current = actor?.location === d.id;
    const disabled = Boolean(route.error || current || M.route);
    const reason = current ? '已在这里' : M.route ? '正在前往其他街区' : route.error || '';
    const label = current ? '已在此' : route.error ? '不能前往' : `前往 · ${route.steps.length}街 · 体力${route.cost}`;
    html += `<button class="hot district ${sel.zone === d.id ? 'selected-district' : ''}" style="${pct(x, y + 58)}" data-district="${d.id}">${esc(d.name)}</button><button class="hot travel-district" style="${pct(x, y + 84)}" data-travel-district="${d.id}" ${disabled ? 'disabled' : ''} title="${esc(reason)}" aria-label="${esc(`${d.name}：${reason || label}`)}">${esc(label)}</button>`;
  }
  for (const [id, person] of Object.entries(state.actors)) {
    if (person.life === 'dead' || person.life === 'unrecruited') continue;
    const [x, y] = anchor(person.location, id);
    html += `<button class="hot actor-marker" style="${pct(x + 4, y - 30)};--actor-color:${id === 'xuan' ? '#6fa9cf' : id === 'fan' ? '#bd715f' : '#6fa876'}" data-actor-select="${id}" aria-label="选择${NAMES[id]}，现在在${esc(STREET_NAMES[person.location])}">${esc(NAMES[id])}</button>`;
  }
  for (const s of shopsMeta) {
    const [x, y] = SHOP_POS[s.id];
    if (state.day < s.unlockDay) continue;
    const closed = s.closed;
    html += `<button class="hot shop" style="${pct(x, y)}" data-shop="${s.id}" title="${esc(closed || '营业中')}">${esc(s.name)}${closed ? '·关' : ''}</button>`;
  }
  const spots = [['breakfast', '阿梅早餐摊', 'market'], ['water', '公共水点', 'service'], ['wall', '许可涂鸦墙', 'cinema'], ['board', '愿望板', 'camp'], ['box', '物资箱', 'camp'], ['studio', '许姐工作间', 'cinema'], ['fishing', '河岸钓位', 'river'], ['cardhall', '入馆选桌 · 1小时 · 未下注', 'cardhall']];
  for (const [k, name, d] of spots) { const [x, y] = SPOT_POS[k]; html += `<button class="hot spot" style="${pct(x, y)}" data-spot="${k}" data-district="${d}">${esc(name)}</button>`; }
  for (const ev of events) {
    const [x, y] = DISTRICT_POS[ev.district];
    html += `<button class="hot event" style="${pct(x - 60 + (ev.i % 2) * 120, y - 92)}" data-event="${ev.uid}">${esc(ev.title)} · 剩${ev.left}回合</button>`;
  }
  ov.innerHTML = html;
  ov.querySelectorAll('[data-district]:not([data-spot])').forEach((b) => { b.onclick = () => M.handlers.onDistrict(b.dataset.district); });
  ov.querySelectorAll('[data-travel-district]').forEach((b) => { b.onclick = () => travelFromOverview(b.dataset.travelDistrict); });
  ov.querySelectorAll('[data-actor-select]').forEach((b) => { b.onclick = () => M.handlers.onActorSelect?.(b.dataset.actorSelect); });
  ov.querySelectorAll('[data-shop]').forEach((b) => { b.onclick = () => M.handlers.onShop(b.dataset.shop); });
  ov.querySelectorAll('[data-spot]').forEach((b) => { b.onclick = () => M.handlers.onSpot(b.dataset.spot, b.dataset.district); });
  ov.querySelectorAll('[data-event]').forEach((b) => { b.onclick = () => M.handlers.onEvent(b.dataset.event); });
  updateStreetOverlay(state, shopsMeta, events);
  refreshStreetUI();
}

function updateStreetOverlay(state, shopsMeta, events) {
  const root = $('streetOverlay');
  if (!root) return;
  const district = M.streetDistrict;
  const shops = shopsMeta.filter((shop) => shop.district === district && state.day >= shop.unlockDay);
  const spots = [['breakfast', '阿梅早餐摊', 'market'], ['water', '公共水点', 'service'], ['wall', '许可涂鸦墙', 'cinema'], ['board', '愿望板', 'camp'], ['box', '物资箱', 'camp'], ['studio', '许姐工作间', 'cinema'], ['fishing', '河岸钓位', 'river'], ['cardhall', '入馆选桌 · 1小时 · 未下注', 'cardhall']];
  const furnitureNames = { dining_table: '餐桌·整理', chair: '椅子·整理', sofa: '沙发·整理', cabinet: '柜子·整理', lamp: '营灯·整理', rug: '地毯·整理' };
  const furnitureSpots = (state.camp?.placements || []).map((placement) => {
    const item = state.items?.find((entry) => entry.uid === placement.uid && entry.container === 'camp');
    const rect = item && furnitureRect(item.itemId, placement.slot, placement.rotation);
    if (!rect || ['bed_basic', 'bed_comfort', 'legacy_bed'].includes(item.itemId)) return null;
    return { id: item.itemId === 'dining_table' ? 'table' : 'furniture', name: furnitureNames[item.itemId] || '家具·整理', x: rect.x + rect.w / 2, y: rect.y + rect.h, row: 'upper' };
  }).filter(Boolean);
  const campSpots = district === 'camp' ? [...campSpotsFor(state), { id: 'parcel', name: '家具包裹', x: 650, y: 410 }, ...furnitureSpots].filter((spot) => spot.id !== 'tv' || state.items.some((item) => item.itemId === 'tv' && (item.container === 'camp' || item.kept))) : [];
  const shopX = { convenience: 162, recycle_shop: 209, lottery_kiosk: 809, tavern: 483, pharmacy: 364, clinic: 600, bathhouse: 830, art_hardware: 829, coffee_shop: 576, furniture_store: 480 };
  const objects = (STREET_OBJECTS[district] || []).filter((object) => object.id !== 'bins' || ['market', 'station', 'recycle'].includes(district));
  root.innerHTML = `${shops.map((shop, i) => `<button class="street-hot" style="left:${((shopX[shop.id] ?? 160 + i * 280) / 960 * 100).toFixed(1)}%" data-shop="${shop.id}">${esc(shop.name)}${shop.closed ? ' · 关' : ''}</button>`).join('')}${district === 'camp' ? campSpots.map((spot) => `<button class="street-hot spot" data-world-x="${Number(spot.x)}" data-row="${spot.row === 'upper' ? 1 : 0}" data-spot="${esc(spot.id)}">${esc(spot.name)}</button>`).join('') : spots.filter((spot) => spot[2] === district).map((spot, i) => `<button class="street-hot spot" style="left:${54 + i * 18}%" data-spot="${spot[0]}">${esc(spot[1])}</button>`).join('')}${objects.filter((object) => district !== 'camp').map((object) => `<button class="street-hot spot" style="left:${(object.x / 960 * 100).toFixed(1)}%;top:${object.id === 'bins' ? 61 : object.id === 'passersby' ? 78 : 90}%" data-spot="${object.id}" data-object-x="${object.x}">${esc(object.name)}</button>`).join('')}${events.filter((event, i) => event.district === district).map((event, i) => `<button class="street-hot event" style="left:${20 + i * 25}%;top:9%" data-event="${event.uid}">${esc(event.title)}</button>`).join('')}`;
  if (district === 'camp') layoutCampHotspots(root);
  root.querySelectorAll('[data-shop]').forEach((button) => { button.onclick = () => M.handlers.onShop(button.dataset.shop); });
  root.querySelectorAll('[data-spot]').forEach((button) => { button.onclick = async () => {
    const id = button.dataset.spot;
    const actorId = M.selectedActor;
    if (district === 'camp' && ['bed', 'table', 'furniture', 'parcel', 'storage'].includes(id) && state.actors[actorId]?.location === 'camp') {
      if (M.streetTravel || interactionBlocked()) return;
      const destination = Math.max(116, Math.min(1484, Number(button.dataset.worldX)));
      await walkStreetSegment('camp', M.streetX, destination, Math.min(850, Math.max(180, Math.abs(destination - M.streetX) * 1.2)));
      if (M.selectedActor !== actorId || M.streetDistrict !== district) return;
    }
    M.handlers.onSpot(id, district);
  }; });
  root.querySelectorAll('[data-event]').forEach((button) => { button.onclick = () => M.handlers.onEvent(button.dataset.event); });
}

function layoutCampHotspots(root) {
  const width = $('street')?.clientWidth || 960;
  const placed = [];
  for (const button of root?.querySelectorAll('[data-world-x]') || []) {
    const x = Number(button.dataset.worldX) / 960 * width;
    const w = button.offsetWidth || 100;
    let row = Number(button.dataset.row) || 0;
    while (placed.some((other) => other.row === row && Math.abs(other.x - x) < (other.w + w) / 2 + 6)) row++;
    button.style.top = `calc(85% - ${row * 58}px)`;
    placed.push({ x, w, row });
  }
  M.hotspotLayoutWidth = width;
}

export function showWalkNote(text) {
  let el = $('mapWrap').querySelector('.walk-note');
  if (!text) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'walk-note'; $('mapWrap').appendChild(el); }
  el.textContent = text;
}
