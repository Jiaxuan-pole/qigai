import { $, esc, showModal, modalOpen } from './core.js';
import { portrait } from './pixel.js';
import { rankOf, suitOf, RANKS, legalActions as pokerLegalActions } from '../game/cards.js';
import { blackjackView } from '../game/blackjack.js';
import { createMotionTimeline } from './card-motion.js';

const WIDTH = 480;
const HEIGHT = 270;
const CARD_W = 24;
const CARD_H = 34;
const DEFAULT_NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥', hall_lan: '阿岚', hall_qiao: '阿乔', hall_dealer: '发牌员' };
const LABELS = { see: '看牌', call: '跟注', raise: '加注', fold: '弃牌', compare: '比牌', check: '过牌', bet: '下注', allin: '全押', hit: '要牌', stand: '停牌', double: '加倍' };
const RESULTS = { win: '赢', lose: '输', push: '平', natural: '黑杰克', bust: '爆牌' };

export function tableProjection(session, controller = session.controller) {
  const cur = session.cur;
  if (session.game === 'blackjack') {
    const view = blackjackView(session, controller);
    const seats = [...session.players, session.dealerId].map((id) => {
      const count = id === session.dealerId ? view.dealerCards?.length || 0 : view.counts?.[id] || 0;
      const visible = id === session.dealerId ? view.dealerCards || [] : view.hands?.[id] || [];
      return { id, cards: Array.from({ length: count }, (_, i) => visible[i] ?? null), chips: view.chips?.[id] ?? view.bank ?? 0, bet: view.bets?.[id] || 0, result: view.results?.[id] || '', dealer: id === session.dealerId };
    });
    return { game: 'blackjack', seats, board: [], pot: Object.values(view.bets || {}).reduce((a, b) => a + b, 0), turn: view.turn, over: view.over, hand: view.handSeq, maxHands: session.maxHands, legalActions: view.legalActions || [], bank: view.bank, dealerId: session.dealerId };
  }
  const seats = session.players.map((id) => {
    const cards = cur ? session.game === 'texas' ? cur.hole?.[id] || [] : cur.hands?.[id] || [] : [];
    const reveal = id === controller ? session.game === 'texas' || Boolean(cur?.seen?.[id] || cur?.revealed?.[id]) : Boolean(cur?.revealed?.[id]);
    return { id, cards: cards.map((card) => reveal ? card : null), chips: session.chips?.[id] ?? 0, bet: cur?.streetBets?.[id] || 0, folded: Boolean(cur?.folded?.[id]), dealer: cur?.dealerId === id };
  });
  return { game: session.game, seats, board: [...(cur?.board || [])], pot: cur?.pot || 0, turn: cur?.turn || null, over: Boolean(cur?.over), hand: session.hand, maxHands: session.maxHands, legalActions: cur?.turn === controller ? pokerLegalActions(session) : [], winners: cur?.winners || [], stage: cur?.stage || '' };
}

export function actionChoices(session, controller, legal = tableProjection(session, controller).legalActions) {
  if (!session.cur || session.cur.over || session.cur.turn !== controller) return [];
  const choices = [];
  for (const action of legal) {
    if (action.target) choices.push({ id: action.id, target: action.target, label: `${LABELS[action.id]}·${action.target}` });
    else if (action.id === 'compare') for (const target of action.targets || []) choices.push({ id: action.id, target, label: `${LABELS[action.id]}·${target}` });
    else if (action.amount !== undefined) choices.push({ id: action.id, amount: action.amount, label: `${LABELS[action.id] || action.id} ${action.amount}` });
    else if ((action.id === 'bet' || action.id === 'raise') && Number.isFinite(action.min)) {
      choices.push({ id: action.id, amount: action.min, label: `${LABELS[action.id]} ${action.min}` });
      if (action.max > action.min) choices.push({ id: action.id, amount: action.max, label: `${LABELS[action.id]} ${action.max}` });
    } else choices.push({ id: action.id, label: `${LABELS[action.id] || action.id}${action.cost ? ` ${action.cost}` : ''}${action.to ? ` ${action.to}` : ''}` });
  }
  return choices;
}

