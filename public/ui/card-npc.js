import { casinoObservation } from '../game/casino-contract.js';
import { aiDecide } from '../game/cards-ai.js';
import { blackjackLocalDecision } from '../game/blackjack.js';

const identity = (o) => [o.requestId, o.sessionId, o.handSeq, o.actionSeq, o.stateRevision, o.npcId].join('|');
const sameAction = (a, b) => a && b && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every((key) => a[key] === b[key]);
const safeLine = (line) => typeof line === 'string' && line.length >= 1 && [...line].length <= 60
  && line.trim() === line && !/[<>\u0000-\u001f\u007f]/u.test(line);

function localChoice(state, observation) {
  const session = state.pending.casino.session;
  let proposed;
  if (observation.game === 'blackjack') {
    const id = blackjackLocalDecision(session, observation.npcId);
    proposed = id ? { id } : null;
  } else {
    const decision = aiDecide(structuredClone(session), observation.npcId);
    proposed = decision ? { id: decision.action, ...(decision.amount === undefined ? {} : { amount: decision.amount }),
      ...(decision.target === undefined ? {} : { target: decision.target }) } : null;
  }
  const action = observation.allowedActions.find((candidate) => sameAction(candidate, proposed))
    || observation.allowedActions.find((candidate) => candidate.id === proposed?.id)
    || observation.allowedActions.find((candidate) => ['check', 'call', 'stand', 'fold'].includes(candidate.id))
    || observation.allowedActions[0];
  return action ? { action, line: '我照自己的想法来。' } : null;
}

export async function requestCardNpcChoice(state, { getState = () => state, stillCurrent = () => true,
  apply, fetchImpl = fetch, timeoutMs = 22000, signal, enabled = true } = {}) {
  if (typeof apply !== 'function' || typeof getState !== 'function') throw new TypeError('card NPC requires apply and getState');
  const npcId = state.pending?.casino?.session?.cur?.turn;
  if (!npcId || !['hall_lan', 'hall_qiao', 'hall_dealer'].includes(npcId)) return null;
  const start = casinoObservation(state, npcId);
  const current = () => {
    if (signal?.aborted || !stillCurrent()) return null;
    const now = getState();
    if (now?.pending?.casino?.session?.cur?.turn !== npcId) return null;
    try {
      const seen = casinoObservation(now, npcId);
      return identity(seen) === identity(start) ? { now, seen } : null;
    } catch { return null; }
  };
  if (!current()) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  let payload = null;
  try {
    if (enabled) {
      const response = await fetchImpl('/api/card-npc', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(start), signal: controller.signal });
      if (response.ok) {
        const result = await response.json();
        if (result.ok) payload = result.payload;
      }
    }
  } catch { /* 当前局面仍在时只走一次本地决策。 */ }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }

  const fresh = current();
  if (!fresh) return null;
  const legal = payload && identity(payload) === identity(start) && safeLine(payload.line)
    ? fresh.seen.allowedActions.find((candidate) => sameAction(candidate, payload.action)) : null;
  const selected = legal ? { action: legal, line: payload.line, source: 'ai' }
    : { ...localChoice(fresh.now, fresh.seen), source: 'local' };
  if (!selected.action || !current()) return null;
  apply(selected.action, { source: selected.source, line: selected.line });
  return { payload: { ...start, action: selected.action, line: selected.line }, source: selected.source };
}
