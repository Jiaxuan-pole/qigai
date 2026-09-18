// 牌桌界面：像素牌桌弹窗。所有数值变化只经引擎（startCardNight / cardAction / nextHand / finishCardNight），这里只画和点。
import { $, esc, UI, toast, showModal, closeModal, modalOpen, apply } from './core.js';
import { NAMES, canCardNight, startCardNight, cardAction, nextHand, finishCardNight } from '../game/engine.js';
import { legalActions, evalZjh, bestOfSeven, rankOf, suitOf, RANKS, ZJH, TEXAS } from '../game/cards.js';
import { portrait } from './pixel.js';
import { createMotionTimeline, projectCardEvent } from './card-motion.js';
import { showVenueTable } from './card-table-view.js';

// 桌边话：短、口语、各有声纹。按动作挑一句，同一句不连说。
const TALK = {
  ma: { see: ['看一眼。'], call: ['跟。牌桌上不跟等于认怂。', '跟一手，看你能撑到哪。'], raise: ['加。今晚手气在我这边。', '加两个，别眨眼。'], fold: ['扔了，留点火柴明天用。'], compare: ['比一把，磨叽什么。'], check: ['过，你先。'], bet: ['下两个，热热场。'], allin: ['全上。老天爷欠我的。'], win: ['说了，牌运这东西认人。'], lose: ['……刚才那把纯属意外。'] },
  xuan: { see: ['看牌。'], call: ['按赔率算，这手该跟。', '跟，样本还不够。'], raise: ['加一点，测一下你们的边界。'], fold: ['弃。负期望的事不干。'], compare: ['比。我算过了。'], check: ['过牌，观察。'], bet: ['下注，这叫压力测试。'], allin: ['全押。小概率事件也是事件。'], win: ['统计学胜利。'], lose: ['样本太小，不算。'] },
  fan: { see: ['看看。'], call: ['跟吧，反正是火柴。', '跟。'], raise: ['加。你脸上写着没牌。'], fold: ['不跟，这把没意思。'], compare: ['开吧，别演了。'], check: ['过。'], bet: ['下一点，看你们表情。'], allin: ['全押。剧本到高潮了。'], win: ['镜头感对了。'], lose: ['行，这条不要了。'] },
};
const ACTION_LABEL = { see: '看牌', call: '跟注', raise: '加注', fold: '弃牌', compare: '比牌', check: '过牌', bet: '下注', allin: '全押', win: '赢下这手' };
const SEAT = { bottom: [240, 216], left: [96, 78], right: [384, 78] };

let ui = null;
const portraits = new Map();

function waitClose() { return new Promise((res) => { const t = setInterval(() => { if (!modalOpen()) { clearInterval(t); res(); } }, 150); }); }

// 夜里三人都在、马哥带着牌，就问一句要不要打；跳过就直接睡。
export function offerCardNight() {
  return new Promise((resolve) => {
    const s = UI.state;
    if (s.pending?.cards) { ui = { lastSeq: 0, busy: false, resolve }; if (s.pending.cards.game === 'blackjack') showNightBlackjack(); else showTable(); return; }
    if (!canCardNight(s, 'free').ok) return resolve();
    const cashOk = canCardNight(s, 'cash');
    const who = ['xuan', 'fan', 'ma'].map((id) => `<option value="${id}" ${id === 'ma' ? 'selected' : ''}>${NAMES[id]}</option>`).join('');
    showModal('今晚打牌吗？', `<p class="small">马哥把那副旧扑克拍在纸箱上：“三个人，正好。”火柴棍当筹码不伤钱；来真钱的，每人从公共现金拿 10 块当本钱，占全队一次博彩额度。</p>
      <div class="cardsetup"><label>玩法<select id="cardGame"><option value="zjh">炸金花（三张牌）</option><option value="texas">德州扑克</option><option value="blackjack">二十一点</option></select></label>
      <label>赌注<select id="cardStakes"><option value="free">火柴棍</option><option value="cash" ${cashOk.ok ? '' : 'disabled'}>真钱${cashOk.ok ? '' : '（' + esc(cashOk.reason) + '）'}</option></select></label>
      <label>你来操作<select id="cardWho">${who}</select></label></div>
      <div class="modalbuttons"><button class="primary" id="cardGo">开桌</button><button id="cardSkip">不打了，睡觉</button></div>`, { tag: 'CARD NIGHT', lock: true });
    $('cardSkip').onclick = () => { closeModal(true); resolve(); };
    $('cardGo').onclick = () => {
      const r = startCardNight(UI.state, { game: $('cardGame').value, stakes: $('cardStakes').value, controller: $('cardWho').value });
      if (!apply(r, { noRender: true })) return;
      ui = { lastSeq: 0, busy: false, resolve, motion: null, view: null };
      if (session().game === 'blackjack') showNightBlackjack(); else showTable();
    };
  });
}

