import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import {
  active, activeWishes, alive, assign, buyNow, careOptions, copy, directorTick,
  autoResolvePending, begStep, eventChoice, fresh, meet, morningChoice, passersby, reserve, respond, setCare,
} from '../public/game/engine.js';
import { preflight, settle } from '../public/game/settle.js';
import { claimTicket, scratchTicket } from '../public/game/shop.js';
import { verifyFace } from '../public/game/tickets.js';
import { addDisease, careMatches, nightExposure } from '../public/game/health.js';
import { generateMorningWishes, tickWishes } from '../public/game/wishes.js';
import { filmName } from '../public/game/screening.js';
import { makeItem } from '../public/game/items.js';
import { fuelCount } from '../public/game/camp.js';
import { placeFurniture } from '../public/game/furniture.js';
import { bareTask, down, plan, ready, restCurrent, wish } from './engine-fixtures.js';

before(async () => {
  await loadData();
});

function atomicFailure(s, pattern, actorId) {
  const beforeState = copy(s);
  const r = settle(s);
  assert.match(r.error, pattern);
  assert.deepEqual(r.state, beforeState);
  assert.deepEqual(s, beforeState);
  assert.equal(JSON.stringify(r.state), JSON.stringify(beforeState));
  assert.deepEqual(r.at, { actorId, hour: s.hour });
}

const preflightCases = [
  ['cash', 101, /现金不足/, 'xuan', (s) => { s.cash = 0; return plan(s, 'xuan', 'roof', { participants: ['xuan', 'fan'] }); }],
  ['energy', 102, /体力不足/, 'xuan', (s) => { s.actors.xuan.energy = 0; return plan(s, 'xuan', 'scavenge'); }],
  ['complex mind', 103, /精神不足20/, 'xuan', (s) => { s.actors.xuan.mind = 19; return plan(s, 'xuan', 'table'); }],
  ['intoxicated gambling', 104, /有醉意/, 'xuan', (s) => {
    s.actors.xuan.intox = 1;
    s.events.push({ uid: 'cards', templateId: 'street_cards', status: 'reserved', reserved: { actorId: 'xuan', choiceId: 'join_paid', kind: 'book' }, expiresTurn: 9 });
    return plan(s, 'xuan', 'cards', { eventUid: 'cards', zone: 'station' });
  }],
  ['unique computer', 105, /唯一电脑同槽被重复占用/, 'fan', (s) => plan(plan(s, 'xuan', 'table'), 'fan', 'edit')],
  ['daily job limit', 106, /岗位.*已用完/, 'xuan', (s) => { s.daily.orders.scavenge = 3; return plan(s, 'xuan', 'scavenge'); }],
];

for (const [name, seed, pattern, actorId, arrange] of preflightCases) {
  test(`preflight ${name} failure is atomic and locates the actor and slot`, () => {
    atomicFailure(arrange(ready(seed, { turn: 4, slot: 0 })), pattern, actorId);
  });
}

test('hourly clock reaches the evening meeting and one night settlement', () => {
  let s = fresh(201);
  assert.deepEqual([s.turn, s.hour, s.day], [0, 6, 1]);
  s.pendingMorning = null;
  let r;
  for (let i = 0; i < 12; i++) { r = settle(s); assert.equal(r.error, undefined, r.error); s = r.state; }
  assert.deepEqual([s.turn, s.hour, s.day, s.phase], [3, 18, 1, 'meeting']);
  s = meet(s, 0).state;
  assert.equal(s.actors.ma.life, 'active');
  assert.equal(s.actors.ma.joinedTurn, 4);
  for (let i = 0; i < 4; i++) { r = settle(s); assert.equal(r.error, undefined, r.error); s = r.state; }
  assert.deepEqual([s.turn, s.hour, s.day], [4, 6, 2]);
  assert.ok(r.night);
});

