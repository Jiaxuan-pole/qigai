const READY_MS = 2000;
const LAP_MS = 1500;
const LAPS = 3;
const FEEDBACK_MS = 480;
const NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };
let active = null;

export function fishingQteGeometry(bite) {
  return { start: ((bite.zoneStart % 360) + 360) % 360, width: bite.zoneWidth };
}

export function fishingQteAngle(now, startedAt, lapMs = LAP_MS) {
  return ((now - startedAt) % lapMs + lapMs) % lapMs / lapMs * 360;
}

export function cancelFishingQte() {
  active?.submit(null);
}

export function playFishingQte(bite, onResolve) {
  cancelFishingQte();
  return new Promise((resolve, reject) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lapMs = reduced ? 2400 : LAP_MS;
    const geometry = fishingQteGeometry(bite);
    const root = document.createElement('div');
    root.className = 'fishing-qte-overlay';
    if (root.dataset) root.dataset.sfxScene = 'fishing';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '收竿时机');
    root.innerHTML = `<div class="fishing-qte-panel" data-qte="panel" tabindex="-1"><div class="fishing-qte-river"><div class="fishing-qte-bank"></div><div class="fishing-qte-rod"></div><div class="fishing-qte-line"></div><div class="fishing-qte-water"></div></div><div class="fishing-qte-title">有鱼咬钩！</div><p class="fishing-qte-subtitle">空格/点击收竿</p><div class="fishing-qte-ring" data-qte="ring"><div class="fishing-qte-needle" data-qte="needle"></div><div class="fishing-qte-hub"></div></div><div class="fishing-qte-status" data-qte="status" aria-live="polite">准备收竿 · 2</div><div class="fishing-qte-footer"><span data-qte="skill"></span><button type="button" class="fishing-qte-button" data-qte="button">收竿</button></div></div>`;
    const panel = root.querySelector('[data-qte="panel"]');
    const ring = root.querySelector('[data-qte="ring"]');
    const needle = root.querySelector('[data-qte="needle"]');
    const status = root.querySelector('[data-qte="status"]');
    const button = root.querySelector('[data-qte="button"]');
    root.querySelector('[data-qte="skill"]').textContent = `${NAMES[bite.actorId] ?? '队员'} · 钓鱼熟练度 ${bite.skill}`;
    ring.style.background = `conic-gradient(from ${geometry.start}deg, var(--gold) 0deg ${geometry.width}deg, var(--line) ${geometry.width}deg 360deg)`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ui/fishing-qte.css';
    document.head.appendChild(link);
    document.body.appendChild(root);
    window.jwsnAudio?.play?.('fish_bite', { scope: 'fishing' });
    const priorFocus = document.activeElement;
    panel.focus();

    let frame = 0;
    let origin = null;
    let pausedAt = null;
    let feedbackAt = null;
    let settled = false;
    let completed = false;
    let resultValue = null;

    function vibrate(pattern) {
      try { navigator.vibrate?.(pattern); } catch { /* Hardware vibration is optional. */ }
    }

    function cleanup() {
      window.jwsnAudio?.cancelScope?.('fishing');
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', keydown, true);
      button.removeEventListener('click', click);
      vibrate(0);
      root.remove();
      link.remove();
      if (priorFocus?.isConnected) priorFocus.focus();
      if (active?.submit === submit) active = null;
    }

    function finish() {
      if (completed) return;
      completed = true;
      cleanup();
      resolve(resultValue);
    }

    function showResult(value) {
      resultValue = value?.result ?? value;
      if (value?.error) {
        completed = true;
        cleanup();
        reject(new Error(value.error));
        return;
      }
      const hit = resultValue?.hit === true;
      window.jwsnAudio?.play?.(hit ? 'fish_catch' : 'fish_escape', { scope: 'fishing' });
      status.textContent = hit ? '收竿成功！' : '脱钩了';
      panel.classList.add(hit ? 'fishing-qte-hit' : 'fishing-qte-miss');
      if (!reduced) panel.classList.add('fishing-qte-shake');
      vibrate(reduced ? 30 : hit ? 60 : [30, 60, 90]);
      feedbackAt = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function submit(angle) {
      if (settled || completed) return;
      settled = true;
      if (angle !== null) window.jwsnAudio?.play?.('reel', { scope: 'fishing' });
      cancelAnimationFrame(frame);
      button.disabled = true;
      try {
        const value = onResolve(angle);
        if (value && typeof value.then === 'function') value.then(showResult, (error) => { completed = true; cleanup(); reject(error); });
        else showResult(value);
      } catch (error) { completed = true; cleanup(); reject(error); }
    }

    function currentAngle(now) {
      if (origin === null) return 0;
      return fishingQteAngle(now, origin + READY_MS, lapMs);
    }

    function collect(event) {
      event.preventDefault();
      if (settled || completed || document.hidden) return;
      const now = performance.now();
      if (origin === null || now - origin < READY_MS) return;
      if (now - origin >= READY_MS + lapMs * LAPS) { submit(null); return; }
      submit(currentAngle(now));
    }

    function click(event) { collect(event); }
    function keydown(event) {
      if (event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) collect(event);
    }

    function visibility() {
      if (document.hidden) {
        pausedAt = performance.now();
        cancelAnimationFrame(frame);
      } else if (pausedAt !== null) {
        const pause = performance.now() - pausedAt;
        if (origin !== null) origin += pause;
        if (feedbackAt !== null) feedbackAt += pause;
        pausedAt = null;
        frame = requestAnimationFrame(tick);
      }
    }

    function tick(now) {
      if (completed || document.hidden) return;
      if (settled) {
        if (feedbackAt !== null && now - feedbackAt >= FEEDBACK_MS) finish();
        else frame = requestAnimationFrame(tick);
        return;
      }
      if (origin === null) origin = now;
      const elapsed = now - origin;
      if (elapsed < READY_MS) {
        status.textContent = `准备收竿 · ${Math.ceil((READY_MS - elapsed) / 1000)}`;
      } else if (elapsed >= READY_MS + lapMs * LAPS) {
        submit(null);
        return;
      } else {
        status.textContent = `收竿时机 · 第 ${Math.floor((elapsed - READY_MS) / lapMs) + 1} / ${LAPS} 圈`;
        needle.style.transform = `rotate(${currentAngle(now)}deg)`;
      }
      frame = requestAnimationFrame(tick);
    }

    active = { submit };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', keydown, true);
    button.addEventListener('click', click);
    frame = requestAnimationFrame(tick);
  });
}