function session() { return UI.state.pending?.cards; }

function showNightBlackjack() {
  ui?.table?.destroy();
  const se = session();
  ui.table = showVenueTable({ session: se, names: NAMES, controller: se.controller, nextId: 'cardNext', exitId: 'cardStop', night: true,
    onAction(action) {
      if (apply(cardAction(UI.state, action.id), { noRender: true })) ui.table.update({ session: session() });
    },
    onNext() { if (apply(nextHand(UI.state), { noRender: true })) ui.table.update({ session: session() }); },
    onExit: finish,
  });
}

function showTable() {
  const se = session();
  const title = `${se.game === 'texas' ? '德州扑克' : '炸金花'} · ${se.stakes === 'free' ? '火柴棍' : '真钱'} · 第 ${se.hand}/${se.maxHands} 手`;
  ui.motion?.cancel();
  portraits.clear();
  showModal(title, `<div class="cardtable"><canvas id="cardCanvas" width="480" height="270"></canvas><div class="cardtalk" id="cardTalk">发牌。</div><div class="small" id="cardInfo"></div><div class="modalbuttons" id="cardActions"></div></div>`, { tag: 'CARD NIGHT', lock: true, wide: true });
  const prior = se.results.find((r) => r.hand === se.hand - 1)?.chips;
  ui.view = { counts: Object.fromEntries(se.players.map((id) => [id, 0])), board: 0, pot: 0, chips: prior ? { ...prior } : Object.fromEntries(se.players.map((id) => [id, se.buyIn])), revealed: {}, seen: {}, folded: {}, streetBets: {}, acted: {}, allin: {}, stage: 'preflop', boardTarget: 0, order: [...se.cur.order], over: false, moving: null, thinking: null };
  const canvas = $('cardCanvas');
  ui.motion = createMotionTimeline({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, frame: (motion) => { if (!ui || $('cardCanvas') !== canvas || !modalOpen()) { ui?.motion?.cancel(); return; } ui.view.moving = motion; if (motion.kind === 'deal' && motion.progress === 1) { if (motion.card.id) ui.view.counts[motion.card.id] = Math.max(ui.view.counts[motion.card.id], motion.card.index + 1); else ui.view.board = Math.max(ui.view.board, motion.card.index + 1); } draw(); } });
  draw();
  replayThenControls();
}

function pick(id, action) { const pool = TALK[id]?.[action]; if (!pool) return ''; return pool[Math.floor(Math.random() * pool.length)]; }