test('downed deadlines, Ma grit, death records, relics, aid, and rescue follow the lifecycle', () => {
  let s = ready(301, { turn: 4, slot: 0 });
  s.actors.xuan.health = 1;
  s.actors.xuan.food = 0;
  s.actors.xuan.warmth = 100;
  s.items.find((x) => x.itemId === 'lighter').container = 'xuan';
  s = plan(s, 'xuan', 'wash');
  let r = settle(s);
  assert.equal(r.state.actors.xuan.life, 'downed');
  assert.equal(r.state.actors.xuan.deadline, 6);
  s = r.state;
  for (let i = 0; i < 4; i++) { r = settle(s); s = r.state; }
  assert.equal(r.state.actors.xuan.life, 'dead');
  assert.ok(r.state.deaths.some((x) => x.id === 'xuan'));
  assert.ok(r.state.items.some((x) => x.container === 'relic:xuan'));

  s = ready(302, { turn: 4, slot: 0, ma: true });
  s.actors.ma.health = 1;
  s.actors.ma.food = 0;
  s.actors.ma.warmth = 100;
  s = plan(s, 'ma', 'wash');
  for (let i = 0; i < 4; i++) { r = settle(s); s = r.state; }
  assert.equal(r.state.actors.ma.deadline, 7);
  assert.equal(r.state.actors.ma.gritUsed, true);
  s = r.state;
  s.actors.ma.life = 'active';
  s.actors.ma.health = 1;
  s.actors.ma.deadline = null;
  s.items = s.items.filter((x) => !['meal', 'bread', 'hot_soup'].includes(x.itemId));
  s.pendingMorning = null;
  s = plan(s, 'ma', 'wash');
  r = settle(s);
  assert.equal(r.state.actors.ma.deadline, 7);

  s = ready(303, { turn: 4, slot: 0 });
  down(s, 'xuan', 7);
  s.actors.xuan.mind = 0;
  s = plan(s, 'xuan', 'aid');
  r = settle(s);
  assert.equal(r.state.vouchers, 0);
  assert.equal(r.state.actors.xuan.health, 25);
  assert.ok(r.state.actors.xuan.mind >= 20);

  s = ready(304, { turn: 4, slot: 0 });
  down(s, 'xuan', 7);
  const cash = s.cash;
  s = plan(s, 'fan', 'rescue', { participants: ['fan', 'xuan'], target: 'xuan' });
  r = settle(s);
  assert.equal(r.state.cash, cash - 12);
  assert.equal(r.state.actors.xuan.health, 25);
});

test('teaching protection covers T1 through T3 and ends at T4', () => {
  for (let turn = 0; turn <= 3; turn++) {
    let s = ready(401 + turn, { turn, day: 1, slot: turn });
    s.actors.xuan.health = 1;
    s.actors.xuan.food = 0;
    s.actors.xuan.warmth = 100;
    s.items = s.items.filter((x) => !['meal', 'bread', 'hot_soup'].includes(x.itemId));
    s = plan(s, 'xuan', 'wash');
    const r = settle(s);
    assert.equal(r.state.actors.xuan.life, turn <= 2 ? 'active' : 'downed');
    if (turn <= 2) assert.equal(r.state.actors.xuan.health, 1);
  }
});

test('ticket purchase locks payout and face, charges one quota, and claims once', () => {
  let s = ready(260916, { turn: 5, slot: 1 });
  s.actors.xuan.location = 'market';
  const bought = buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'ticket', qty: 2 }]);
  assert.equal(bought.state.daily.bets, 1);
  for (const item of bought.made) assert.equal(verifyFace(item.ticket.face), item.ticket.payout);
  const ticket = bought.made[0];
  const payout = ticket.ticket.payout;
  assert.ok(payout > 0);
  const scratchedState = copy(bought.state);
  assert.equal(scratchTicket(scratchedState, ticket.uid).payout, payout);
  assert.equal(scratchedState.items.find((x) => x.uid === ticket.uid).ticket.payout, payout);
  const beforeCash = scratchedState.cash;
  const first = claimTicket(scratchedState, 'xuan', ticket.uid);
  assert.equal(first.payout, payout);
  assert.equal(scratchedState.cash, beforeCash + payout);
  assert.ok(claimTicket(scratchedState, 'xuan', ticket.uid).error);
  assert.equal(scratchedState.cash, beforeCash + payout);
});

