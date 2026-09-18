import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { parse, evalZjh, compareZjh, bestOfSeven, newSession, startHand, act, runAI, legalActions, MA_LUCK, ZJH, TEXAS } from '../public/game/cards.js';
import { startCardNight, cardAction, nextHand, finishCardNight, canCardNight, autoResolvePending, meet } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { validateSave } from '../public/game/save.js';
import { ready } from './engine-fixtures.js';

before(async () => { await loadData(); });

const H = (s) => s.split(' ').map(parse);

test('zjh hand categories and ordering follow street rules', () => {
  assert.equal(evalZjh(H('As Ah Ad')).name, '豹子');
  assert.equal(evalZjh(H('Qs Ks As')).name, '顺金');
  assert.equal(evalZjh(H('2s 7s Ks')).name, '金花');
  assert.equal(evalZjh(H('As 2h 3d')).name, '顺子', 'A23 算最小的顺子');
  assert.equal(evalZjh(H('9s 9h 2d')).name, '对子');
  assert.equal(evalZjh(H('2s 3h 5d')).name, '单张');
  const order = ['As Ah Ad', 'Qs Ks As', '2s 7s Ks', 'Qs Kh Ad', '9s 9h 2d', 'Ks 7h 2d'];
  for (let i = 0; i < order.length - 1; i++) assert.equal(compareZjh(evalZjh(H(order[i])), evalZjh(H(order[i + 1]))), 1, order[i] + ' 应大于 ' + order[i + 1]);
  assert.equal(compareZjh(evalZjh(H('Qs Kh Ad')), evalZjh(H('As 2h 3d'))), 1, 'QKA 最大、A23 最小');
  assert.equal(compareZjh(evalZjh(H('9s 9h Ad')), evalZjh(H('9c 9d Kd'))), 1, '对子相同比单张');
  assert.equal(compareZjh(evalZjh(H('9s 9h Ad')), evalZjh(H('9c 9d Ah'))), 0, '花色不分大小，完全相同算平');
});

test('235 of mixed suits beats a trio and nothing else', () => {
  const special = evalZjh(H('2s 3h 5d'));
  assert.equal(compareZjh(special, evalZjh(H('As Ah Ad'))), 1);
  assert.equal(compareZjh(evalZjh(H('As Ah Ad')), special), -1);
  assert.equal(compareZjh(special, evalZjh(H('4s 6h 9d'))), -1, '对上普通单张还是最小');
  assert.equal(compareZjh(special, evalZjh(H('As Ah Ad')), { special235: false }), -1, '房规关掉后不再克豹子');
});

test('texas best-of-seven picks the right five with kickers and split ties', () => {
  const board = H('Ks 7d 2c 9h 9s');
  const twoPair = bestOfSeven([...H('Kd 3c'), ...board]);
  const pair = bestOfSeven([...H('Ah 3d'), ...board]);
  assert.equal(twoPair.name, '两对');
  assert.equal(pair.name, '一对');
  assert.ok(twoPair.score > pair.score);
  const kickA = bestOfSeven([...H('9d Ah'), ...H('9c 4s 5d Jc 8h')]);
  const kickK = bestOfSeven([...H('9h Kd'), ...H('9c 4s 5d Jc 8h')]);
  assert.ok(kickA.score > kickK.score, '同样三条 9，A 踢脚更大');
  const wheel = bestOfSeven(H('As 2d 3c 4h 5s 9c Kd'));
  assert.equal(wheel.name, '顺子');
  const sixHigh = bestOfSeven(H('2s 3d 4c 5h 6s 9c Kd'));
  assert.ok(sixHigh.score > wheel.score, 'A2345 是最小的顺子');
  assert.equal(bestOfSeven(H('2s 7s 9s Js Ks 3d 4c')).name, '同花');
  assert.equal(bestOfSeven(H('2s 2d 2c 7h 7s 9c Kd')).name, '葫芦');
  assert.equal(bestOfSeven(H('Ts Js Qs Ks As 2d 3c')).name, '皇家同花顺');
  const a = bestOfSeven([...H('2d 3c'), ...H('As Ks Qs Js Ts')]);
  const b = bestOfSeven([...H('7d 8c'), ...H('As Ks Qs Js Ts')]);
  assert.equal(a.score, b.score, '公共牌成牌时平分');
});

function table(seed, game, opts = {}) {
  const s = ready(seed, { turn: 8, day: 3, slot: 0, ma: true });
  return { state: s, session: newSession(s, { game, stakes: 'free', controller: opts.controller ?? 'xuan', ...opts }) };
}

