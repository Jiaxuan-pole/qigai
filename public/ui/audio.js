// 声音层：有素材文件就放文件，没有就用 WebAudio 现场合成；首次点击后才建 AudioContext（浏览器自动播放限制）。
// 纯逻辑（档位、名字表、来源选择、场景推断）不碰 window，方便 node 测试。

import { speechPlan } from './dialogue-audio.js';

export const VOLUME_STEPS = ['off', 'low', 'mid', 'high'];
export const VOLUME_GAIN = { off: 0, low: 0.35, mid: 0.65, high: 1 };
export const VOLUME_LABEL = { off: '声音：关', low: '声音：低', mid: '声音：中', high: '声音：高' };
const BUS_GAIN = { bgm: 0.5, ambient: 0.6, sfx: 0.8 };
const STORAGE_KEY = 'jwsn.volume';
const BASE = '/audio/';

// 名字 → 文件；null 表示只有合成版本。
export const FILES = {
  bgm: { title: 'a-kind-of-hope.m4a', day: 'lofi-again.ogg', camp: 'a-small-fire-will-do.m4a' },
  ambient: { fire: 'fireplace-loop.m4a', rain: 'rain-short.ogg', wind: 'wind-whoosh-loop.ogg', radio: 'radio-static.mp3', street: null, tv: null },
  sfx: {
    click: 'ui-click.ogg', confirm: 'ui-confirm.ogg', back: 'ui-back.ogg', open: 'ui-open.ogg', close: 'ui-close.ogg',
    card_flip: 'card-flip.ogg', shuffle: 'card-shuffle.ogg', chips: 'chips.ogg', chip_lay: 'chip-lay.ogg', coin: 'coins.ogg',
    footstep: 'footstep.ogg', cloth: 'cloth.ogg', radio: 'radio-static.mp3', wheel: null, tv_on: null,
    fish_bite: 'fish-bite.ogg', reel: 'reel.ogg', fish_catch: 'fish-catch.ogg', fish_escape: 'fish-escape.ogg', splash: null, swim: null,
    coffee_sip: 'coffee-sip.ogg', cook_sizzle: null, charcoal_ignite: null, meal: 'meal.ogg',
    work_sort: 'work-sort.ogg', work_rotate: 'work-rotate.ogg', work_camera: 'work-camera.ogg', work_cut: 'work-cut.ogg', work_handoff: 'work-handoff.ogg', work_success: 'work-success.ogg', work_miss: 'work-miss.ogg', cups_shuffle: 'cups-shuffle.ogg',
    parcel_arrive: 'parcel-arrive.ogg', parcel_open: 'parcel-open.ogg', furniture_place: 'furniture-place.ogg', furniture_move: 'furniture-move.ogg', sleep_ground: 'sleep-ground.ogg', sleep_bed: 'sleep-bed.ogg',
  },
};
// 能合成的名字（文件缺失或格式不支持时兜底）。
export const SYNTH = new Set(['fire', 'rain', 'wind', 'street', 'tv', 'radio', 'click', 'confirm', 'back', 'open', 'close', 'card_flip', 'shuffle', 'chips', 'chip_lay', 'coin', 'footstep', 'cloth', 'wheel', 'tv_on', 'splash', 'swim', 'cook_sizzle', 'charcoal_ignite']);

export function nextVolume(v) {
  const i = VOLUME_STEPS.indexOf(v);
  // 未知值当作默认档「低」。
  return i < 0 ? 'low' : VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length];
}

export function extOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file || '');
  return m ? m[1].toLowerCase() : '';
}

// 决定一个名字怎么出声：文件可播就放文件，否则能合成就合成，都不行返回 null。
export function resolveSource(kind, name, opts = {}) {
  const files = opts.files || FILES;
  const canPlay = opts.canPlay || (() => true);
  const file = files[kind]?.[name];
  if (file && canPlay(extOf(file))) return { file: BASE + file };
  if (SYNTH.has(name)) return { synth: name };
  return null;
}

// 从游戏状态推断该放什么：白天按天气，夜里按过夜地点，放映用电视嗡声。
export function sceneFor(state, stage = 'day', night = null) {
  if (stage === 'title') return { bgm: 'title', ambient: null };
  if (stage === 'screening') return { bgm: null, ambient: 'tv' };
  const wx = state?.weatherKind || 'overcast';
  const wet = wx === 'rain' || wx === 'storm';
  const cold = wx === 'cold' || wx === 'coldwave';
  if (stage === 'night') {
    const spot = night?.spot || 'camp';
    if (spot === 'camp') return { bgm: 'camp', ambient: wet ? 'rain' : night?.fire === true ? 'fire' : null };
    if (spot === 'station') return { bgm: null, ambient: cold ? 'wind' : 'street' };
    return { bgm: 'camp', ambient: wet ? 'rain' : null };
  }
  return { bgm: 'day', ambient: wet ? 'rain' : cold ? 'wind' : 'street' };
}