test('ticket and shopping validation enforce quota, sobriety, reserve, district, hours, and stock', () => {
  let s = ready(601, { turn: 5, slot: 1 });
  s.actors.xuan.location = 'market';
  s.daily.bets = 2;
  assert.match(buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'ticket', qty: 1 }]).error, /博彩已达2次/);
  s.daily.bets = 0;
  s.actors.xuan.intox = 1;
  assert.match(buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'ticket', qty: 1 }]).error, /醉意/);
  s.actors.xuan.intox = 0;
  s.items = s.items.filter((x) => x.itemId !== 'meal');
  s.cash = reserve(s) + 4;
  assert.match(buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'ticket', qty: 1 }]).error, /预留的饭钱/);
  s.cash = 200;
  s.actors.xuan.location = 'station';
  assert.match(buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'meal', qty: 1 }]).error, /不在station街区/);
  s.slot = 0;
  assert.match(buyNow(s, 'xuan', [{ shopId: 'lottery_kiosk', itemId: 'ticket', qty: 1 }]).error, /不营业/);

  s = ready(602, { turn: 5, slot: 1 });
  s.cash = 200;
  s.actors.xuan.location = 'market';
  assert.match(buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'keyboard', qty: 1 }]).error, /不卖/);
  s.actors.xuan.location = 'recycle';
  const bought = buyNow(s, 'xuan', [{ shopId: 'recycle_shop', itemId: 'keyboard', qty: 1 }]);
  assert.equal(bought.state.shops.recycle_shop.soldOut.keyboard, bought.state.day + 8);
  bought.state.actors.fan.location = 'recycle';
  assert.match(buyNow(bought.state, 'fan', [{ shopId: 'recycle_shop', itemId: 'keyboard', qty: 1 }]).error, /库存不足/);
});

test('ticket claim requires its holder at an open lottery shop', () => {
  let s = ready(603, { turn: 5, slot: 1 });
  s.actors.xuan.location = 'market';
  const bought = buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'ticket', qty: 1 }]);
  const ticket = bought.made[0];
  const state = copy(bought.state);
  scratchTicket(state, ticket.uid);
  state.actors.xuan.location = 'recycle';
  assert.match(claimTicket(state, 'xuan', ticket.uid).error, /售票点/);
  state.actors.xuan.location = 'station';
  state.slot = 0;
  assert.match(claimTicket(state, 'xuan', ticket.uid).error, /售票点/);
  state.actors.xuan.location = 'market';
  state.slot = 1;
  assert.equal(claimTicket(state, 'xuan', ticket.uid).payout, ticket.ticket.payout);
});

test('begging shares each NPC result across the team and caps refusal loss per actor', () => {
  let s = ready(260916, { turn: 5, day: 1, slot: 1 });
  const ids = passersby(s, 'market', 1).slice(0, 3).map((x) => x.id);
  s = plan(s, 'xuan', 'beg', { zone: 'market', targets: ids });
  s = plan(s, 'fan', 'beg', { zone: 'market', targets: ids });
  // 开口求助现在是交互式对话；这里用自动处理走完，只验"同一路人全队只问一次"与精神上限。
  let r = settle(s);
  r = autoResolvePending(r.state);
  assert.equal(Object.keys(r.state.daily.begged).length, 3);
  assert.ok(ids.every((id) => r.state.daily.begged[id] === 'xuan'));
  assert.ok((r.state.daily.refusalLoss.xuan || 0) <= 2);
  assert.equal(r.state.daily.refusalLoss.fan || 0, 0);
  s = restCurrent(r.state);
  const more = passersby(s, 'market', s.slot).slice(0, 3).map((x) => x.id);
  s = plan(s, 'xuan', 'beg', { zone: 'market', targets: more });
  const mind = s.actors.xuan.mind;
  let second = settle(s);
  second = autoResolvePending(second.state);
  assert.ok((second.state.daily.refusalLoss.xuan || 0) <= 2, '被拒精神损失每日上限 2');
  assert.ok(second.state.actors.xuan.mind >= mind - 2, '第二轮最多再扣到上限');
});

