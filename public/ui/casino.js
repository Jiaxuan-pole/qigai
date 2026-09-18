import { $, esc, UI, showModal, closeModal, apply, toast } from './core.js';
import { NAMES, reserve, canStartCasino, startCasino, casinoAction, applyCasinoNpcChoice, nextCasinoHand, finishCasino } from '../game/engine.js';
import { showVenueTable } from './card-table-view.js';
import { requestCardNpcChoice } from './card-npc.js';

let table = null;
let request = null;
const names = { ...NAMES, hall_lan: '阿岚', hall_qiao: '阿乔', hall_dealer: '发牌员' };

function stop() {
  request?.abort();
  request = null;
  table?.destroy();
  table = null;
}

function casino() { return UI.state?.pending?.casino; }

export function resumeCasino() {
  const c = casino();
  if (!c || c.phase === 'settled') return false;
  if (c.phase === 'invited') showInvitation();
  else showTable();
  return true;
}

function showInvitation() {
  stop();
  const c = casino();
  const bank = UI.state.casinoVenue.bankrolls;
  showModal('棋牌馆 · 先看再决定', `<p>入馆不收费。${esc(names[c.actorId])}可选择二十一点、炸金花或德州；确认后才从公共现金带入。阿岚与阿乔各持有 ${bank.hall_lan}、${bank.hall_qiao} 块，发牌员银行 ${bank.hall_dealer} 块。当前现金 ${UI.state.cash} 块，预留饭钱 ${reserve(UI.state)} 块。</p>
    <div class="cardsetup"><label>玩法<select id="casinoGame"><option value="blackjack">二十一点</option><option value="zjh">炸金花</option><option value="texas">德州扑克</option></select></label>
    <label>入馆者<select id="casinoActor"><option value="${c.actorId}">${esc(names[c.actorId])}</option></select></label>
    <label>每人带入（块）<input id="casinoBuyIn" type="number" min="1" step="1" value="10" inputmode="numeric"></label>
    <label>每手底注（块）<input id="casinoBaseBet" type="number" min="1" step="1" value="2" inputmode="numeric"></label></div>
    <p class="small" id="casinoInfo"></p><div class="modalbuttons"><button class="primary" id="casinoConfirm">确认带入 10 块</button><button id="casinoExit">不买入，离馆</button></div>`, { tag: 'CARD HALL', lock: true, wide: true });
  const number = (input) => /^\d+$/.test(input.value.trim()) ? Number(input.value.trim()) : NaN;
  const amounts = () => ({ buyIn: number($('casinoBuyIn')), baseBet: number($('casinoBaseBet')) });
  const refresh = () => {
    const chosen = amounts();
    const check = canStartCasino(UI.state, $('casinoGame').value, chosen);
    $('casinoInfo').textContent = check.ok ? `阿岚与阿乔各带入 ${chosen.buyIn} 块；本次占用今日一次付费博彩额度。${$('casinoGame').value === 'blackjack' && chosen.baseBet % 2 ? '二十一点天胡奖金向下取整。' : ''}` : check.reason;
    $('casinoConfirm').textContent = Number.isSafeInteger(chosen.buyIn) && chosen.buyIn > 0 ? `确认带入 ${chosen.buyIn} 块` : '确认带入';
    $('casinoConfirm').disabled = !check.ok;
  };
  $('casinoGame').onchange = refresh;
  $('casinoBuyIn').oninput = refresh;
  $('casinoBaseBet').oninput = refresh;
  refresh();
  $('casinoConfirm').onclick = () => { if (apply(startCasino(UI.state, $('casinoGame').value, amounts()), { noRender: true })) showTable(); };
  $('casinoExit').onclick = () => { if (apply(finishCasino(UI.state), { noRender: true })) { closeModal(true); UI.render(); } };
}

function refreshTable() {
  const c = casino();
  if (!c || c.phase !== 'playing') return;
  table?.update({ session: c.session, line: c.npcLine || '', source: c.npcSource || '' });
  void driveNpc();
}

async function driveNpc() {
  const c = casino();
  if (!c || c.phase !== 'playing' || c.session.cur.over || c.session.cur.turn === c.actorId || request) return;
  const controller = new AbortController();
  request = controller;
  try {
    await requestCardNpcChoice(UI.state, {
      signal: controller.signal, enabled: UI.ai.enabled && UI.ai.available,
      getState: () => UI.state, stillCurrent: () => table !== null && casino()?.phase === 'playing',
      apply(action, { source, line }) {
        const now = UI.state;
        const active = now.pending.casino;
        const result = applyCasinoNpcChoice(now, { action, sessionId: active.sessionId, handSeq: active.handSeq, actionSeq: active.actionSeq, stateRevision: now.stateRevision, npcId: active.session.cur.turn, line, source }, { source, line });
        if (apply(result, { noRender: true })) refreshTable();
      },
    });
  } catch (error) { toast(error.message); }
  finally { if (request === controller) request = null; }
  if (!controller.signal.aborted && casino()?.phase === 'playing' && !casino().session.cur.over && casino().session.cur.turn !== casino().actorId) void driveNpc();
}

function showTable() {
  stop();
  const c = casino();
  table = showVenueTable({ session: c.session, names, controller: c.actorId, line: c.npcLine || '', source: c.npcSource || '',
    legalActions: () => casino()?.allowedActions || [],
    onAction(action) { if (apply(casinoAction(UI.state, action), { noRender: true })) refreshTable(); },
    onNext() { if (apply(nextCasinoHand(UI.state), { noRender: true })) refreshTable(); },
    onExit() {
      const before = UI.state.cash;
      const r = finishCasino(UI.state);
      if (!apply(r, { noRender: true })) return;
      stop();
      const delta = UI.state.cash - before;
      showModal('棋牌馆结算', `<p>本次离馆返还托管筹码。公共现金 ${before} → ${UI.state.cash}（${delta >= 0 ? '+' : ''}${delta}）。阿岚 ${UI.state.casinoVenue.bankrolls.hall_lan}，阿乔 ${UI.state.casinoVenue.bankrolls.hall_qiao}，发牌员 ${UI.state.casinoVenue.bankrolls.hall_dealer}。</p><div class="modalbuttons"><button class="primary" id="casinoExit">返回街区</button></div>`, { tag: 'CARD HALL', lock: true });
      $('casinoExit').onclick = () => { closeModal(true); UI.render(); };
    },
  });
  void driveNpc();
}