function card(c, x, y, value) {
  if (value === null || value === undefined) {
    c.fillStyle = '#2f4a6b'; c.fillRect(x, y, CARD_W, CARD_H);
    c.fillStyle = '#4a6a92';
    for (let yy = 3; yy < CARD_H - 3; yy += 3) for (let xx = (yy / 3) % 2 ? 3 : 5; xx < CARD_W - 3; xx += 4) c.fillRect(x + xx, y + yy, 1, 1);
    c.strokeStyle = '#1d2b3a'; c.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);
    return;
  }
  c.fillStyle = '#f2eee4'; c.fillRect(x, y, CARD_W, CARD_H);
  c.strokeStyle = '#2b2b30'; c.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);
  const suit = suitOf(value);
  c.fillStyle = suit === 1 || suit === 2 ? '#c23a2f' : '#1f2024';
  c.font = 'bold 11px ui-monospace, Menlo, monospace'; c.textBaseline = 'top';
  c.fillText(RANKS[rankOf(value)].replace('T', '10'), x + 2, y + 2);
  c.font = '14px sans-serif'; c.fillText('♠♥♦♣'[suit], x + 7, y + 15);
}

function npcPortrait(c, x, y, id) {
  const coat = id === 'hall_lan' ? '#6f7f9a' : id === 'hall_qiao' ? '#9a7052' : '#516763';
  const hair = id === 'hall_lan' ? '#342f40' : id === 'hall_qiao' ? '#47362a' : '#242d30';
  c.fillStyle = '#141a1f'; c.fillRect(x - 16, y - 18, 32, 38);
  c.fillStyle = coat; c.fillRect(x - 12, y + 5, 24, 14);
  c.fillStyle = '#d9a577'; c.fillRect(x - 8, y - 12, 16, 18);
  c.fillStyle = hair; c.fillRect(x - 9, y - 15, 18, id === 'hall_qiao' ? 6 : 4);
  if (id === 'hall_dealer') { c.fillStyle = '#d7cbb1'; c.fillRect(x - 11, y + 5, 22, 3); }
  else if (id === 'hall_lan') { c.fillStyle = '#1d2b3a'; c.fillRect(x - 7, y - 5, 5, 2); c.fillRect(x + 2, y - 5, 5, 2); }
  else { c.fillStyle = '#c23a2f'; c.fillRect(x - 5, y + 7, 10, 3); }
}

function cardPosition(seat, pos, controller, dealerId, game, index) {
  const [x, y] = pos;
  if (game === 'blackjack') {
    const area = seat.id === dealerId ? { center: 240, width: 128, row: 82 }
      : seat.id === controller ? { center: 240, width: 128, row: 156 }
        : { center: x < WIDTH / 2 ? 142 : 338, width: 132, row: 118 };
    const step = seat.cards.length > 1 ? Math.min(28, Math.floor((area.width - CARD_W) / (seat.cards.length - 1))) : 0;
    const used = CARD_W + step * (seat.cards.length - 1);
    return [Math.round(area.center - used / 2) + index * step, area.row];
  }
  if (seat.id === controller) return [x - (seat.cards.length * 28 - 4) / 2 + index * 28, y - 62];
  if (seat.id === dealerId) return [x - (seat.cards.length * 28 - 4) / 2 + index * 28, y + 64];
  const left = x < WIDTH / 2;
  return [left ? x + 40 + index * 28 : x - seat.cards.length * 28 - 36 + index * 28, y + 8];
}