test('morning wishes enforce count/category limits, pressure cap, and one-time responses', () => {
  let s = ready(701, { turn: 32, day: 9, slot: 0, ma: true });
  for (let day = 9; day <= 30; day++) {
    s.day = day;
    generateMorningWishes(s, []);
  }
  for (const id of active(s)) {
    const list = activeWishes(s, id);
    assert.ok(list.length > 0 && list.length <= 3);
    assert.equal(new Set(list.map((w) => w.templateId)).size, list.length);
  }
  s.wishes = [wish('w-threshold', 'xuan', 'daily', 60)];
  assert.equal(tickWishes(s, 'xuan').pressure, 1);
  s.wishes = [wish('w-a', 'xuan', 'daily', 100), wish('w-b', 'xuan', 'comfort', 100), wish('w-c', 'xuan', 'personal', 100)];
  assert.equal(tickWishes(s, 'xuan').pressure, 3);
  let r = respond(s, 'w-a', 'promise');
  assert.ok(!r.error);
  assert.match(respond(r.state, 'w-a', 'promise').error, /只能延期一次/);
  r = respond(s, 'w-a', 'decline');
  const mind = r.state.actors.xuan.mind;
  assert.equal(mind, s.actors.xuan.mind - 2);
  const twice = respond(r.state, 'w-a', 'decline');
  assert.ok(twice.error);
  assert.equal(twice.state.actors.xuan.mind, mind);
});

test('four survival ticks drive zero mind into crisis and eight health damage', () => {
  let s = ready(702, { turn: 4, day: 2, slot: 0 });
  s.actors.xuan.mind = 0; s.actors.xuan.health = 8;
  s.actors.xuan.food = 100; s.actors.xuan.warmth = 100;
  s.wishes = [wish('w-crisis-a', 'xuan', 'daily', 100), wish('w-crisis-b', 'xuan', 'comfort', 100), wish('w-crisis-c', 'xuan', 'personal', 100)];
  for (let i = 0; i < 16; i++) {
    s.pendingMorning = null;
    s.plan.xuan[s.hour - 6] = null;
    const beforeHealth = s.actors.xuan.health;
    const r = settle(s); assert.equal(r.error, undefined, r.error); s = r.state;
    if (i === 12) assert.equal(s.actors.xuan.health, beforeHealth - 8);
  }
  assert.equal(s.actors.xuan.crisis, true);
  assert.equal(s.actors.xuan.zeroTurns, 4);
});

test('disease progression, reachable care, clinic plans, and care_course matching integrate', () => {
  let s = ready(801, { turn: 4, slot: 0 });
  const disease = addDisease(s, 'xuan', 'skin', 20, '测试', []);
  s = plan(s, 'xuan', 'wash');
  let r = settle(s);
  assert.equal(r.state.actors.xuan.diseases[0].severity, 23);

  s = ready(802, { turn: 4, slot: 0 });
  const d = addDisease(s, 'xuan', 'skin', 20, '测试', []);
  s.items.push({ uid: 'care-1', itemId: 'cleaning_care', container: 'xuan', uses: 1, wet: false, dirty: false, expiresDay: null });
  s = plan(s, 'xuan', 'wash');
  const option = careOptions(s, 'xuan', s.hour).find((x) => x.itemUid === 'care-1');
  s = setCare(s, 'xuan', s.hour, option).state;
  r = settle(s);
  assert.equal(r.state.actors.xuan.diseases[0].severity, 16);

  s = ready(803, { turn: 4, slot: 0 });
  addDisease(s, 'xuan', 'skin', 20, '测试', []);
  s.items.push({ uid: 'camp-care', itemId: 'cleaning_care', container: 'camp', uses: 1, wet: false, dirty: false, expiresDay: null });
  s = plan(s, 'xuan', 'wash');
  assert.ok(!careOptions(s, 'xuan', s.hour).some((x) => x.itemUid === 'camp-care'));

  s = ready(804, { turn: 4, slot: 0 });
  const unknown = addDisease(s, 'xuan', 'gut', 20, '测试', []);
  assert.equal(careMatches(unknown, 'care_course'), false);
  s = plan(s, 'xuan', 'clinic');
  r = settle(s);
  assert.equal(r.state.actors.xuan.diseases[0].known, true);
  assert.equal(r.state.actors.xuan.diseases[0].plan, true);
  assert.equal(careMatches(r.state.actors.xuan.diseases[0], 'care_course'), true);
});

