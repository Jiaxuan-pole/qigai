const BIN_REWARDS = ['cash', 'bottles', 'bread', 'cloth', 'parts', 'cardboard', 'soap', 'butts'];

export function createInteractionMetrics() {
  return {
    bins: {
      actions: 0, boards: 0, reveals: 0, dirtHits: 0,
      ...Object.fromEntries(BIN_REWARDS.map((key) => [key, 0])),
    },
    beg: {
      sessions: 0, openings: 0, likes: 0, asks: 0, successes: 0,
      cash: 0, food: 0, tips: 0, refusalMindLoss: 0,
    },
    pending: { fallbacks: 0, remaining: 0 },
    _boards: new Set(),
    _begSessions: new Set(),
  };
}

function recordBeg(metrics, before, result, command) {
  const session = before.pending.beg[command.sessionIndex];
  if (!session) return;
  const key = `${before.day}:${session.slot}:${session.actorId}:${session.npcs.map((npc) => npc.id).join(',')}`;
  if (!metrics._begSessions.has(key)) {
    metrics._begSessions.add(key);
    metrics.beg.sessions += 1;
  }
  if (command.step === 'open') {
    metrics.beg.openings += 1;
    if (result.result?.reaction === 'like') metrics.beg.likes += 1;
  }
  if (command.step === 'ask') {
    metrics.beg.asks += 1;
    const outcome = result.result;
    if (outcome?.kind && outcome.kind !== 'refusal') metrics.beg.successes += 1;
    if (outcome?.kind === 'cash') metrics.beg.cash += outcome.cash || 0;
    if (outcome?.kind === 'food') metrics.beg.food += 1;
    if (outcome?.kind === 'job_tip') metrics.beg.tips += 1;
  }
  if (command.step === 'finish') metrics.beg.refusalMindLoss += Math.max(0, before.actors[session.actorId].mind - result.state.actors[session.actorId].mind);
}

function recordBin(metrics, before, result, command) {
  const board = before.pending.bins[command.boardIndex];
  if (!board) return;
  const key = `${before.day}:${board.actorId}:${board.binId}`;
  if (!metrics._boards.has(key)) {
    metrics._boards.add(key);
    metrics.bins.boards += 1;
  }
  if (command.kind !== 'binReveal') return;
  metrics.bins.reveals += 1;
  const cell = result.result?.cell;
  if (cell?.kind === 'dirt') metrics.bins.dirtHits += 1;
  if (cell?.kind !== 'loot') return;
  const keyName = cell.loot.id;
  metrics.bins[keyName] = (metrics.bins[keyName] || 0) + (cell.loot.qty || 1);
}

export function recordSettledInteractionMetrics(metrics, before, result, tasks) {
  if (result.error) return;
  const beforeKeys = new Set(before.pending.bins.map((board) => `${board.actorId}:${board.binId}`));
  const openedActors = new Set(result.state.pending.bins
    .filter((board) => !beforeKeys.has(`${board.actorId}:${board.binId}`))
    .map((board) => board.actorId));
  for (const task of tasks) {
    if (task.id === 'bins' && task.participants.some((actorId) => openedActors.has(actorId))) metrics.bins.actions += 1;
  }
}

export function recordInteractionMetrics(metrics, before, result, command) {
  if (command.kind === 'begStep') recordBeg(metrics, before, result, command);
  if (command.kind === 'binReveal' || command.kind === 'binForfeit') recordBin(metrics, before, result, command);
}

export function recordPendingFallback(metrics) {
  metrics.pending.fallbacks += 1;
}

export function finalizeInteractionMetrics(metrics, state) {
  metrics.pending.remaining = (state.pending?.beg.length || 0) + (state.pending?.bins.length || 0);
  delete metrics._boards;
  delete metrics._begSessions;
  return metrics;
}