// ---------- 运行时（只在浏览器里用） ----------
let ctx = null, master = null, noiseBuf = null;
const buses = {};
const buffers = new Map();
const live = { bgm: null, ambient: null };
const current = { bgm: null, ambient: null, volume: 'low', unlocked: false };
const speech = { nodes: new Set(), signature: null };
const sfx = { nodes: new Set(), pending: new Set(), recent: [] };
let sfxGeneration = 0;
let activeTicket = null;
let queue = [];
let observer = null;

function readVolume() { try { const v = localStorage.getItem(STORAGE_KEY); return VOLUME_STEPS.includes(v) ? v : 'low'; } catch { return 'low'; } }
function writeVolume(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch { /* 私密窗口等情况下没有本地存储，静默 */ } }

function canPlayExt(ext) {
  if (typeof document === 'undefined') return true;
  const a = document.createElement('audio');
  const type = { ogg: 'audio/ogg; codecs="vorbis"', mp3: 'audio/mpeg', m4a: 'audio/mp4; codecs="mp4a.40.2"', wav: 'audio/wav' }[ext];
  return Boolean(type && a.canPlayType && a.canPlayType(type));
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = VOLUME_GAIN[current.volume];
  master.connect(ctx.destination);
  for (const k of Object.keys(BUS_GAIN)) { buses[k] = ctx.createGain(); buses[k].gain.value = BUS_GAIN[k]; buses[k].connect(master); }
  return ctx;
}

function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function noiseSource() { const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true; return s; }
function filt(type, f, q = 1) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q !== null) n.Q.value = q; return n; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

async function loadBuffer(url) {
  if (buffers.has(url)) return buffers.get(url);
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => { const out = ctx.decodeAudioData(ab, res, rej); if (out && out.then) out.then(res, rej); }))
    .catch((e) => { buffers.delete(url); throw e; });
  buffers.set(url, p);
  return p;
}

// 持续声（环境/音乐）：返回 { gain, stop }。合成版每种一个函数，参数是常量。
const LOOPS = {
  fire() {
    const g = ctx.createGain(); g.gain.value = 0.5;
    const bed = noiseSource(); chain(bed, filt('bandpass', 420, 0.6), g); bed.start();
    const crackle = noiseSource(); const cg = ctx.createGain(); cg.gain.value = 0; chain(crackle, filt('highpass', 2400, 0.7), cg, g); crackle.start();
    let timer = 0;
    const pop = () => { const t = ctx.currentTime; cg.gain.cancelScheduledValues(t); cg.gain.setValueAtTime(0.9, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + Math.random() * 0.06); timer = setTimeout(pop, 90 + Math.random() * 420); };
    pop();
    return { gain: g, stop() { clearTimeout(timer); bed.stop(); crackle.stop(); } };
  },
  rain() { const g = ctx.createGain(); g.gain.value = 0.35; const s = noiseSource(); chain(s, filt('highpass', 900, 0.5), filt('lowpass', 6000, 0.5), g); s.start(); return { gain: g, stop() { s.stop(); } }; },
  wind() {
    const g = ctx.createGain(); g.gain.value = 0.45; const s = noiseSource(); const lp = filt('lowpass', 420, 0.8); chain(s, lp, g); s.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    return { gain: g, stop() { s.stop(); lfo.stop(); } };
  },
  street() {
    const g = ctx.createGain(); g.gain.value = 0.22; const s = noiseSource(); chain(s, filt('lowpass', 260, 0.7), g); s.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.1; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    return { gain: g, stop() { s.stop(); lfo.stop(); } };
  },
  tv() {
    const g = ctx.createGain(); g.gain.value = 0.18; const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60; const hg = ctx.createGain(); hg.gain.value = 0.35; chain(hum, filt('lowpass', 180, 1), hg, g); hum.start();
    const s = noiseSource(); const sg = ctx.createGain(); sg.gain.value = 0.25; chain(s, filt('highpass', 4200, 0.5), sg, g); s.start();
    return { gain: g, stop() { hum.stop(); s.stop(); } };
  },
  radio() { const g = ctx.createGain(); g.gain.value = 0.3; const s = noiseSource(); chain(s, filt('bandpass', 1800, 1.2), g); s.start(); return { gain: g, stop() { s.stop(); } }; },
};

