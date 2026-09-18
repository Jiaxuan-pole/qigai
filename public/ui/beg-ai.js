import { UI } from './core.js';

const cache = new Map();
let active = null;

export function cancelBegText() {
  active?.abort();
  active = null;
}

export function begTextKey(c) {
  return [c.seed, c.day, c.actorId, c.npcId, c.stage, c.opening, c.action, c.reaction, c.resultKind].join(':');
}

export function presentBegLog(log, actorName, chosenText) {
  if (!chosenText) return log;
  const prefix = `${actorName}：“`;
  return log.map((line, index) => index === 0 && line.startsWith(prefix) ? `${prefix}${chosenText}”` : line);
}

export async function requestBegText(context, stillCurrent, show, timeoutMs = 22000) {
  cancelBegText();
  if (!UI.ai.enabled) return false;
  const key = begTextKey(context);
  if (cache.has(key)) { if (stillCurrent()) show(cache.get(key)); return true; }
  const ctrl = new AbortController();
  active = ctrl;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch('/api/beg', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(context), signal: ctrl.signal });
    if (!response.ok) return false;
    const result = await response.json();
    if (!result.ok || result.payload?.requestId !== context.requestId) return false;
    if (ctrl.signal.aborted || !stillCurrent()) return false;
    cache.set(key, result.payload);
    show(result.payload);
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
    if (active === ctrl) active = null;
  }
}