test('eight consecutive critical-hygiene survival ticks guarantee a skin infection', () => {
  let s = ready(7, { turn: 4, day: 2, slot: 0 });
  s.actors.xuan.hygiene = 4; s.actors.xuan.immune = { skin: 0 };
  let ticks = 0;
  for (let hour = 0; hour < 32; hour++) {
    s.pendingMorning = null;
    s.plan.xuan[s.hour - 6] = null;
    s.actors.xuan.hygiene = Math.min(s.actors.xuan.hygiene, 4);
    const r = settle(s); assert.equal(r.error, undefined, r.error); s = r.state;
    if (r.state.turn > 4 + ticks) {
      ticks++;
      if (ticks < 8) assert.ok(!s.actors.xuan.diseases.some((d) => d.cause === '极端污秽持续8回合'));
    }
  }
  assert.ok(s.actors.xuan.diseases.some((d) => d.kind === 'skin' && d.cause === '极端污秽持续8回合'));
});

test('a new night down has the following morning to receive aid', () => {
  let s = ready(902, { turn: 7, day: 2, slot: 3 });
  s.actors.xuan.health = 7;
  s.actors.xuan.food = 20;
  s.actors.xuan.warmth = 100;
  s.items = s.items.filter((x) => !['meal', 'bread', 'hot_soup'].includes(x.itemId));
  s = plan(s, 'xuan', 'shop', { zone: 'market' });
  const r = settle(s);
  assert.equal(r.state.actors.xuan.life, 'downed');
  assert.equal(r.state.actors.xuan.downedAt, 8);
  assert.equal(r.state.actors.xuan.deadline, 9);
  assert.equal(r.state.day, 3);
  assert.equal(r.state.slot, 0);
});

test('day 100 enters rescue-only tail, stays under turn 402, then produces an ending', () => {
  let s = ready(903, { turn: 399, day: 100, slot: 3 });
  s.actors.xuan.health = 7;
  s.actors.xuan.food = 20;
  s.actors.xuan.warmth = 100;
  s = plan(s, 'xuan', 'shop', { zone: 'market' });
  let r = settle(s);
  assert.equal(r.state.phase, 'tail');
  assert.equal(r.state.turn, 400);
  const invalid = copy(r.state);
  invalid.plan.fan[0] = bareTask('scavenge', 'fan');
  assert.match(preflight(invalid).error, /尾声回合只处理救援/);
  const tail = copy(r.state);
  tail.plan.xuan[0] = bareTask('aid', 'xuan');
  r = settle(tail);
  assert.equal(r.state.phase, 'ending');
  assert.ok(r.state.turn <= 402);
  assert.equal(typeof r.state.ending.title, 'string');
  assert.ok(Array.isArray(r.state.ending.lines));
});

test('the public scheduler accepts rescue actions during tail', () => {
  const s = ready(904, { turn: 400, day: 100, slot: 0 });
  down(s, 'xuan', 402);
  s.phase = 'tail';
  s.hour = 22; s.slot = 3;
  const r = assign(s, 'xuan', 22, 'aid');
  assert.equal(r.error, undefined);
});

test('all-downed parties can still use aid without an active companion', () => {
  let s = ready(905, { turn: 4, slot: 0 });
  down(s, 'xuan', 7);
  down(s, 'fan', 7);
  s = plan(s, 'xuan', 'aid');
  s = plan(s, 'fan', 'wait');
  const r = settle(s);
  assert.equal(r.state.actors.xuan.life, 'active');
  assert.equal(r.state.actors.xuan.health, 25);
});

test('dead actors leave alive and active sets, lose future slots, and leave passersby', () => {
  let s = ready(260916, { turn: 5, slot: 1 });
  down(s, 'xuan', 6);
  s = plan(s, 'xuan', 'wait');
  const r = settle(s);
  s = r.state;
  assert.ok(!alive(s).includes('xuan'));
  assert.ok(!active(s).includes('xuan'));
  assert.ok(s.plan.xuan.slice(s.slot).every((x) => x === null));
  assert.ok(!passersby(s, 'market', s.slot).some((x) => x.id === 'xuan'));
});

test('death removes an actor from already spawned event casts', () => {
  let s = ready(260916, { turn: 0, day: 1, slot: 0 });
  assert.ok(s.events.some((e) => e.status === 'open' && e.cast?.includes('xuan')));
  down(s, 'xuan', 1);
  s = plan(s, 'xuan', 'wait');
  s = settle(s).state;
  assert.ok(s.events.filter((e) => ['open', 'reserved'].includes(e.status)).every((e) => !e.cast?.includes('xuan')));
});