// 单次音效：每个函数自己排好起止时间。
function burst(f, dur, gain, type = 'highpass', q = 0.7, at = 0) {
  const s = noiseSource(); const g = ctx.createGain(); const t = ctx.currentTime + at;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  chain(s, filt(type, f, q), g, buses.sfx); s.start(t); s.stop(t + dur + 0.02);
  trackSfx(s, activeTicket);
}
function tone(freq, dur, gain, type = 'sine', at = 0, to = null) {
  const o = ctx.createOscillator(); o.type = type; const t = ctx.currentTime + at; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  chain(o, g, buses.sfx); o.start(t); o.stop(t + dur + 0.02);
  trackSfx(o, activeTicket);
}
const ONESHOTS = {
  click() { tone(1200, 0.05, 0.25); },
  confirm() { tone(880, 0.07, 0.22); tone(1320, 0.09, 0.2, 'sine', 0.07); },
  back() { tone(660, 0.07, 0.2); tone(440, 0.09, 0.18, 'sine', 0.07); },
  open() { tone(520, 0.06, 0.18, 'triangle'); tone(780, 0.08, 0.18, 'triangle', 0.05); },
  close() { tone(780, 0.06, 0.18, 'triangle'); tone(520, 0.08, 0.16, 'triangle', 0.05); },
  card_flip() { burst(1500, 0.07, 0.5); },
  shuffle() { for (let i = 0; i < 6; i++) burst(1200 + i * 150, 0.05, 0.4, 'highpass', 0.7, i * 0.045); },
  chips() { burst(3000, 0.05, 0.5, 'bandpass', 2); tone(2600, 0.04, 0.15, 'square', 0.03); tone(3100, 0.04, 0.12, 'square', 0.08); },
  chip_lay() { burst(2600, 0.04, 0.45, 'bandpass', 2); },
  coin() { tone(2200, 0.05, 0.18, 'sine', 0, 3300); tone(3300, 0.18, 0.14, 'sine', 0.05); },
  footstep() { burst(380, 0.07, 0.5, 'lowpass', 0.8); },
  cloth() { burst(1000, 0.1, 0.35, 'bandpass', 0.8); },
  wheel() { burst(120, 0.09, 0.9, 'lowpass', 1); },
  tv_on() { tone(200, 0.12, 0.2, 'sine', 0, 1500); burst(4000, 0.15, 0.3, 'highpass', 0.5, 0.05); },
  radio() { burst(1800, 0.4, 0.35, 'bandpass', 1.2); },
  splash() { burst(760, 0.35, 0.16, 'bandpass', 0.5); burst(2300, 0.18, 0.09, 'highpass', 0.5, 0.06); },
  swim() { burst(560, 0.22, 0.12, 'bandpass', 0.5); burst(920, 0.14, 0.08, 'bandpass', 0.5, 0.12); },
  cook_sizzle() { burst(2400, 0.45, 0.12, 'highpass', 0.4); },
  charcoal_ignite() { burst(1600, 0.22, 0.12, 'bandpass', 0.5); tone(220, 0.16, 0.05, 'triangle'); },
};

function trackSfx(node, ticket) {
  if (!ticket) return;
  const entry = { node, scope: ticket.scope };
  sfx.nodes.add(entry);
  node.onended = () => { sfx.nodes.delete(entry); try { node.disconnect(); } catch {} };
}

function stopSfx() {
  sfxGeneration++;
  for (const ticket of sfx.pending) ticket.cancelled = true;
  sfx.pending.clear();
  for (const entry of [...sfx.nodes]) { entry.node.onended = null; try { entry.node.stop(); } catch {} try { entry.node.disconnect(); } catch {} sfx.nodes.delete(entry); }
}

function cancelScope(scope) {
  for (const ticket of sfx.pending) if (ticket.scope === scope) { ticket.cancelled = true; sfx.pending.delete(ticket); }
  for (const entry of [...sfx.nodes]) if (entry.scope === scope) { entry.node.onended = null; try { entry.node.stop(); } catch {} try { entry.node.disconnect(); } catch {} sfx.nodes.delete(entry); }
}