test('zjh betting: ante, blind half stake, compare cost and rules, hand cap', () => {
  const { state, session } = table(7, 'zjh');
  startHand(state, session);
  const cur = session.cur;
  assert.equal(cur.pot, 3, '底注每人 1');
  assert.deepEqual(Object.values(session.chips), [9, 9, 9]);
  runAI(state, session);
  assert.equal(cur.turn, 'xuan', 'AI 走完轮到玩家');
  const blindCost = legalActions(session).find((a) => a.id === 'call').cost;
  assert.equal(blindCost, ZJH.stake / 2, '闷牌跟注是明注的一半');
  assert.ok(!legalActions(session).some((a) => a.id === 'compare'), '第一轮不能比牌');
  assert.equal(act(state, session, 'see').error, undefined);
  assert.equal(legalActions(session).find((a) => a.id === 'call').cost, ZJH.stake, '看牌后按明注');
  const before = session.chips.xuan;
  act(state, session, 'call');
  assert.equal(before - session.chips.xuan, ZJH.stake);
  runAI(state, session);
  if (!session.cur.over) {
    const cmp = legalActions(session).find((a) => a.id === 'compare');
    if (cmp) assert.equal(cmp.cost, ZJH.stake * 2, '比牌付当前单注两倍');
  }
});

test('zjh: everyone else folding hands the pot to the last player; equal hands lose the challenge', () => {
  const { state, session } = table(11, 'zjh', { controller: 'ma' });
  startHand(state, session);
  runAI(state, session);
  // 直接把两位 AI 标成弃牌，模拟只剩玩家。
  const cur = session.cur;
  const potBefore = cur.pot;
  for (const id of ['xuan', 'fan']) cur.folded[id] = true;
  act(state, session, 'call');
  assert.equal(cur.over, true);
  assert.equal(cur.winner, 'ma');
  assert.equal(session.chips.ma, 9 - ZJH.stake / 2 + potBefore + ZJH.stake / 2);
  // 平局：主动比牌者败。
  const t2 = table(12, 'zjh', { controller: 'xuan' });
  startHand(t2.state, t2.session);
  const c2 = t2.session.cur;
  c2.hands.xuan = H('9s 9h Ad'); c2.hands.fan = H('9c 9d Ah'); c2.folded.ma = true; c2.round = 2; c2.turn = 'xuan'; c2.seen.xuan = true;
  const r = act(t2.state, t2.session, 'compare', 0, 'fan');
  assert.equal(r.error, undefined);
  assert.equal(c2.folded.xuan, true, '牌完全相同时主动比牌的人出局');
});

test('zjh: after the hand cap only compare or fold remain', () => {
  const { state, session } = table(13, 'zjh');
  startHand(state, session);
  runAI(state, session);
  session.cur.round = ZJH.maxRounds + 1;
  session.cur.seen.xuan = true;
  const ids = legalActions(session).map((a) => a.id);
  assert.deepEqual(ids.filter((x) => x !== 'see').sort(), ['compare', 'fold']);
});

test('texas: blinds, order, min raise, heads-up button posts small blind', () => {
  const { state, session } = table(21, 'texas', { controller: 'xuan' });
  session.dealer = 0;
  startHand(state, session);
  const cur = session.cur;
  assert.equal(cur.streetBets.fan, TEXAS.smallBlind);
  assert.equal(cur.streetBets.ma, TEXAS.bigBlind);
  assert.equal(cur.turn, 'xuan', '三人局翻前庄家先行动');
  const la = legalActions(session);
  assert.equal(la.find((a) => a.id === 'call').cost, 2);
  assert.equal(la.find((a) => a.id === 'raise').min, 4, '最小加注到 4（加注额等于大盲）');
  assert.equal(act(state, session, 'raise', 3).error !== undefined, true, '低于最小加注被拒');
  assert.equal(act(state, session, 'raise', 6).error, undefined);
  assert.equal(cur.lastRaise, 4);
  // 单挑：庄家下小盲并先行动。
  const hu = table(22, 'texas', { controller: 'xuan', players: ['xuan', 'ma'] });
  hu.session.dealer = 0;
  startHand(hu.state, hu.session);
  assert.equal(hu.session.cur.streetBets.xuan, TEXAS.smallBlind);
  assert.equal(hu.session.cur.streetBets.ma, TEXAS.bigBlind);
  assert.equal(hu.session.cur.turn, 'xuan');
});