function drawTable(canvas, projection, controller, names, counts, boardCount, moving, portraits) {
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#0d151b'; c.fillRect(0, 0, WIDTH, HEIGHT);
  c.fillStyle = '#7d6242'; c.fillRect(90, 100, 300, 120);
  c.fillStyle = '#9a7a52'; c.fillRect(90, 100, 300, 6);
  c.fillStyle = '#b39a70'; c.fillRect(236, 100, 8, 120);
  c.fillStyle = '#5c4630'; c.fillRect(90, 214, 300, 6);
  const glow = c.createRadialGradient(240, 150, 20, 240, 150, 240);
  glow.addColorStop(0, 'rgba(255,200,120,0.10)'); glow.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = glow; c.fillRect(0, 0, WIDTH, HEIGHT);
  const others = projection.seats.filter((seat) => seat.id !== controller && seat.id !== projection.dealerId);
  const spots = { [controller]: [240, 211] };
  if (projection.dealerId) spots[projection.dealerId] = [240, 24];
  if (others[0]) spots[others[0].id] = [96, projection.game === 'blackjack' ? 59 : 71];
  if (others[1]) spots[others[1].id] = [384, projection.game === 'blackjack' ? 59 : 71];
  if (others[2]) spots[others[2].id] = [240, 24];
  for (const seat of projection.seats) {
    const pos = spots[seat.id]; if (!pos) continue;
    const [x, y] = pos;
    if (seat.id.startsWith('hall_')) npcPortrait(c, x, y, seat.id);
    else {
      let head = portraits.get(seat.id);
      if (!head) { head = document.createElement('canvas'); head.width = 32; head.height = 38; portrait(head, seat.id); portraits.set(seat.id, head); }
      c.drawImage(head, x - 16, y - 19);
    }
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.font = 'bold 11px sans-serif'; c.fillStyle = seat.id === controller ? '#e3bb72' : '#d7cbb1';
    c.fillText(names[seat.id] || seat.id, x, y + 21);
    c.font = '10px sans-serif'; c.fillStyle = '#a7b1b3';
    c.fillText(`${seat.chips}${seat.dealer ? ' 庄' : ''}`, x, y + 33);
    c.fillStyle = '#71bfc3'; c.fillText(`${seat.bet ? `注 ${seat.bet} ` : ''}${seat.folded ? '弃 ' : ''}${RESULTS[seat.result] || ''}${projection.turn === seat.id ? ' 轮到' : ''}`, x, y + 45);
    const visible = seat.cards.slice(0, counts[seat.id] ?? seat.cards.length);
    c.save(); if (seat.folded) c.globalAlpha = 0.4;
    visible.forEach((value, i) => { const [cx, cy] = cardPosition(seat, pos, controller, projection.dealerId, projection.game, i); card(c, cx, cy, value); }); c.restore();
  }
  c.textAlign = 'left'; c.font = 'bold 12px sans-serif'; c.textBaseline = 'top'; c.fillStyle = '#e6dfcc';
  c.fillText(`底池 ${projection.pot}`, 210, projection.game === 'blackjack' ? 130 : 100);
  if (projection.game === 'texas') for (let i = 0; i < 5; i++) {
    if (i < boardCount && projection.board[i] !== undefined) card(c, 172 + i * 28, 118, projection.board[i]);
    else { c.strokeStyle = '#4a5c62'; c.strokeRect(172.5 + i * 28, 118.5, CARD_W - 1, CARD_H - 1); }
  }
  if (moving?.kind === 'deal' && moving.progress < 1) {
    const seat = projection.seats.find((item) => item.id === moving.card.id);
    const target = seat ? cardPosition(seat, spots[seat.id], controller, projection.dealerId, projection.game, moving.card.index) : null;
    const tx = target ? target[0] : 172 + moving.card.index * 28;
    const ty = target ? target[1] : 118;
    card(c, 228 + (tx - 228) * moving.progress, 164 + (ty - 164) * moving.progress, null);
  }
  if ((moving?.kind === 'chips' || moving?.kind === 'collect') && spots[moving.id || moving.winners?.[0]]) {
    const [x, y] = spots[moving.id || moving.winners[0]];
    const t = moving.kind === 'chips' ? moving.progress : 1 - moving.progress;
    c.fillStyle = '#e3bb72'; c.fillRect(Math.round(x + (240 - x) * t) - 4, Math.round(y + (176 - y) * t) - 4, 8, 8);
  }
}