// AI 已经在引擎里走完了，这里按事件顺序一条条念出来，让人看得清谁做了什么。
async function replayThenControls() {
  const owner = ui;
  const se = session();
  const fresh = se.events.filter((e) => e.seq > owner.lastSeq && e.hand === se.hand);
  owner.lastSeq = se.seq;
  owner.busy = true;
  $('cardActions').innerHTML = '<span class="small muted">对面在想……</span>';
  const motion = owner.motion;
  const valid = () => ui === owner && $('cardCanvas') && modalOpen();
  const revealBoard = async () => {
    const target = owner.view.boardTarget || 0;
    if (owner.view.board >= target) return true;
    const cards = Array.from({ length: target - owner.view.board }, (_, i) => ({ index: owner.view.board + i }));
    return motion.deal(cards);
  };
  if (fresh.some((e) => e.action === 'deal')) {
    const cards = [];
    const n = se.game === 'zjh' ? 3 : 2;
    for (let i = 0; i < n; i++) for (const id of se.cur.order) cards.push({ id, index: i });
    if (!await motion.deal(cards) || !valid()) return;
    owner.view.counts = Object.fromEntries(se.players.map((id) => [id, n]));
    owner.view.moving = null;
    const live = se.cur.order.filter((id) => owner.view.chips[id] > 0);
    const small = live.length === 2 ? se.cur.dealerId : live[0];
    const big = live[(live.indexOf(small) + 1) % live.length];
    const forced = se.game === 'zjh' ? se.cur.order.map((id) => [id, ZJH.ante]) : [[small, TEXAS.smallBlind], [big, TEXAS.bigBlind]];
    for (const [id, stake] of forced) { const amount = Math.min(stake, owner.view.chips[id]); if (amount && !await motion.chips(id, amount)) return; owner.view.chips[id] -= amount; owner.view.pot += amount; if (se.game === 'texas') owner.view.streetBets[id] = amount; motion.clear(); }
    draw();
  }
  for (const e of fresh) {
    if (!valid()) return;
    if (e.action === 'deal') continue;
    const isAI = e.id && e.id !== se.controller;
    if (isAI) { motion.think(e.id); if (!await motion.pause(220) || !valid()) return; }
    const line = pick(e.id, e.action);
    const what = e.action === 'compare' ? `比牌 → ${NAMES[e.target]}${e.loser === e.id ? '，输了' : '，赢了'}` : e.action === 'raise' || e.action === 'bet' || e.action === 'allin' ? `${ACTION_LABEL[e.action]}到 ${e.to}` : e.action === 'call' ? `跟注 ${e.cost}${e.blind ? '（闷）' : ''}` : ACTION_LABEL[e.action] || e.action;
    $('cardTalk').innerHTML = `<b>${NAMES[e.id]}</b> ${esc(what)}${line ? '：“' + esc(line) + '”' : ''}`;
    const projected = projectCardEvent(owner.view, e, se.cur, se.game, se.controller);
    if (projected.cost && !await motion.chips(e.id, projected.cost)) return;
    if (e.action === 'win') {
      if (!await revealBoard()) return;
      if (!await motion.collect(e.winners || [e.id])) return;
      owner.view = { ...projected.view, moving: owner.view.moving };
      $('cardTalk').innerHTML = `<b>${NAMES[e.id]}</b> 收下底池 ${e.pot}：“${esc(pick(e.id, 'win'))}”`;
    } else { owner.view = { ...projected.view, moving: owner.view.moving }; if (!await revealBoard()) return; }
    motion.clear();
    draw();
  }
  if (!valid()) return;
  if (!await revealBoard() || !valid()) return;
  owner.view.pot = se.cur.over ? 0 : se.cur.pot;
  owner.view.chips = { ...se.chips };
  owner.view.revealed = { ...se.cur.revealed, ...owner.view.revealed };
  owner.view.folded = { ...se.cur.folded };
  owner.view.seen = { ...se.cur.seen };
  owner.view.streetBets = { ...se.cur.streetBets };
  owner.view.acted = { ...se.cur.acted };
  owner.view.allin = { ...se.cur.allin };
  owner.view.stage = se.cur.stage;
  owner.view.boardTarget = se.cur.board?.length || 0;
  owner.view.over = se.cur.over;
  owner.busy = false;
  draw(); controls();
}