test('texas: side pots pay the short all-in only from what it covered', () => {
  const { state, session } = table(23, 'texas', { controller: 'xuan' });
  session.chips = { xuan: 3, fan: 10, ma: 10 };
  session.dealer = 0;
  startHand(state, session);
  const cur = session.cur;
  // 轩哥全押 3，另外两人都跟到 10；给定牌面让轩哥赢主池、马哥赢边池。
  cur.hole.xuan = H('As Ad'); cur.hole.fan = H('2c 3d'); cur.hole.ma = H('Kh Kd');
  cur.board = H('7s 8c 9h Jd 4c'); cur.deck = [];
  cur.committed = { xuan: 3, fan: 10, ma: 10 }; cur.streetBets = { xuan: 0, fan: 0, ma: 0 };
  cur.allin.xuan = true; cur.stage = 'river';
  session.chips = { xuan: 0, fan: 0, ma: 0 };
  cur.turn = 'fan'; cur.acted = { fan: true, ma: true };
  act(state, session, 'check');
  if (!cur.over) act(state, session, 'check');
  assert.equal(cur.over, true);
  assert.equal(session.chips.xuan, 9, '主池 3×3');
  assert.equal(session.chips.ma, 14, '边池 7×2 归马哥');
  assert.equal(session.chips.fan, 0);
});

test('ma luck: best-of-two dealing lifts his win share into the target band', () => {
  const s = ready(31, { turn: 8, day: 3, slot: 0, ma: true });
  let maWins = 0, hands = 0;
  for (const game of ['zjh', 'texas']) {
    const session = newSession(s, { game, stakes: 'free', controller: null });
    session.maxHands = 1000;
    for (let i = 0; i < 1000; i++) {
      session.chips = { xuan: 50, fan: 50, ma: 50 };
      startHand(s, session);
      runAI(s, session);
      assert.equal(session.cur.over, true, '全 AI 一手必须自己打完');
      hands++;
      if (session.cur.winners.includes('ma')) maWins++;
    }
  }
  const share = maWins / hands;
  assert.ok(share >= 0.40 && share <= 0.48, `马哥胜率 ${share.toFixed(3)} 应在 0.40–0.48（重发概率 ${MA_LUCK.chance}）`);
});

test('hall session id separates decks', () => {
  const state = { seed: 53, day: 3 };
  const deal = (sessionId) => {
    const session = newSession(state, { game: 'zjh', controller: 'xuan', sessionId });
    startHand(state, session);
    return session;
  };
  const lanTable = deal('cardhall:lan:7');
  const qiaoTable = deal('cardhall:qiao:7');
  const lanReload = JSON.parse(JSON.stringify(lanTable));
  const lanExpectedNext = deal('cardhall:lan:7');
  startHand(state, lanExpectedNext);
  startHand(state, lanReload);

  assert.equal(lanTable.sessionId, 'cardhall:lan:7');
  assert.equal(lanTable.handSeq, 1);
  assert.notDeepEqual(lanTable.cur.deck, qiaoTable.cur.deck, '同日不同牌桌不能共用牌堆');
  assert.deepEqual(lanExpectedNext.cur.deck, lanReload.cur.deck, '同一牌桌载入后要复现下一手牌');
});

test('night seed compatibility and ma luck', () => {
  const state = { seed: 53, day: 3 };
  const night = newSession(state, { game: 'zjh', controller: 'xuan' });
  startHand(state, night);

  assert.equal(night.sessionId, undefined);
  assert.deepEqual(night.cur.deck, [8, 23, 10, 3, 42, 32, 28, 35, 13, 4, 17, 38, 33, 49, 14, 27, 36, 6, 41, 1, 48, 20, 21, 45, 50, 12, 30, 43, 22, 15, 46, 9, 11, 37, 29, 39, 7, 2, 16, 24, 34, 0, 26, 44, 40, 5, 25, 51, 18, 31, 47, 19]);
  assert.deepEqual(night.cur.hands, { xuan: [8, 23, 10], fan: [3, 42, 32], ma: [4, 17, 38] });

  const hall = newSession({ seed: 1, day: 3 }, { game: 'zjh', controller: null, players: ['hall_lan', 'hall_qiao', 'xuan'] });
  startHand({ seed: 1, day: 3 }, hall);
  assert.equal(hall.cur.di, 9, '馆内 NPC 不能被当作马哥获得额外发牌');

  const maTable = newSession({ seed: 1, day: 3 }, { game: 'zjh', controller: null, players: ['hall_lan', 'hall_qiao', 'ma'] });
  startHand({ seed: 1, day: 3 }, maTable);
  assert.equal(maTable.cur.di, 12, '仅精确 ma 参与者在触发概率时获得额外发牌');
});