test('a dead actor cannot choose an otherwise valid event option', () => {
  const s = ready(906, { turn: 20, day: 6, slot: 1 });
  s.actors.xuan.life = 'dead';
  s.day = 6;
  s.slot = 1;
  s.events = [];
  directorTick(s, []);
  assert.ok(s.events.every((e) => !e.cast?.includes('xuan')));
  const ev = s.events.find((e) => e.templateId === 'street_cards');
  assert.match(eventChoice(s, ev.uid, 'leave', 'xuan').error, /可行动/);
});

test('director events expire after two turns and booked cards reopen when reassigned', () => {
  let s = ready(1001, { turn: 20, day: 6, slot: 1, ma: true });
  s.events = [];
  directorTick(s, []);
  const ev = s.events.find((x) => x.templateId === 'street_cards');
  assert.equal(ev.expiresTurn, ev.spawnedTurn + 2);
  const booked = eventChoice(s, ev.uid, 'join_paid', 'ma');
  assert.ok(!booked.error);
  s = booked.state;
  assert.equal(s.plan.ma[s.hour - 6].id, 'cards');
  assert.equal(s.plan.ma[s.hour - 6].eventUid, ev.uid);
  s = plan(s, 'ma', 'rest');
  assert.equal(s.events.find((x) => x.uid === ev.uid).status, 'open');
  s.turn = ev.spawnedTurn + 2;
  directorTick(s, []);
  assert.equal(s.events.find((x) => x.uid === ev.uid).status, 'expired');
});

test('JSON roundtrips and repeated settlement stay deterministic for a seed', () => {
  const s = ready(1101, { turn: 4, slot: 0 });
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(settle(restored), settle(s));
  assert.deepEqual(settle(copy(s)), settle(copy(s)));
});

test('night top-up meal recovers a missed meal instead of looping at a deficit', () => {
  // 两餐 60 对一天 50 的消耗留 10 余量；睡前饱食≤30 且有余粮时再补一餐，缺餐不会永远追不回。
  let s = ready(31, { turn: 7, day: 2, slot: 3 });
  s.actors.xuan.food = 24;
  for (let i = 0; i < 6; i++) { s.itemSeq += 1; s.items.push({ uid: 'meal' + i, itemId: 'meal', container: 'camp', uses: 1, obtainedTurn: s.turn, expiresDay: s.day + 1, wet: false, dirty: false }); }
  let r = settle(s);
  assert.equal(r.error, undefined, r.error);
  // 小缺口靠每日 +10 的余量自己回来：24 → 14 → 44（晚餐）→ 34（夜间）。
  assert.equal(r.state.actors.xuan.food, 34, '小缺口应按余量回升');
  // 大缺口触发睡前补餐：8 → 0 → 30 → 20 ≤ 30 → 再吃一份 → 50。
  s = ready(32, { turn: 7, day: 2, slot: 3 });
  s.actors.xuan.food = 8;
  for (let i = 0; i < 6; i++) { s.itemSeq += 1; s.items.push({ uid: 'meal' + i, itemId: 'meal', container: 'camp', uses: 1, obtainedTurn: s.turn, expiresDay: s.day + 1, wet: false, dirty: false }); }
  const before = s.items.filter((x) => x.itemId === 'meal').length;
  r = settle(s);
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.state.actors.xuan.food, 50, '大缺口应睡前补一餐');
  assert.ok(r.events.some((e) => e.includes('睡前又吃了一份')), '应记录睡前补餐');
  assert.ok(r.state.items.filter((x) => x.itemId === 'meal').length <= before - 3, '补餐要真的消耗库存');
});

test('night exposure needs a matching exposure source before it can roll a disease', () => {
  // 策划 §9.2：病种必须符合暴露标签；干净且无暴露的人不会凭基础概率凭空得病。
  const s = ready(41);
  s.actors.xuan.hygiene = 80;
  s.actors.xuan.exposure = { dirtyFood: false, wound: false, woundCovered: false, cared: false };
  for (let day = 1; day <= 60; day++) { s.day = day; nightExposure(s, 'xuan', []); }
  assert.equal(s.actors.xuan.diseases.length, 0, '无暴露来源不应染病');
  s.actors.xuan.exposure = { dirtyFood: true, wound: false, woundCovered: false, cared: false };
  let got = false;
  for (let day = 61; day <= 260 && !got; day++) { s.day = day; s.actors.xuan.exposure.dirtyFood = true; nightExposure(s, 'xuan', []); got = s.actors.xuan.diseases.some((d) => d.kind === 'gut'); }
  assert.ok(got, '不洁食物暴露下最终应得到肠胃不适而不是别的病');
});