function controls() {
  const se = session();
  const cur = se.cur;
  const box = $('cardActions');
  if (!cur || cur.over) {
    const won = cur ? cur.winners.map((id) => NAMES[id]).join('、') : '';
    const names = cur?.summary?.hands ? Object.entries(cur.summary.hands).filter(([id]) => cur.revealed[id]).map(([id, n]) => `${NAMES[id]}：${n}`).join('　') : '';
    $('cardInfo').textContent = cur ? `这手 ${won} 赢了底池 ${cur.pot}。${names}` : '';
    box.innerHTML = `${se.done ? '' : '<button class="primary" id="cardNext">再来一手</button>'}<button id="cardStop">${se.done ? '收工睡觉' : '不打了，睡觉'}</button>`;
    if ($('cardNext')) $('cardNext').onclick = () => { if (apply(nextHand(UI.state), { noRender: true })) showTable(); };
    $('cardStop').onclick = finish;
    return;
  }
  if (cur.turn !== se.controller) { box.innerHTML = '<span class="small muted">对面在想……</span>'; return; }
  const acts = legalActions(se);
  const unit = se.stakes === 'free' ? '根' : '块';
  $('cardInfo').textContent = se.game === 'zjh' ? `第 ${cur.round} 轮 · 当前单注 ${cur.stake} · 你的筹码 ${se.chips[se.controller]}${unit}${cur.seen[se.controller] ? '' : ' · 你还没看牌（闷牌只付一半）'}` : `${({ preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌' })[cur.stage]} · 底池 ${cur.pot} · 你的筹码 ${se.chips[se.controller]}${unit}`;
  let html = '';
  for (const a of acts) {
    if (a.id === 'see') html += `<button data-act="see">看牌</button>`;
    else if (a.id === 'call') html += `<button class="primary" data-act="call">跟注 ${a.cost}</button>`;
    else if (a.id === 'check') html += `<button class="primary" data-act="check">过牌</button>`;
    else if (a.id === 'raise' && se.game === 'zjh') html += `<button data-act="raise">加注到 ${a.to}（付 ${a.cost}）</button>`;
    else if (a.id === 'raise' || a.id === 'bet') {
      const big = Math.min(a.max, Math.max(a.min, cur.pot));
      html += `<button data-act="${a.id}" data-amt="${a.min}">${a.id === 'bet' ? '下注' : '加注到'} ${a.min}</button>`;
      if (big > a.min) html += `<button data-act="${a.id}" data-amt="${big}">${a.id === 'bet' ? '下注' : '加注到'} ${big}</button>`;
    }
    else if (a.id === 'allin') html += `<button data-act="allin">全押 ${a.to}</button>`;
    else if (a.id === 'compare') for (const t of a.targets) html += `<button data-act="compare" data-target="${t}">比牌·${NAMES[t]}（付 ${a.cost}）</button>`;
    else if (a.id === 'fold') html += `<button data-act="fold">弃牌</button>`;
  }
  box.innerHTML = html;
  box.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => {
    if (ui.busy) return;
    const r = cardAction(UI.state, b.dataset.act, Number(b.dataset.amt || 0), b.dataset.target || null);
    if (!apply(r, { noRender: true })) return;
    window.jwsnAudio?.play?.('card_flip');
    const me = session().controller;
    $('cardTalk').innerHTML = `<b>${NAMES[me]}</b> ${esc(ACTION_LABEL[b.dataset.act] || b.dataset.act)}`;
    replayThenControls();
  }; });
}

function finish() {
  const se = session();
  const before = { mind: Object.fromEntries(['xuan', 'fan', 'ma'].map((id) => [id, UI.state.actors[id].mind])), cash: UI.state.cash };
  ui?.table?.destroy();
  ui?.motion?.cancel();
  const r = finishCardNight(UI.state);
  if (!apply(r)) return;
  const s = UI.state;
  const unit = se.stakes === 'free' ? '根火柴' : '块';
  const rows = ['xuan', 'fan', 'ma'].map((id) => `<div class="summaryrow"><span>${NAMES[id]}${se.game === 'blackjack' && id === se.dealerId ? '（庄）' : ''}</span><b>${(se.game === 'blackjack' && id === se.dealerId ? se.bank : se.chips[id]) - se.buyIn >= 0 ? '+' : ''}${(se.game === 'blackjack' && id === se.dealerId ? se.bank : se.chips[id]) - se.buyIn}${unit} · 精神 ${before.mind[id]} → ${s.actors[id].mind}</b></div>`).join('');
  showModal('收牌', `${rows}<div class="notebox">${se.stakes === 'free' ? '火柴棍不值钱，三个人精神各 +6；' : `真钱在自己人之间转了一圈，公共现金 ${before.cash} → ${s.cash}；`}熬夜每人体力 −5。${esc(s.log[0] || '')}</div><div class="modalbuttons"><button class="primary" id="cardBye">睡觉</button></div>`, { tag: 'CARD NIGHT', lock: true });
  $('cardBye').onclick = () => { closeModal(true); const done = ui?.resolve; ui = null; if (done) done(); };
}

