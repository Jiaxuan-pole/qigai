import { renderFamilyA } from './work-games-render-a.js';
import { renderFamilyB } from './work-games-render-b.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const aFamilies = new Set(['sorting', 'memory', 'circuit', 'audit']);
const dirKeys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const actorNames = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };

export function workInputForAction(action, data, session) {
  const { challenge, progress } = session;
  switch (action) {
    case 'place': return { type: 'place', pieceId: data.pieceId, binId: data.binId };
    case 'ready': return { type: 'ready' };
    case 'pick': return { type: 'pick', dishId: data.id };
    case 'rotate': return { type: 'rotate', index: Number(data.index) };
    case 'submit': return { type: 'submit' };
    case 'flag': return { type: 'flag', rowId: data.id };
    case 'move': return { type: 'move', direction: data.direction };
    case 'shoot': return { type: 'shoot' };
    case 'select': return { type: 'select', cardId: data.id };
    case 'shift': return { type: 'shift', direction: data.direction };
    case 'advance': return { type: 'advance', lane: Number(data.lane) };
    case 'pass': return { type: 'pass', station: challenge.stations[progress.station].id, cue: data.cue };
    case 'watch': return { type: 'watch', swapIndex: progress.swapIndex };
    case 'choose': return { type: 'choose', cup: Number(data.cup) };
    default: return null;
  }
}

export function renderWorkGameMarkup(session, { selectedPiece = null, error = '', result = null, showBall = true } = {}) {
  const { challenge: c, progress: p } = session;
  const body = p.done || result ? '' : aFamilies.has(c.family) ? renderFamilyA(c, p, selectedPiece) : renderFamilyB(c, p, { showBall });
  return `<section class="work-game wg-${esc(c.family)}" data-work-game role="region" aria-label="${esc(c.title)}">
    <header class="wg-head"><span class="wg-eyebrow">街头工作 · ${esc(actorNames[session.actorId || session.controllerId] || '队员')}</span><h2>${esc(c.title)}</h2><p>${esc(c.instructions)}</p></header>
    ${error ? `<p class="wg-error" role="alert">${esc(error)}</p>` : ''}
    ${p.done || result ? `<div class="wg-finished"><p>${result ? `这轮操作已结算。得分 ${esc(result.score)} · 奖金 ${esc(result.bonus)} 元。` : '这轮操作已结束。结束后由工作结算计算奖金。'}</p></div>` : body}
    <footer class="wg-footer">${result ? '' : `${p.done ? '<button type="button" class="primary" data-work-action="finish" data-focus="finish">结束本次挑战</button>' : ''}<button type="button" data-work-action="forfeit" data-focus="forfeit">放弃奖金并退出</button>`}</footer>
  </section>`;
}

