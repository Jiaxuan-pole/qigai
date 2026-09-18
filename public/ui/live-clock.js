import { $, UI, modalOpen } from './core.js';

export function encounteredEvent(before, after, actorId) {
  const known = new Set(before.events.map(event => event.uid));
  const district = after.actors[actorId]?.location;
  return after.events.find(event => event.status === 'open' && event.district === district && !known.has(event.uid));
}

export function createLiveClock(advance) {
  let previous = null, key = null, elapsed = 0, running = false, fired = false, paused = false;
  return {
    get minutes() { return Math.min(59, Math.floor(elapsed / 1000)); },
    get paused() { return paused; },
    toggle() { paused = !paused; running = false; if (!paused) fired = false; },
    pause() { paused = true; running = false; },
    resetBaseline() { previous = null; },
    restart() { paused = false; running = false; fired = false; elapsed = 0; previous = null; },
    tick(now, allowed, stateKey) {
      if (key !== stateKey) { key = stateKey; elapsed = 0; fired = false; running = false; }
      const enabled = allowed && !paused;
      if (enabled && running && previous !== null && !fired) elapsed += Math.max(0, now - previous);
      previous = now;
      running = enabled;
      if (elapsed >= 60000 && !fired) {
        fired = true;
        Promise.resolve(advance()).then((ok) => { if (ok === false) this.pause(); }).catch(() => this.pause());
      }
    },
  };
}

export function startLiveClock(advance, blocked) {
  const clock = createLiveClock(advance);
  const button = $('clockToggle');
  button.onclick = () => clock.toggle();
  document.addEventListener('visibilitychange', () => clock.resetBaseline());
  const frame = (now) => {
    const s = UI.state;
    const allowed = s && s.phase === 'planning' && !s.pendingMorning && !UI.night &&
      !document.hidden && !$('game').classList.contains('hidden') && !modalOpen() &&
      $('plannerOverlay').hidden && !document.querySelector('.tut-root') && !blocked();
    clock.tick(now, Boolean(allowed), s ? `${s.seed}:${s.day}:${s.hour}:${s.hourTick}` : null);
    if (s && !UI.night && s.phase === 'planning') $('tSlot').textContent = `${String(s.hour).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}`;
    button.textContent = clock.paused ? '▶' : 'Ⅱ';
    button.setAttribute('aria-label', clock.paused ? '继续时间' : '暂停时间');
    button.title = clock.paused ? '继续时间' : '暂停时间';
    button.setAttribute('aria-pressed', String(clock.paused));
    $('clockStatus').textContent = clock.paused ? '已暂停' : allowed ? '时间流逝' : '处理中';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return clock;
}
