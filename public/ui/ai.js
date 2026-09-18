// AI 对话客户端：服务端校验后返回；失败、超时、状态版本不符时回退本地模板。
import { UI } from './core.js';

export async function fetchAiStatus() {
  try {
    const r = await fetch('/api/ai/status');
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    UI.ai.available = Boolean(j.available);
    UI.ai.model = j.model || '';
  } catch (_) {
    UI.ai.available = false;
  }
  try { UI.ai.enabled = localStorage.getItem('jwsn-ai') !== 'off' && UI.ai.available; } catch (_) { UI.ai.enabled = UI.ai.available; }
}

export function setAiEnabled(on) {
  UI.ai.enabled = on && UI.ai.available;
  try { localStorage.setItem('jwsn-ai', on ? 'on' : 'off'); } catch (_) { /* 无存储 */ }
}

// 请求一段对话。context 由调用方按 04 约定组装；返回 {lines} 或 null（用回退）。
export async function requestDialogue(context, timeoutMs = 12000) {
  if (!UI.ai.enabled) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('/api/dialogue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(context), signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.ok) return null;
    // 晚到的响应：状态已变就丢弃
    if (j.payload.stateRevision !== UI.state.stateRevision) return null;
    return j.payload;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