function nightReady(seed, opts = {}) {
  let s = ready(seed, { turn: 8, day: 3, slot: 0, ma: true });
  for (const id of ['xuan', 'fan', 'ma']) { s.actors[id].location = 'camp'; s.actors[id].energy = 60; s.actors[id].mind = 50; }
  if (!opts.noCards) makeItem(s, 'cards', 'ma');
  s.wishes.push({ uid: 'w_cards', templateId: 'ma_cards', actor: 'ma', category: 'daily', intensity: 60, createdTurn: 0, createdDay: 1, revealed: true, revealTurn: 0, promise: null, declined: false, status: 'active', lastLoss: 0 });
  return s;
}

test('card night: needs ma with a deck, not at the station, once per night; free mode pays mind and wish', () => {
  assert.equal(canCardNight(nightReady(41, { noCards: true })).ok, false);
  let s = nightReady(42);
  s.actors.fan.location = 'station';
  assert.equal(canCardNight(s).ok, false);
  s = nightReady(43);
  let r = startCardNight(s, { game: 'zjh', stakes: 'free', controller: 'ma' });
  assert.equal(r.error, undefined);
  assert.ok(r.state.pending.cards, '会话进入 pending');
  const cur = r.state.pending.cards.cur;
  assert.ok(cur.turn === 'ma' || cur.over, 'AI 走完要么轮到马哥，要么两人都弃牌了');
  const during = startCardNight(r.state, { game: 'zjh', stakes: 'free', controller: 'ma' });
  assert.ok(during.error, '一晚只能开一场');
  const done = finishCardNight(r.state);
  assert.equal(done.state.pending.cards, null);
  assert.equal(done.state.actors.ma.mind, 56);
  assert.equal(done.state.actors.ma.energy, 55);
  assert.equal(done.state.wishes[0].intensity, 30, '免费牌局部分缓解马哥牌桌愿望');
  assert.equal(done.state.cash, s.cash, '免费模式不动现金');
  assert.ok(startCardNight(done.state, { game: 'zjh', stakes: 'free', controller: 'ma' }).error);
});

test('card night: cash mode moves shared cash through buy-ins and back, counts a bet, needs sober', () => {
  let s = nightReady(44);
  s.cash = 100; s.ledger = { start: 100, income: 0, expense: 0 };
  let r = startCardNight(s, { game: 'texas', stakes: 'cash', controller: 'xuan' });
  assert.equal(r.error, undefined);
  assert.equal(r.state.cash, 70);
  assert.equal(r.state.daily.bets, 1);
  let st = r.state;
  let guard = 0;
  while (st.pending.cards && guard++ < 200) {
    const session = st.pending.cards;
    if (session.cur && !session.cur.over) {
      const la = legalActions(session);
      const pick = la.find((a) => a.id === 'check') || la.find((a) => a.id === 'call') || la[0];
      const rr = cardAction(st, pick.id, pick.min || 0);
      assert.equal(rr.error, undefined);
      st = rr.state;
    } else if (!session.done) st = nextHand(st).state;
    else break;
  }
  const fin = finishCardNight(st);
  const total = Object.values(st.pending.cards.chips).reduce((a, b) => a + b, 0);
  assert.equal(fin.state.cash, 70 + total);
  assert.equal(validateSave(fin.state).ok, true, '账本与现金一致');
  assert.equal(fin.state.flags.gambles, 1);
  assert.equal(fin.state.wishes[0].intensity, 0, '真钱牌局完整回应愿望');
  const drunk = nightReady(45);
  drunk.actors.ma.intox = 1;
  assert.ok(startCardNight(drunk, { game: 'zjh', stakes: 'cash', controller: 'xuan' }).error);
  const capped = nightReady(46);
  capped.daily.bets = 2;
  assert.ok(startCardNight(capped, { game: 'zjh', stakes: 'cash', controller: 'xuan' }).error);
});

test('card night: autoResolvePending closes the table without playing', () => {
  const s = nightReady(47);
  const r = startCardNight(s, { game: 'zjh', stakes: 'free', controller: 'fan' });
  const auto = autoResolvePending(r.state);
  assert.equal(auto.state.pending.cards, null);
  assert.equal(auto.state.actors.fan.mind, 56);
});

test('ma joins with a deck of cards', () => {
  const s = ready(51, { turn: 3, day: 1, slot: 3 });
  s.hour = 18;
  s.phase = 'meeting';
  assert.equal(s.hour, 18);
  const r = meet(s, 0);
  assert.equal(r.error, undefined);
  assert.ok(r.state.items.some((x) => x.itemId === 'cards' && x.container === 'ma'));
});