// 画牌桌：纸箱当桌，三张脸围着，牌面像素字。
const CARD_W = 24, CARD_H = 34;
function drawCard(c, x, y, card, faceUp) {
  if (!faceUp) {
    c.fillStyle = '#2f4a6b'; c.fillRect(x, y, CARD_W, CARD_H);
    c.fillStyle = '#4a6a92'; for (let yy = 3; yy < CARD_H - 3; yy += 3) for (let xx = (yy / 3) % 2 ? 3 : 5; xx < CARD_W - 3; xx += 4) c.fillRect(x + xx, y + yy, 1, 1);
    c.strokeStyle = '#1d2b3a'; c.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);
    return;
  }
  c.fillStyle = '#f2eee4'; c.fillRect(x, y, CARD_W, CARD_H);
  c.strokeStyle = '#2b2b30'; c.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);
  const red = suitOf(card) === 1 || suitOf(card) === 2;
  c.fillStyle = red ? '#c23a2f' : '#1f2024';
  c.font = 'bold 11px ui-monospace, Menlo, monospace';
  c.textBaseline = 'top';
  c.fillText(RANKS[rankOf(card)].replace('T', '10'), x + 2, y + 2);
  c.font = '14px sans-serif';
  c.fillText('♠♥♦♣'[suitOf(card)], x + 7, y + 15);
}

function drawSeat(c, se, id, pos, faceUp) {
  const cur = se.cur;
  const [x, y] = pos;
  let off = portraits.get(id);
  if (!off) { off = document.createElement('canvas'); off.width = 32; off.height = 38; portrait(off, id); portraits.set(id, off); }
  c.drawImage(off, x - 16, y - 19);
  c.font = 'bold 11px sans-serif'; c.textBaseline = 'top'; c.fillStyle = id === se.controller ? '#e3bb72' : '#d7cbb1';
  c.fillText(NAMES[id], x - 16, y + 21);
  c.font = '10px sans-serif'; c.fillStyle = '#a7b1b3';
  c.fillText(`${ui?.view?.chips[id] ?? se.chips[id]}${se.stakes === 'free' ? '根' : '块'}`, x + 8, y + 21);
  const tags = [];
  if (cur) {
    if (cur.dealerId === id) tags.push('庄');
    if ((ui?.view?.folded ?? cur.folded)[id]) tags.push('弃');
    if (se.game === 'zjh' && !cur.folded[id]) tags.push((ui?.view?.seen ?? cur.seen)[id] ? '看' : '闷');
    if (se.game === 'texas' && (ui?.view?.over ?? cur.over) && cur.allin?.[id]) tags.push('全押');
    if (!ui?.busy && cur.turn === id && !cur.over) tags.push('轮到');
  }
  c.fillStyle = '#71bfc3'; c.fillText(tags.join(' '), x - 16, y + 33);
  const cards = cur ? (se.game === 'zjh' ? cur.hands[id] : cur.hole[id]) : [];
  const n = cards.length;
  const cx = x - (n * (CARD_W + 4) - 4) / 2;
  const dim = cur && (ui?.view?.folded ?? cur.folded)[id];
  c.save(); if (dim) c.globalAlpha = 0.4;
  cards.slice(0, ui?.view?.counts[id] ?? cards.length).forEach((card, i) => drawCard(c, cx + i * (CARD_W + 4), pos === SEAT.bottom ? y - 62 : y + 46, card, faceUp));
  c.restore();
  if (se.game === 'texas' && cur && (ui?.view?.streetBets ?? cur.streetBets)?.[id]) { c.fillStyle = '#e3bb72'; c.font = '10px sans-serif'; c.fillText(`注 ${(ui?.view?.streetBets ?? cur.streetBets)[id]}`, x + 8, y + 33); }
}

