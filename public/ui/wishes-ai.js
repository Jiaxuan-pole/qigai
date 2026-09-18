import { makeWishContext, applyWishSuggestions } from '../game/wishes.js';
import { localWishSuggestions } from '../game/item-wishes.js';

export async function maybeGenerateItemWishes(state, { signal, stillCurrent, useAI = true } = {}) {
  const context = makeWishContext(state);
  if (!context.actors.length) return null;
  let payload = null;
  let source = 'local';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    if (useAI && !signal?.aborted) {
      const response = await fetch('/api/wishes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(context), signal: ctrl.signal });
      if (response.ok) {
        const result = await response.json();
        if (result.ok && result.payload?.requestId === context.requestId) { payload = result.payload; source = 'ai'; }
      }
    }
  } catch (_) {
    // 离线或限时后仍可由本地候选继续游戏。
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted || (stillCurrent && !stillCurrent())) return null;
  let next = payload && applyWishSuggestions(state, context, payload, source);
  if (!next) { source = 'local'; next = applyWishSuggestions(state, context, localWishSuggestions(context, state.seed), source); }
  if (!next) return null;
  return { state: next, source, summary: next.wishes.filter(w => w.createdDay === context.day && w.source === source).map(w => ({ actorId: w.actor, itemId: w.targetItem, reason: w.reason })) };
}
