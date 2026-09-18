import { px } from './pixel.js';
import { sleepingStreetSprite } from './street-people.js';
import { renderCampStreet } from './camp-art.js';
import { drawFloorSheet } from './furniture-art.js';

const IDS = ['xuan', 'fan', 'ma'];
const NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };
const FLOOR_LINES = {
  xuan: '这地板，比我上份工作还硬。',
  fan: '睡个觉，拍出了苦情片的质感。',
  ma: '这地凉得，翻个身都得咬牙。',
};
const captionFor = (surfaces, id) => !id ? '' : surfaces[id]?.kind === 'floor'
  ? `${NAMES[id]}：${FLOOR_LINES[id]}` : `${NAMES[id]}睡在床上。`;

export function sleepSceneDisplayState(state, surfaces) {
  const settledBeds = Object.values(surfaces || {}).filter(surface => surface?.kind === 'bed' && surface.uid && surface.slot);
  if (!settledBeds.length) return state;
  const bedUids = new Set(settledBeds.map(surface => surface.uid));
  const placements = (state.camp?.placements || []).filter(placement => !bedUids.has(placement.uid));
  for (const surface of settledBeds) {
    const current = state.camp?.placements?.find(placement => placement.uid === surface.uid);
    placements.push({ uid: surface.uid, slot: surface.slot, rotation: current?.rotation ?? 0 });
  }
  const items = state.items?.map(item => bedUids.has(item.uid) ? { ...item, container: 'camp' } : item);
  return { ...state, camp: { ...state.camp, placements }, items };
}

export function drawSleepers(c, surfaces, { now = 0, reduced = false } = {}) {
  const drawn = [];
  for (const id of IDS) {
    const surface = surfaces?.[id];
    if (!surface?.anchor || !['bed', 'floor'].includes(surface.kind)) continue;
    const { x, y } = surface.anchor;
    const breath = reduced ? 0 : Math.floor(now / 900) % 2;
    sleepingStreetSprite(c, x + 2, y - 20, id, breath);
    drawn.push(id);
  }
  return drawn;
}

export function drawFloorBubble(c, surfaces, actorId, { width = 1600, height = 540 } = {}) {
  const surface = surfaces?.[actorId];
  const text = FLOOR_LINES[actorId];
  if (surface?.kind !== 'floor' || !surface.anchor || !text) return null;
  const w = 445, h = 62;
  const x = Math.max(8, Math.min(width - w - 8, surface.anchor.x - 20));
  const y = Math.max(8, Math.min(height - h - 8, surface.anchor.y - 94));
  px(c, x, y, w, h, '#141a1f');
  px(c, x + 3, y + 3, w - 6, h - 6, '#f0e5c9');
  px(c, Math.max(x + 12, Math.min(x + w - 22, surface.anchor.x + 12)), y + h, 14, 9, '#141a1f');
  c.fillStyle = '#252b2e';
  c.font = 'bold 22px sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(`${NAMES[actorId]}：${text}`, x + 15, y + 31);
  return { actorId, text, x, y, width: w, height: h };
}

export function createSleepSequence(surfaces, selectedId, audio = globalThis.window?.jwsnAudio) {
  const present = IDS.filter(id => ['floor', 'bed'].includes(surfaces?.[id]?.kind) && surfaces[id].anchor);
  const spoken = new Set();
  let current = present.includes(selectedId) ? selectedId : present[0] || null;
  return {
    get current() { return current; },
    get actors() { return present; },
    show(id) {
      if (!present.includes(id)) return false;
      current = id;
      if (surfaces[id].kind === 'floor' && !spoken.has(id)) {
        spoken.add(id);
        audio?.speak?.(id, FLOOR_LINES[id]);
      }
      return true;
    },
  };
}

export function showSleepScene({ state, night, selectedId, mount = document.body } = {}) {
  const surfaces = night?.sleepSurfaces || {};
  const audio = globalThis.window?.jwsnAudio;
  const sequence = createSleepSequence(surfaces, selectedId, audio);
  const shade = document.createElement('section');
  shade.className = 'sleep-scene';
  shade.setAttribute('aria-label', '今夜睡眠镜头');
  shade.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#10191de8;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box';
  const panel = document.createElement('div');
  panel.style.cssText = 'width:min(100%,1400px);background:#1b282d;border:3px solid #b7a67c;padding:10px;box-sizing:border-box;color:#f0e5c9';
  const title = document.createElement('h2');
  title.textContent = `第${night.day}夜 · 睡下了`;
  title.style.cssText = 'margin:0 0 8px;font-size:20px';
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 540;
  canvas.style.cssText = 'display:block;width:100%;height:auto;image-rendering:pixelated';
  const caption = document.createElement('p');
  caption.setAttribute('role', 'status');
  caption.style.cssText = 'margin:10px 0 0;font-size:16px;line-height:1.5;color:#f0e5c9';
  caption.textContent = captionFor(surfaces, sequence.current);
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
  for (const id of sequence.actors) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = NAMES[id]; button.dataset.actor = id;
    button.addEventListener('click', () => {
      if (!sequence.show(id)) return;
      caption.textContent = captionFor(surfaces, id);
      if (reduced) paint();
    });
    controls.append(button);
  }
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = '继续';
  next.style.marginLeft = 'auto';
  controls.append(next);
  panel.append(title, canvas, caption, controls);
  shade.append(panel);
  mount.append(shade);
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const displayState = sleepSceneDisplayState(state, surfaces);
  let frame = 0;
  let active = true;
  function paint() {
    if (!active) return;
    c.clearRect(0, 0, 1600, 540);
    renderCampStreet(c, { state: displayState, night: true, tick: 0, width: 1600, height: 540 });
    for (const id of sequence.actors) if (surfaces[id].kind === 'floor') {
      const { x, y } = surfaces[id].anchor;
      drawFloorSheet(c, x - 45, y - 12, id);
    }
    drawSleepers(c, surfaces, { now: performance.now(), reduced });
    drawFloorBubble(c, surfaces, sequence.current);
    for (const button of controls.querySelectorAll('[data-actor]')) button.setAttribute('aria-pressed', String(button.dataset.actor === sequence.current));
    if (!reduced) frame = requestAnimationFrame(paint);
  }
  sequence.show(sequence.current);
  for (const id of sequence.actors) audio?.play?.(surfaces[id].kind === 'floor' ? 'sleep_ground' : 'sleep_bed', { scope: 'sleep-scene' });
  paint();
  return new Promise((resolve) => next.addEventListener('click', () => {
    active = false;
    if (frame) cancelAnimationFrame(frame);
    audio?.cancelScope?.('sleep-scene');
    audio?.stopSpeech?.();
    shade.remove();
    resolve();
  }, { once: true }));
}