export function mountWorkGame(root, session, { onInput, onFinish, onForfeit }) {
  if (!root || typeof onInput !== 'function' || typeof onFinish !== 'function' || typeof onForfeit !== 'function') throw new TypeError('工作游戏缺少容器或回调');
  let current = session, selectedPiece = null, error = '', result = null, disposed = false, busy = false;
  let showBall = session.challenge.family === 'cups' && session.progress.swapIndex === 0;
  const timers = new Set();
  const animations = new Set();
  const setTimer = (fn, ms) => { const timer = setTimeout(() => { timers.delete(timer); if (!disposed) fn(); }, ms); timers.add(timer); };
  function render() {
    if (disposed) return;
    const focused = root.contains(document.activeElement) ? document.activeElement?.dataset.focus : null;
    const scroll = root.scrollTop;
    root.innerHTML = renderWorkGameMarkup(current, { selectedPiece, error, result, showBall });
    root.scrollTop = scroll;
    if (focused) root.querySelectorAll('[data-focus]').forEach(el => { if (el.dataset.focus === focused) el.focus({ preventScroll: true }); });
  }
  function update(next) {
    if (disposed) return;
    current = next?.session || next;
    if (current.challenge.family === 'cups' && current.progress.swapIndex > 0) showBall = false;
    error = '';
    selectedPiece = null;
    busy = false;
    render();
  }
  function showResult(value) { result = value; error = ''; busy = false; render(); }
  function submit(input) {
    if (busy || current.progress.done || !input) return;
    busy = true;
    try {
      const next = onInput(input);
      if (next?.error) { error = next.error; busy = false; render(); return; }
      if (next?.session || next?.challenge) update(next);
      else busy = false;
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); busy = false; render(); }
  }
  function watch() {
    const swap = current.challenge.swaps[current.progress.swapIndex];
    const reduced = globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!swap || reduced) { submit({ type: 'watch', swapIndex: current.progress.swapIndex }); return; }
    const cups = [...root.querySelectorAll('.wg-cup-position')];
    const first = cups[swap[0]], second = cups[swap[1]];
    if (!first || !second || !first.animate || busy) { submit({ type: 'watch', swapIndex: current.progress.swapIndex }); return; }
    busy = true;
    const dx = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    const a = first.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx / 2}px,-24px)`, offset: .5 }, { transform: `translate(${dx}px,0)` }], { duration: 650, easing: 'ease-in-out' });
    const b = second.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-dx / 2}px,24px)`, offset: .5 }, { transform: `translate(${-dx}px,0)` }], { duration: 650, easing: 'ease-in-out' });
    animations.add(a); animations.add(b);
    const input = { type: 'watch', swapIndex: current.progress.swapIndex };
    setTimer(() => { animations.delete(a); animations.delete(b); a.cancel(); b.cancel(); busy = false; submit(input); }, 660);
  }
  function action(name, data) {
    if (name === 'forfeit' || name === 'finish') {
      if (busy || result) return;
      busy = true;
      try { const value = name === 'finish' ? onFinish() : onForfeit(); if (value?.error) { error = value.error; busy = false; render(); } else if (value && 'bonus' in value) showResult(value); else busy = false; }
      catch (cause) { error = cause instanceof Error ? cause.message : String(cause); busy = false; render(); }
      return;
    }
    if (name === 'piece') { selectedPiece = data.id; render(); return; }
    if (name === 'bin') { if (selectedPiece) submit(workInputForAction('place', { pieceId: selectedPiece, binId: data.id }, current)); return; }
    if (name === 'watch') { watch(); return; }
    submit(workInputForAction(name, data, current));
  }
  function click(event) {
    const target = event.target.closest?.('[data-work-action]');
    if (target && root.contains(target)) action(target.dataset.workAction, target.dataset);
  }
  function keydown(event) {
    if (event.key === ' ' || event.key === 'Spacebar') event.stopPropagation();
    if (current.progress.done || !['camera', 'route'].includes(current.challenge.family) || !dirKeys[event.key]) return;
    event.preventDefault(); event.stopPropagation();
    submit({ type: 'move', direction: dirKeys[event.key] });
  }
  function dragstart(event) { const piece = event.target.closest?.('[data-work-action="piece"]'); if (piece) event.dataTransfer?.setData('text/plain', piece.dataset.id); }
  function dragover(event) { if (event.target.closest?.('[data-bin]')) event.preventDefault(); }
  function drop(event) { const bin = event.target.closest?.('[data-bin]'); if (!bin) return; event.preventDefault(); const pieceId = event.dataTransfer?.getData('text/plain'); if (pieceId) submit({ type: 'place', pieceId, binId: bin.dataset.bin }); }
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  root.addEventListener('dragstart', dragstart);
  root.addEventListener('dragover', dragover);
  root.addEventListener('drop', drop);
  render();
  if (showBall) setTimer(() => { showBall = false; render(); }, 1200);
  return { update, showResult, destroy() { if (disposed) return; disposed = true; timers.forEach(clearTimeout); animations.forEach(a => a.cancel()); root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); root.removeEventListener('dragstart', dragstart); root.removeEventListener('dragover', dragover); root.removeEventListener('drop', drop); } };
}