test('a single camp blanket only warms one sleeper', () => {
  // 策划 §11：毯子是个人寝具，分配后改善睡眠与保暖；营地箱一条不能同时给三个人加成。
  const make = (seed) => { let s = ready(seed, { turn: 7, day: 2, slot: 3, ma: true }); for (const slot of ['west_1', 'west_2', 'west_3']) { const bed = makeItem(s, 'legacy_bed', 'camp'); s = placeFurniture(s, 'xuan', bed.uid, slot).state; } s.camp.rain = 2; for (const id of ['xuan', 'fan', 'ma']) { s.actors[id].warmth = 50; s.actors[id].energy = 40; } return restCurrent(s); };
  const none = settle(make(11)).state;
  const one = make(11);
  one.itemSeq += 1; one.items.push({ uid: 'blk1', itemId: 'blanket', container: 'camp', uses: 1, obtainedTurn: 7, expiresDay: null, wet: false, dirty: false });
  const withOne = settle(one).state;
  const gained = ['xuan', 'fan', 'ma'].filter((id) => withOne.actors[id].warmth > none.actors[id].warmth);
  assert.equal(gained.length, 1, '一条毯子只应让一个人更暖，实际 ' + gained.join(','));
});

test('interactive begging: openings change patience, asks resolve once, finish caps refusal loss', () => {
  let s = ready(77, { turn: 5, day: 2, slot: 1 });
  const ids = passersby(s, 'station', 1).slice(0, 3).map((x) => x.id);
  s = plan(s, 'xuan', 'beg', { zone: 'station', targets: ids, style: 'ask' });
  const r = settle(s, { controlledActorId: 'xuan' });
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.state.pending.beg.length, 1, '开口求助应产生一场待处理对话');
  assert.ok(r.arrivals.some((a) => a.kind === 'beg'), '结算应返回对话到场');
  assert.ok(ids.every((id) => r.state.pending.beg[0].npcs.some((n) => n.id === id)), '三位目标都在场');
  assert.equal(preflight(r.state).error.includes('没处理完'), true, '有待处理对话时不能推进');
  let st = r.state;
  const cashBefore = st.cash;
  for (const n of st.pending.beg[0].npcs) {
    let x = begStep(st, 0, n.id, 'open', 'special'); assert.equal(x.error, undefined, x.error); st = x.state;
    const cur = st.pending.beg[0].npcs.find((y) => y.id === n.id);
    if (cur.stage === 'ask') { x = begStep(st, 0, n.id, 'ask', 'cash'); assert.equal(x.error, undefined, x.error); st = x.state; }
    const again = begStep(st, 0, n.id, 'ask', 'cash');
    assert.ok(again.error, '同一位路人不能开口两次');
  }
  const fin = begStep(st, 0, null, 'finish');
  assert.equal(fin.error, undefined, fin.error);
  st = fin.state;
  assert.equal(st.pending.beg.length, 0, '收工后待处理清空');
  assert.ok((st.daily.refusalLoss.xuan || 0) <= 2, '被拒精神损失每日上限 2');
  assert.equal(st.ledger.start + st.ledger.income - st.ledger.expense, st.cash, '账本与现金一致');
  assert.ok(st.cash >= cashBefore, '现金不会因对话减少');
  assert.equal(preflight(st).error, undefined, '收工后可以继续推进');
});