export function showVenueTable({ session, names = DEFAULT_NAMES, controller = session.controller, line = '', source = '', legalActions, onAction, onNext, onExit, nextId = 'casinoNext', exitId = 'casinoExit', night = false }) {
  let current = session;
  let projection = tableProjection(current, controller);
  let active = true;
  let moving = null;
  let counts = Object.fromEntries(projection.seats.map((seat) => [seat.id, 0]));
  let boardCount = 0;
  const portraits = new Map();
  const title = { zjh: '炸金花', texas: '德州扑克', blackjack: '二十一点' }[session.game] || '牌桌';
  showModal(title, '<div class="cardtable"><canvas id="cardCanvas" width="480" height="270" role="img" aria-label="牌桌"></canvas><div class="cardtalk" id="cardTalk"></div><div class="small" id="casinoNpcSource"></div><div class="small" id="casinoInfo"></div><div class="modalbuttons" id="cardActions"></div></div>', { tag: 'CARD TABLE', lock: true, wide: true });
  if ($('cardActions').dataset) $('cardActions').dataset.sfxScene = 'card-table';
  const canvas = $('cardCanvas');
  const makeMotion = () => createMotionTimeline({ reduced: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false, frame: (frame) => {
    if (!active || !modalOpen() || $('cardCanvas') !== canvas) { motion.cancel(); return; }
    moving = frame;
    if (frame.kind === 'deal' && frame.progress === 1) {
      if (frame.card.id) counts[frame.card.id] = Math.max(counts[frame.card.id] || 0, frame.card.index + 1);
      else boardCount = Math.max(boardCount, frame.card.index + 1);
    }
    drawTable(canvas, projection, controller, names, counts, boardCount, moving, portraits);
  } });
  let motion = makeMotion();
  const text = (spoken, origin) => {
    $('cardTalk').innerHTML = esc(spoken || '发牌。');
    $('casinoNpcSource').textContent = origin === 'ai' || origin === 'model' ? 'AI' : origin === 'local' ? '本地' : '';
    if (spoken) globalThis.window?.jwsnAudio?.speak?.('npc', spoken);
  };
  const controls = () => {
    const box = $('cardActions'); box.replaceChildren();
    const seatInfo = projection.seats.map((seat) => `${names[seat.id] || seat.id} ${seat.chips}${seat.result ? ` ${RESULTS[seat.result] || ''}` : ''}`).join(' · ');
    $('casinoInfo').textContent = `第 ${projection.hand || 1} 手 · 底池 ${projection.pot}${projection.bank === undefined ? '' : ` · 发牌员准备金 ${projection.bank}`} · ${seatInfo}`;
    if (projection.over) {
      if (onNext && !current.done && (current.handSeq || current.hand || 0) < (current.maxHands || 1)) button(box, '再来一手', nextId, onNext);
      if (onExit) button(box, night ? '收工睡觉' : '离开牌桌', exitId, onExit);
      return;
    }
    const supplied = typeof legalActions === 'function' ? legalActions(current) : legalActions;
    for (const choice of actionChoices(current, controller, supplied || projection.legalActions)) {
      const label = choice.target ? `${LABELS[choice.id]}·${names[choice.target] || choice.target}` : choice.label;
      const control = button(box, label, null, () => onAction?.({ id: choice.id, ...(choice.amount === undefined ? {} : { amount: choice.amount }), ...(choice.target ? { target: choice.target } : {}) }));
      control.dataset.casinoAct = choice.id;
      if (night) control.dataset.act = choice.id;
    }
    if (!night && current.game === 'texas' && current.cur?.turn === controller) {
      const range = pokerLegalActions(current).find((action) => ['bet', 'raise'].includes(action.id) && action.max > action.min);
      if (range) {
        const label = document.createElement('label');
        label.textContent = `${LABELS[range.id]}到 `;
        const input = document.createElement('input');
        input.id = 'casinoAmount'; input.type = 'number'; input.min = String(range.min); input.max = String(range.max); input.step = '1'; input.value = String(range.min);
        label.append(input);
        box.append(label);
        const submit = button(box, '按此金额下注', null, () => onAction?.({ id: range.id, amount: Number(input.value) }));
        submit.dataset.casinoAct = range.id;
      }
    }
  };
  const draw = () => drawTable(canvas, projection, controller, names, counts, boardCount, moving, portraits);
  async function animate(next, previous) {
    const dealt = [];
    if (previous && next.pot > previous.pot && next.turn) {
      window.jwsnAudio?.play?.('chip_lay', { scope: 'card-table' });
      const payer = previous.turn || controller;
      if (!await motion.chips(payer, next.pot - previous.pot)) return;
    }
    if (previous && next.over && !previous.over && previous.pot) {
      window.jwsnAudio?.play?.(next.winners?.includes(controller) ? 'coin' : 'chips', { scope: 'card-table' });
      if (!await motion.collect(next.winners?.length ? next.winners : [controller])) return;
    }
    for (const seat of next.seats) for (let i = previous?.seats.find((old) => old.id === seat.id)?.cards.length || 0; i < seat.cards.length; i++) dealt.push({ id: seat.id, index: i });
    for (let i = previous?.board.length || 0; i < next.board.length; i++) dealt.push({ index: i });
    if (dealt.length) { window.jwsnAudio?.play?.('shuffle', { scope: 'card-table' }); if (!await motion.deal(dealt)) return; }
    if (!active) return;
    counts = Object.fromEntries(next.seats.map((seat) => [seat.id, seat.cards.length]));
    boardCount = next.board.length;
    moving = null; draw(); controls();
  }
  function update(next) {
    if (!active) return;
    motion.cancel();
    motion = makeMotion();
    const prior = projection;
    current = next.session || next;
    projection = tableProjection(current, controller);
    const newHand = projection.hand !== prior.hand || projection.game !== prior.game;
    if (newHand) { counts = Object.fromEntries(projection.seats.map((seat) => [seat.id, 0])); boardCount = 0; }
    text(next.line ?? line, next.source ?? source);
    draw();
    const pending = animate(projection, newHand ? null : prior);
    return pending;
  }
  function destroy() { active = false; motion.cancel(); portraits.clear(); window.jwsnAudio?.cancelScope?.('card-table'); }
  text(line, source);
  draw();
  animate(projection, null);
  return { update, destroy };
}

function button(parent, label, id, handler) {
  const control = document.createElement('button');
  control.textContent = label;
  if (id) control.id = id;
  control.onclick = handler;
  parent.append(control);
  return control;
}
