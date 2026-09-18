import { $ } from './core.js';

let previousFocus = null;

export function setPlannerWindowOpen(open) {
  const toggle = $('planToggle'), overlay = $('plannerOverlay');
  const drawer = $('drawer'), planner = $('planner');
  if (!toggle || !overlay || !drawer || !planner) return;
  const wasOpen = !overlay.hidden;
  if (Boolean(open) !== wasOpen) {
    if (!open) globalThis.window?.jwsnAudio?.cancelScope?.('planner');
    globalThis.window?.jwsnAudio?.play?.(open ? 'open' : 'close', { scope: 'planner' });
  }
  if (open && !wasOpen) previousFocus = document.activeElement;
  overlay.hidden = !open;
  drawer.hidden = !open;
  planner.hidden = !open;
  toggle.setAttribute('aria-expanded', String(Boolean(open)));
  document.body?.classList?.toggle('planner-window-open', Boolean(open));
  if (open && !wasOpen) $('plannerClose')?.focus();
  if (!open && wasOpen) {
    const target = previousFocus?.isConnected === false ? toggle : previousFocus || toggle;
    target.focus?.();
    previousFocus = null;
  }
}

export function bindPlannerWindow() {
  const overlay = $('plannerOverlay');
  $('plannerClose').onclick = () => setPlannerWindowOpen(false);
  overlay.onclick = (event) => { if (event.target === overlay) setPlannerWindowOpen(false); };
  overlay.onkeydown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPlannerWindowOpen(false); return; }
    if (event.key !== 'Tab') return;
    const controls = [...$('plannerWindow').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((node) => node.getClientRects().length);
    if (!controls.length) { event.preventDefault(); $('plannerWindow').focus(); return; }
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', (event) => {
    if (overlay.hidden || event.key !== 'Tab' || $('modalOverlay')?.classList.contains('open')) return;
    if (!overlay.contains(document.activeElement)) { event.preventDefault(); $('plannerClose').focus(); }
  }, true);
}