test('editing three clips records a named film; camp tv screens it at night once, then reruns after the gap', () => {
  // 短片有来历：三段素材剪成一部，片名按素材来历取；营地有电视、有燃料就在夜里放，首映后隔五天才重播。
  let s = ready(41, { turn: 6, day: 2, slot: 2 });
  s.clips = [{ day: 1, source: '街头', turn: 1 }, { day: 1, source: '旧影院的采访', turn: 2 }, { day: 2, source: '街头', turn: 5 }];
  s.footage = 3;
  s = plan(s, 'fan', 'edit');
  s = settle(s).state;
  assert.equal(s.films.length, 1);
  assert.deepEqual(s.films[0].sources, ['D1街头', 'D1旧影院的采访', 'D2街头']);
  assert.equal(filmName(s.films[0]), '《旧影院的人》');
  // 没有电视：夜里不放。
  let night = ready(42, { turn: 7, day: 2, slot: 3 });
  night.films = [{ no: 1, day: 2, sources: ['D1街头', 'D1街头', 'D2街头'], screened: 0, lastDay: 0 }];
  night.wood = 4;
  makeItem(night, 'charcoal_smokeless', 'camp').uses = 4;
  assert.equal(settle(night).night.screening, null);
  // 有电视：首映，凡哥 +8、其他人 +4，烧 1 单位燃料，愿望「有人看完」达成。
  const control = settle(night).state;
  makeItem(night, 'tv', 'camp');
  const fuelBefore = fuelCount(night);
  const r = settle(night);
  assert.ok(r.night.screening, '应有放映场面');
  assert.equal(r.night.screening.premiere, true);
  assert.equal(r.night.screening.title, '《街头》');
  assert.ok(r.night.screening.lines.length >= 2);
  assert.equal(r.state.films[0].screened, 1);
  assert.equal(r.state.flags.screenings, 1);
  // 篝火普通夜烧 2，放映再烧 1。
  assert.equal(fuelBefore - fuelCount(r.state), 3);
  assert.equal(r.state.wood, night.wood);
  assert.equal(r.state.actors.fan.mind - control.actors.fan.mind, 8, '凡哥比无电视的对照多 +8');
  assert.equal(r.state.actors.xuan.mind - control.actors.xuan.mind, 4, '其他人比对照多 +4');
  assert.equal(r.state.flags.lastScreeningDay, 2);
  // 第二晚同一部不重播（间隔不够）。
  let again = ready(43, { turn: 11, day: 3, slot: 3 });
  again.films = [{ no: 1, day: 2, sources: ['D1街头'], screened: 1, lastDay: 2 }];
  again.flags.lastScreeningDay = 2;
  again.wood = 4;
  makeItem(again, 'charcoal_smokeless', 'camp').uses = 4;
  makeItem(again, 'tv', 'camp');
  assert.equal(settle(again).night.screening, null);
  again.day = 7; again.turn = 27;
  again = restCurrent(again);
  const rerun = settle(again);
  assert.ok(rerun.night.screening);
  assert.equal(rerun.night.screening.premiere, false);
  assert.equal(rerun.night.screening.gains.fan, 3);
  // 许姐场地和营地共用间隔：前天在工作间放过，营地今晚就不放。
  let shared = ready(46, { turn: 11, day: 3, slot: 3 });
  shared.films = [{ no: 1, day: 2, sources: ['D1街头'], screened: 0, lastDay: 0 }];
  shared.flags.lastScreeningDay = 1;
  shared.wood = 4;
  makeItem(shared, 'charcoal_smokeless', 'camp').uses = 4;
  makeItem(shared, 'tv', 'camp');
  assert.equal(settle(shared).night.screening, null);
});

test('camp screening needs fuel and skips storm nights and rescues', () => {
  let s = ready(44, { turn: 7, day: 2, slot: 3 });
  s.films = [{ no: 1, day: 2, sources: ['D1街头'], screened: 0, lastDay: 0 }];
  makeItem(s, 'tv', 'camp');
  // 篝火先把 2 单位烧掉，放映没燃料就不放。
  s.wood = 2; s.cardboard = 0;
  makeItem(s, 'charcoal_smokeless', 'camp').uses = 2;
  const dry = settle(s);
  assert.equal(dry.night.screening, null);
  assert.ok(dry.events.some((e) => e.includes('没燃料')));
  // 有人濒死：不放。
  let rescue = ready(45, { turn: 7, day: 2, slot: 3 });
  rescue.films = [{ no: 1, day: 2, sources: ['D1街头'], screened: 0, lastDay: 0 }];
  makeItem(rescue, 'tv', 'camp');
  rescue.wood = 6;
  makeItem(rescue, 'charcoal_smokeless', 'camp');
  rescue = down(rescue, 'xuan', rescue.turn + 3);
  rescue = plan(rescue, 'xuan', 'wait');
  const rr = settle(rescue);
  assert.equal(rr.error, undefined);
  assert.equal(rr.night.screening, null);
});
