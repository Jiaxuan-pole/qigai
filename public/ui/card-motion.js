// 牌桌动画时钟只负责显示，不改引擎会话。
export function createMotionTimeline({ raf = requestAnimationFrame, cancelRaf = cancelAnimationFrame, now = () => performance.now(), reduced = false, frame }) {
  let active = true;
  let handle = 0;
  let timer = 0;
  let settle = null;
  const tick = (kind, duration, extra = {}) => new Promise((resolve) => {
    if (!active) return resolve(false);
    const start = now();
    settle = resolve;
    const paint = (time) => {
      if (!active || settle !== resolve) return;
      const progress = reduced || (typeof document !== 'undefined' && document.hidden) ? 1 : Math.min(1, Math.max(0, (time - start) / duration));
      frame({ kind, progress, ...extra, ...(kind === 'deal' ? { arrived: extra.arrived - (progress < 1 ? 1 : 0) } : {}) });
      if (progress === 1) {
        if (handle) cancelRaf(handle);
        if (timer) clearTimeout(timer);
        handle = 0; timer = 0; settle = null;
        resolve(true);
      } else handle = raf(paint);
    };
    timer = setTimeout(() => paint(start + duration), reduced ? 0 : duration);
    paint(start + (reduced ? duration : 0));
  });
  return {
    async deal(cards) {
      for (let i = 0; i < cards.length; i++) {
        const ok = await tick('deal', 150, { card: cards[i], arrived: i + 1 });
        if (!ok) return false;
      }
      return active;
    },
    chips(id, amount) { return tick('chips', 400, { id, amount }); },
    collect(winners) { return tick('collect', 450, { winners }); },
    think(id) { if (active) frame({ kind: 'think', id, progress: 0 }); },
    pause(ms) { return new Promise((resolve) => { if (!active) return resolve(false); settle = resolve; timer = setTimeout(() => { timer = 0; settle = null; resolve(active); }, reduced ? 0 : ms); }); },
    clear() { if (active) frame({ kind: 'idle', progress: 1 }); },
    cancel() { active = false; if (handle) cancelRaf(handle); if (timer) clearTimeout(timer); if (settle) settle(false); settle = null; handle = 0; timer = 0; },
  };
}

export function projectCardEvent(view, event, cur, game, controller) {
  const next = { ...view, chips: { ...view.chips }, revealed: { ...view.revealed }, seen: { ...view.seen }, folded: { ...view.folded }, streetBets: { ...view.streetBets }, acted: { ...view.acted }, allin: { ...view.allin } };
  let cost = event.cost || 0;
  if (game === 'texas' && (event.action === 'bet' || event.action === 'raise' || event.action === 'allin')) {
    cost = Math.max(0, (event.to || 0) - (next.streetBets[event.id] || 0));
  }
  if (cost) {
    next.chips[event.id] -= cost;
    next.pot += cost;
    if (game === 'texas') { next.streetBets[event.id] = (next.streetBets[event.id] || 0) + cost; if (next.chips[event.id] === 0) next.allin[event.id] = true; }
  }
  if (event.action === 'see') {
    next.seen[event.id] = true;
    if (event.id === controller) next.revealed[event.id] = true;
  }
  if (event.action === 'compare') {
    for (const id of [event.id, event.target]) if (cur.revealed[id]) next.revealed[id] = true;
    next.folded[event.loser] = true;
  }
  if (event.action === 'fold') next.folded[event.id] = true;
  if (game === 'texas' && event.action !== 'win') {
    if (event.action === 'bet' || event.action === 'raise' || event.action === 'allin') next.acted = { [event.id]: true };
    else if (event.action === 'call' || event.action === 'check') next.acted[event.id] = true;
    const live = next.order.filter((id) => !next.folded[id]);
    const canAct = live.filter((id) => !next.allin[id]);
    const max = Math.max(...Object.values(next.streetBets));
    const settled = canAct.every((id) => next.acted[id] && next.streetBets[id] === max);
    const runout = canAct.length <= 1 && (canAct.length === 0 || next.streetBets[canAct[0]] === max);
    if (live.length > 1 && (runout || settled)) {
      const previousStage = next.stage;
      if (runout) { next.stage = 'river'; next.boardTarget = 5; }
      else if (next.stage !== 'river') {
        const stages = { preflop: ['flop', 3], flop: ['turn', 4], turn: ['river', 5] };
        [next.stage, next.boardTarget] = stages[next.stage];
      }
      if (!runout && next.stage !== previousStage) { next.streetBets = Object.fromEntries(next.order.map((id) => [id, 0])); next.acted = {}; }
    }
  }
  if (event.action === 'win') {
    next.revealed = { ...cur.revealed };
    next.over = true;
    next.pot = 0;
  }
  return { view: next, cost };
}