function fadeOut(kind, sec = 1) {
  const node = live[kind];
  if (!node) return;
  live[kind] = null;
  const t = ctx.currentTime;
  node.gain.gain.cancelScheduledValues(t);
  node.gain.gain.setValueAtTime(node.gain.gain.value, t);
  node.gain.gain.linearRampToValueAtTime(0, t + sec);
  setTimeout(() => { try { node.stop(); } catch { /* 已停 */ } }, sec * 1000 + 50);
}

async function startLoop(kind, name) {
  if (!ensureCtx()) return;
  if (current[kind] === name) return;
  current[kind] = name;
  fadeOut(kind, 1);
  if (!name) return;
  const src = resolveSource(kind, name, { canPlay: canPlayExt });
  if (!src) return;
  let node = null;
  if (src.file) {
    try {
      const buf = await loadBuffer(src.file);
      if (current[kind] !== name) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; chain(s, g, buses[kind]); s.start();
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1);
      node = { gain: g, stop() { s.stop(); } };
    } catch (e) {
      if (!SYNTH.has(name)) { console.warn('[audio] 文件不可用', src.file, e.message); return; }
    }
  }
  if (!node) {
    if (current[kind] !== name) return;
    const made = LOOPS[name]?.();
    if (!made) return;
    const g = ctx.createGain(); g.gain.value = 0; made.gain.connect(g); g.connect(buses[kind]);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1);
    node = { gain: g, stop: made.stop };
  }
  live[kind] = node;
}

async function play(name, { scope = 'ui' } = {}) {
  if (!current.unlocked || current.volume === 'off' || typeof document !== 'undefined' && document.hidden || !ensureCtx() || ctx.state !== 'running') return;
  const src = resolveSource('sfx', name, { canPlay: canPlayExt });
  if (!src) return;
  const ticket = { scope, cancelled: false, generation: sfxGeneration };
  sfx.pending.add(ticket);
  const valid = () => !ticket.cancelled && ticket.generation === sfxGeneration && current.volume !== 'off' && !document.hidden && ctx.state === 'running';
  try {
    if (src.file) {
      try { const buf = await loadBuffer(src.file); if (!valid()) return; const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = 0.48; chain(s, g, buses.sfx); trackSfx(s, ticket); s.start(); sfx.recent.push(name); sfx.recent.splice(0, Math.max(0, sfx.recent.length - 24)); return; }
      catch { /* 文件坏了就走合成 */ }
    }
    if (valid() && ONESHOTS[name]) { activeTicket = ticket; try { ONESHOTS[name](); sfx.recent.push(name); sfx.recent.splice(0, Math.max(0, sfx.recent.length - 24)); } finally { activeTicket = null; } }
  } finally {
    sfx.pending.delete(ticket);
  }
}

function disposeSpeechNode(node) {
  speech.nodes.delete(node);
  try { node.osc.disconnect(); } catch { /* 节点已经断开 */ }
  try { node.gain.disconnect(); } catch { /* 节点已经断开 */ }
  if (!speech.nodes.size) speech.signature = null;
}

function stopSpeech() {
  for (const node of [...speech.nodes]) {
    node.osc.onended = null;
    try { node.osc.stop(); } catch { /* 节点已经停止 */ }
    disposeSpeechNode(node);
  }
  speech.signature = null;
}