function draw() {
  const se = session();
  const canvas = $('cardCanvas');
  if (!se || !canvas) return;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#0d151b'; c.fillRect(0, 0, 480, 270);
  // 纸箱桌：桥下夜里唯一平的东西。
  c.fillStyle = '#7d6242'; c.fillRect(90, 100, 300, 120); c.fillStyle = '#9a7a52'; c.fillRect(90, 100, 300, 6); c.fillStyle = '#b39a70'; c.fillRect(236, 100, 8, 120);
  c.fillStyle = '#5c4630'; c.fillRect(90, 214, 300, 6);
  const g = c.createRadialGradient(240, 150, 20, 240, 150, 240); g.addColorStop(0, 'rgba(255,200,120,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g; c.fillRect(0, 0, 480, 270);
  const cur = se.cur;
  const others = se.players.filter((id) => id !== se.controller);
  const seats = { [se.controller]: SEAT.bottom, [others[0]]: SEAT.left, [others[1]]: SEAT.right };
  for (const id of se.players) {
    const reveal = cur && (ui?.view ? (ui.view.revealed[id] || (id === se.controller && se.game === 'texas')) : (cur.over ? cur.revealed[id] || (se.game === 'texas' && !cur.folded[id]) : id === se.controller && (se.game === 'texas' || cur.seen[id])));
    drawSeat(c, se, id, seats[id], Boolean(reveal));
  }
  c.font = 'bold 12px sans-serif'; c.fillStyle = '#e6dfcc'; c.textBaseline = 'top';
  if (cur) c.fillText(`底池 ${ui?.view?.pot ?? cur.pot}`, 210, 100);
  if (se.game === 'texas' && cur) {
    for (let i = 0; i < 5; i++) { if (i < (ui?.view?.board ?? cur.board.length) && cur.board[i] !== undefined) drawCard(c, 172 + i * 28, 118, cur.board[i], true); else { c.strokeStyle = '#4a5c62'; c.strokeRect(172.5 + i * 28, 118.5, CARD_W - 1, CARD_H - 1); } }
  } else if (cur) { c.font = '11px sans-serif'; c.fillStyle = '#a7b1b3'; c.fillText(`第 ${Math.min(cur.round, 6)} 轮 · 单注 ${cur.stake}`, 196, 128); }
  if (cur && (ui?.view?.over ?? cur.over)) {
    c.fillStyle = '#e3bb72'; c.font = 'bold 12px sans-serif';
    const hands = cur.summary?.hands || {};
    const txt = cur.winners.map((id) => `${NAMES[id]}${hands[id] ? '·' + hands[id] : ''}`).join('、') + ' 赢';
    c.fillText(txt, 240 - c.measureText(txt).width / 2, 154);
  }
  const moving = ui?.view?.moving;
  if (moving?.kind === 'deal' && moving.progress < 1) {
    const id = moving.card.id; const n = moving.card.index; const seat = id ? seats[id] : null;
    const count = se.game === 'zjh' ? 3 : 2; const tx = seat ? seat[0] - (count * 28 - 4) / 2 + n * 28 : 172 + n * 28; const ty = seat ? (seat[1] === 216 ? seat[1] - 62 : seat[1] + 46) : 118;
    drawCard(c, 228 + (tx - 228) * moving.progress, 164 + (ty - 164) * moving.progress, null, false);
  }
  if (moving?.kind === 'chips' || moving?.kind === 'collect') {
    const ids = moving.kind === 'chips' ? [moving.id] : moving.winners;
    for (const id of ids) { const [x, y] = seats[id]; const t = moving.kind === 'chips' ? moving.progress : 1 - moving.progress;
      const px = x + (240 - x) * t; const py = y + (176 - y) * t;
      c.fillStyle = '#e3bb72'; c.fillRect(Math.round(px) - 4, Math.round(py) - 4, 8, 8);
    }
  }
  if (moving?.kind === 'think' && seats[moving.id]) { const [x, y] = seats[moving.id]; c.fillStyle = '#d7cbb1'; c.fillRect(x - 10, y - 39, 20, 13); c.fillStyle = '#26333b'; c.font = 'bold 12px sans-serif'; c.fillText('……', x - 8, y - 38); }
}

export { session as cardSession, evalZjh, bestOfSeven, createMotionTimeline };