// 轻量像素语音：短波形随字符和标点走，不使用现实 TTS 或任何上传。
function speak(speakerId, text) {
  const line = String(text || '').trim();
  if (!line || current.volume === 'off' || !current.unlocked || typeof document === 'undefined' || document.hidden || !ensureCtx() || ctx.state !== 'running') return;
  const signature = `${speakerId || ''}\u0000${line}`;
  if (speech.signature === signature && speech.nodes.size) return;
  stopSpeech();
  const plan = speechPlan(speakerId, line);
  if (!plan.length) return;
  speech.signature = signature;
  const start = ctx.currentTime + 0.01;
  for (const note of plan) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const node = { osc, gain };
    const at = start + note.at;
    osc.type = note.type;
    osc.frequency.setValueAtTime(note.frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(note.gain, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
    chain(osc, gain, buses.sfx);
    osc.onended = () => disposeSpeechNode(node);
    speech.nodes.add(node);
    osc.start(at);
    osc.stop(at + note.duration + 0.008);
  }
}

function setVolume(v) {
  if (!VOLUME_STEPS.includes(v)) return;
  current.volume = v;
  if (v === 'off') { stopSpeech(); stopSfx(); }
  writeVolume(v);
  if (master) master.gain.linearRampToValueAtTime(VOLUME_GAIN[v], ctx.currentTime + 0.2);
  const btn = typeof document !== 'undefined' && document.getElementById('btnSound');
  if (btn) btn.textContent = VOLUME_LABEL[v];
}

function applyScene(scene) { startLoop('bgm', scene.bgm); startLoop('ambient', scene.ambient); }

// 弹窗关闭队列：夜账→放映→夜话依次关掉时切换场景，不用改弹窗代码。
function watchModals() {
  if (observer || typeof MutationObserver === 'undefined') return;
  const el = document.getElementById('modalOverlay');
  if (!el) return;
  let wasOpen = el.classList.contains('open');
  observer = new MutationObserver(() => {
    const open = el.classList.contains('open');
    if (wasOpen && !open) { stopSpeech(); if (queue.length) queue.shift()(); }
    wasOpen = open;
  });
  observer.observe(el, { attributes: true, attributeFilter: ['class'] });
}

// app.js 的挂钩：结算后（白天）、夜账弹出后、放映弹出后各调一次。
export function audioScene(state, result, stage) {
  if (!current.unlocked) return;
  watchModals();
  if (!stage) { if (!result?.night && state?.phase === 'planning') applyScene(sceneFor(state, 'day')); return; }
  if (stage === 'night') {
    const fire = result.events?.some((event) => event.startsWith('篝火烧了')) === true || result.night?.fire === true;
    applyScene(sceneFor(state, 'night', { ...result.night, fire }));
    queue = [];
    if (result.night?.screening) {
      queue.push(() => { play('tv_on'); startLoop('ambient', 'tv'); });
      queue.push(() => applyScene(sceneFor(state, 'night', { ...result.night, fire })));
    }
    queue.push(() => applyScene(sceneFor(state, 'day')));
    return;
  }
  if (stage === 'screening') { /* 已由队列在夜账关闭时切换；这里留作直接调用的入口 */ if (current.ambient !== 'tv') { play('tv_on'); startLoop('ambient', 'tv'); } }
}

// 首次交互解锁、声音按钮、标题/游戏切换、页面隐藏时暂停。
export function initAudio() {
  if (typeof window === 'undefined') return;
  current.volume = readVolume();
  const btn = document.getElementById('btnSound');
  if (btn) { btn.textContent = VOLUME_LABEL[current.volume]; btn.onclick = () => { setVolume(nextVolume(current.volume)); play('click'); }; }
  const unlock = () => {
    if (current.unlocked) return;
    if (!ensureCtx()) return;
    current.unlocked = true;
    if (ctx.state === 'suspended') ctx.resume();
    const onTitle = !document.getElementById('title')?.classList.contains('hidden');
    applyScene(onTitle ? sceneFor(null, 'title') : sceneFor(window.jwsn?.state, 'day'));
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  // 按钮点击音：只对 button 元素，且不重复给声音按钮加。
  document.addEventListener('click', (e) => { const b = e.target.closest?.('button'); if (b && !['btnSound', 'planToggle', 'plannerClose', 'confirmCoffeeRisk'].includes(b.id) && !b.closest?.('[data-sfx-scene]') && !b.dataset.sfx && !b.dataset.use && current.unlocked) play(b.classList.contains('primary') ? 'confirm' : 'click'); }, { capture: true });
  // 标题页/游戏页显示切换：观察 class，不用改切换代码。
  if (typeof MutationObserver !== 'undefined') {
    for (const id of ['title', 'game']) {
      const el = document.getElementById(id);
      if (!el) continue;
      new MutationObserver(() => {
        if (!current.unlocked || el.classList.contains('hidden')) return;
        applyScene(id === 'title' ? sceneFor(null, 'title') : sceneFor(window.jwsn?.state, 'day'));
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopSpeech(); stopSfx(); }
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  window.addEventListener('pagehide', () => { stopSpeech(); stopSfx(); });
  window.jwsnAudio = {
    play, cancelScope, stopSfx, speak, stopSpeech, ambient: (n) => startLoop('ambient', n), bgm: (n) => startLoop('bgm', n), setVolume, cycleVolume: () => setVolume(nextVolume(current.volume)),
    mute: (m) => setVolume(m ? 'off' : (current.volume === 'off' ? 'low' : current.volume)),
    get state() { return { unlocked: current.unlocked, context: ctx ? ctx.state : null, volume: current.volume, bgm: current.bgm, ambient: current.ambient, queued: queue.length, loaded: [...buffers.keys()], speechActive: speech.nodes.size > 0, speechCount: speech.nodes.size, sfxActive: sfx.nodes.size, sfxPending: sfx.pending.size, recentCues: [...sfx.recent] }; },
  };
}
