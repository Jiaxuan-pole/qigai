import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, morningChoice, eventChoice, assign, copy } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { morningNode, applyMorningChoice, PAID_EVENT_COST as P } from '../public/game/story.js';
import { pickHeadline, nodeFor, windowLabel, HEADLINE_MIN_DAY } from '../public/game/headlines.js';
import { POOL, LAND_FEE_RETURN } from '../public/game/headline-pool.js';
import { directorTick } from '../public/game/events.js';
import { relation } from '../public/game/npcs.js';
import { objectives } from '../public/game/objectives.js';

before(loadData);

// 构造某一天清晨的状态：只动日期、回合、现金与马哥在队情况，其余保持 fresh。
function at(day, { seed = 900, cash = 300, ma = true } = {}) {
  const s = fresh(seed);
  s.day = day; s.turn = (day - 1) * 4; s.hour = 6; s.slot = 0;
  if (ma) { s.actors.ma.life = 'active'; s.metMa = true; }
  s.cash = cash; s.ledger = { start: cash, income: 0, expense: 0 };
  s.pendingMorning = null;
  return s;
}
const alive = (s) => Object.keys(s.actors).filter((id) => s.actors[id].life === 'active');
const minds = (s) => Object.fromEntries(alive(s).map((id) => [id, s.actors[id].mind]));
const idle = (s) => { for (const id of Object.keys(s.plan)) s.plan[id] = Array(16).fill(null); return s; };
const step = (s) => { const r = settle(s); assert.equal(r.error, undefined, r.error); return r.state; };

test('前三天不抽今日事；第五天起非剧本日的清晨节点就是今日事，且由种子和日期决定', () => {
  for (const day of [1, 2, 3]) assert.equal(pickHeadline(at(day)), null, `D${day}`);
  assert.ok(HEADLINE_MIN_DAY <= 5);
  const seen = new Set();
  for (let seed = 900; seed < 930; seed++) {
    const s = at(5, { seed });
    const node = morningNode(s);
    assert.ok(node?.headlineId, `seed ${seed} 应有今日事`);
    assert.ok(node.title && node.text && node.choices.length >= 2);
    assert.equal(morningNode(at(5, { seed })).headlineId, node.headlineId, '同种子同日期抽到同一件事');
    seen.add(node.headlineId);
  }
  assert.ok(seen.size >= 2, '不同种子应抽到不同的事');
  assert.equal(morningNode(at(9)).headlineId, undefined, 'D9 是剧本日，走占地费节点');
});

test('晨间选项通过 morningChoice 生效、记冷却，存档往返后 requires 仍由池子校验', () => {
  const s = at(6);
  s.pendingMorning = nodeFor(s, 'wallet_found');
  const before = { cash: s.cash, mind: minds(s) };
  const r = morningChoice(s, 'keep');
  assert.equal(r.error, undefined);
  assert.equal(r.state.cash, before.cash + 30);
  for (const id of alive(s)) assert.equal(r.state.actors[id].mind, Math.max(0, before.mind[id] - 2));
  assert.equal(r.state.flags.headline.id, 'wallet_found');
  assert.ok(r.state.flags.headlineCooldown.wallet_found > 6, '选完记冷却');
  assert.equal(r.state.pendingMorning, null);
  assert.ok(r.events.length);

  const poor = at(19, { cash: P.land - 1 });
  poor.flags.landFeeDue = 19;
  poor.pendingMorning = copy(nodeFor(poor, 'land_fee'));
  assert.equal(poor.pendingMorning.choices[0].requires, undefined, 'JSON 往返后节点上没有函数');
  assert.match(morningChoice(poor, 'pay').error, /现金不足/);
});

test('占地费：D9 交了十天后回来，不交五天后回来并踹棚；有熟人可以出面', () => {
  const paid = at(9);
  applyMorningChoice(paid, 'pay', []);
  assert.equal(paid.flags.landFeeDue, 9 + LAND_FEE_RETURN.paid);
  const refused = at(9);
  applyMorningChoice(refused, 'refuse', []);
  assert.equal(refused.flags.landFeeDue, 9 + LAND_FEE_RETURN.refused);

  const due = at(19);
  due.flags.landFeeDue = 19;
  const node = morningNode(due);
  assert.equal(node.headlineId, 'land_fee');
  assert.match(node.text, new RegExp(String(P.land)));
  const notYet = at(18); notYet.flags.landFeeDue = 19;
  assert.notEqual(morningNode(notYet)?.headlineId, 'land_fee', '没到日子不来');

  const pay = at(19); pay.flags.landFeeDue = 19; pay.pendingMorning = morningNode(pay);
  const paidAgain = morningChoice(pay, 'pay').state;
  assert.equal(paidAgain.cash, 300 - P.land);
  assert.equal(paidAgain.ledger.expense, P.land);
  assert.equal(paidAgain.flags.landFeeDue, 19 + LAND_FEE_RETURN.paid);

  const refuse = at(19); refuse.flags.landFeeDue = 19; refuse.camp.rain = 2; refuse.pendingMorning = morningNode(refuse);
  const before = minds(refuse);
  const kicked = morningChoice(refuse, 'refuse').state;
  assert.equal(kicked.camp.rain, 1);
  for (const id of alive(refuse)) assert.equal(kicked.actors[id].mind, Math.max(0, before[id] - 4));
  assert.equal(kicked.flags.landFeeDue, 19 + LAND_FEE_RETURN.refused);

  const talk = at(19); talk.flags.landFeeDue = 19; talk.pendingMorning = morningNode(talk);
  assert.match(morningChoice(talk, 'talk').error, /信任/);
  relation(talk, 'reg_chen').trust = 3;
  const talked = morningChoice(talk, 'talk');
  assert.equal(talked.error, undefined);
  assert.ok([19 + LAND_FEE_RETURN.talked, 19 + LAND_FEE_RETURN.refused].includes(talked.state.flags.landFeeDue));
});

test('定时热点：窗口前不能预约，窗口内到场即结算，窗口过了自动过期', () => {
  const s = idle(at(6));
  s.bottles = 4;
  s.pendingMorning = nodeFor(s, 'zhou_double');
  const chosen = morningChoice(s, 'go');
  assert.equal(chosen.error, undefined);
  const ev = chosen.state.events.find((e) => e.templateId === 'zhou_double_spot');
  assert.deepEqual(ev.window, { from: 9, to: 12 });
  assert.equal(ev.district, 'recycle');
  assert.equal(ev.day, 6);
  assert.match(eventChoice(chosen.state, ev.uid, 'sell', 'xuan').error, /9点/);
  const strip = objectives(chosen.state);
  const todo = strip.find((t) => t.id === 'headline:' + ev.uid);
  assert.ok(todo, '定时热点要进长期目标条');
  assert.ok(todo.priority < strip.find((t) => t.kind === 'chapter').priority, '排在章节前面');
  assert.match(todo.detail, /9点开始/);
  assert.equal(todo.cta, null, '窗口没开就不给按钮');

  let state = chosen.state;
  for (let h = 6; h < 9; h++) state = step(state);
  assert.equal(state.hour, 9);
  assert.equal(state.events.find((e) => e.uid === ev.uid).status, 'open', '窗口开着不过期');
  state = assign(state, 'xuan', 9, 'scavenge').state;
  const reserved = eventChoice(state, ev.uid, 'sell', 'xuan');
  assert.equal(reserved.error, undefined);
  const settled = step(reserved.state);
  assert.equal(settled.bottles, 0);
  assert.equal(settled.cash, state.cash + 5 + 8, '回收工资 5 加四个瓶罐双价 8');
  assert.equal(settled.events.find((e) => e.uid === ev.uid).status, 'resolved');

  // 街道模式里人走到回收巷、没排任务也算在场：预约后空着这一小时同样结算。
  let idleThere = chosen.state;
  for (let h = 6; h < 9; h++) idleThere = step(idleThere);
  idleThere.actors.xuan.location = 'recycle';
  const idleReserved = eventChoice(idleThere, ev.uid, 'sell', 'xuan');
  assert.equal(idleReserved.error, undefined);
  const idleDone = step(idleReserved.state);
  assert.equal(idleDone.events.find((e) => e.uid === ev.uid).status, 'resolved');
  assert.equal(idleDone.cash, idleThere.cash + 8);

  let missed = chosen.state;
  for (let h = 6; h < 12; h++) missed = step(missed);
  const gone = missed.events.find((e) => e.uid === ev.uid);
  assert.ok(!objectives(missed).some((t) => t.id === 'headline:' + ev.uid), '过期后从目标条消失');
  assert.equal(gone.status, 'expired');
  assert.equal(gone.missed, true);
  assert.ok(missed.log.some((line) => line.includes('过了时间')));
  assert.match(eventChoice(missed, ev.uid, 'sell', 'xuan').error, /不在了/);
});

test('错过刘姐的早班有后果：信任-1 且明天不能帮厨；到场则多得一份饭', () => {
  const s = idle(at(7));
  s.pendingMorning = nodeFor(s, 'liu_short');
  let state = morningChoice(s, 'go').state;
  const ev = state.events.find((e) => e.templateId === 'liu_short_spot');
  assert.deepEqual(ev.window, { from: 6, to: 9 });
  const trust = relation(state, 'reg_liu').trust;
  for (let h = 6; h < 9; h++) state = step(state);
  assert.equal(state.events.find((e) => e.uid === ev.uid).status, 'expired');
  assert.equal(relation(state, 'reg_liu').trust, Math.max(0, trust - 1));
  assert.equal(state.flags.liuClosedDay, 8);

  const tomorrow = idle(at(8)); tomorrow.flags.liuClosedDay = 8;
  const planned = assign(tomorrow, 'fan', 6, 'kitchen');
  const closed = planned.error ? planned : settle(planned.state);
  assert.match(closed.error, /没开摊/);

  const helped = idle(at(7));
  helped.pendingMorning = nodeFor(helped, 'liu_short');
  let h = morningChoice(helped, 'go').state;
  const spot = h.events.find((e) => e.templateId === 'liu_short_spot');
  h = assign(h, 'fan', 6, 'kitchen').state;
  h = eventChoice(h, spot.uid, 'help', 'fan').state;
  const meals = h.items.filter((x) => x.itemId === 'meal').length;
  const done = step(h);
  assert.equal(done.events.find((e) => e.uid === spot.uid).status, 'resolved');
  assert.equal(done.items.filter((x) => x.itemId === 'meal').length, meals + 3, '帮厨一份、刘姐当场两份');
  assert.equal(relation(done, 'reg_liu').trust, Math.min(5, relation(h, 'reg_liu').trust + 2), '帮厨本身加一、热点再加一');
});

test('剧本付费节点存档往返后仍受现金校验；占本小时的预约那一格被清掉就放回 open', () => {
  const poor = at(22, { cash: P.camera - 1 });
  poor.pendingMorning = copy(morningNode(poor));
  assert.equal(poor.pendingMorning.choices[0].requires, undefined);
  assert.match(morningChoice(poor, 'pay').error, /现金不足/);
  assert.equal(poor.cash, P.camera - 1);

  const s = idle(at(14));
  s.pendingMorning = nodeFor(s, 'fan_fork');
  let state = morningChoice(s, 'both').state;
  for (let h = 6; h < 14; h++) state = step(state);
  const shoot = state.events.find((e) => e.templateId === 'fork_shoot_spot');
  const booked = eventChoice(state, shoot.uid, 'take', 'fan').state;
  booked.plan.fan[8] = null;
  const cash = booked.cash;
  const settled = step(booked);
  assert.equal(settled.events.find((e) => e.uid === shoot.uid).status, 'open');
  assert.equal(settled.cash, cash);
  assert.equal(objectives(at(14)).some((t) => t.cta && t.kind === 'headline'), false);
});

test('凡哥的下午：两个热点同一窗口不同街区，只有凡哥能处理，去了一边另一边就错过', () => {
  const s = idle(at(14));
  s.pendingMorning = nodeFor(s, 'fan_fork');
  let state = morningChoice(s, 'both').state;
  const spots = state.events.filter((e) => e.window && e.day === 14);
  assert.equal(spots.length, 2);
  assert.deepEqual(spots.map((e) => e.district).sort(), ['cinema', 'market']);
  for (const e of spots) { assert.deepEqual(e.window, { from: 14, to: 17 }); assert.deepEqual(e.cast, ['fan']); }
  for (let h = 6; h < 14; h++) state = step(state);
  const shoot = state.events.find((e) => e.templateId === 'fork_shoot_spot');
  assert.match(eventChoice(state, shoot.uid, 'take', 'xuan').error, /凡哥/);
  const booked = eventChoice(state, shoot.uid, 'take', 'fan');
  assert.equal(booked.error, undefined);
  assert.equal(booked.booked, true);
  const trust = relation(booked.state, 'reg_xu').trust;
  let after = step(booked.state);
  assert.equal(after.cash, state.cash + 24);
  for (let h = 15; h < 17; h++) after = step(after);
  const screening = after.events.find((e) => e.templateId === 'fork_screening_spot');
  assert.equal(screening.status, 'expired');
  assert.equal(relation(after, 'reg_xu').trust, Math.max(0, trust - 1));
});

test('导演不会自己刷出定时模板，池子里每件事都能生成节点', () => {
  const s = at(20);
  for (let i = 0; i < 40; i++) { s.turn = 76 + i; s.slot = i % 4; directorTick(s, []); }
  assert.ok(!s.events.some((e) => e.window));
  for (const h of POOL) {
    const node = nodeFor(at(30), h.id);
    assert.ok(node.title && typeof node.text === 'string' && node.choices.length >= 1, h.id);
    for (const c of node.choices) assert.ok(typeof c.label === 'string' && c.label.length, h.id + ':' + c.id);
  }
});

test('窗口文案：没到点显示几点开始，开着显示还剩几小时，普通热点仍按回合', () => {
  const ev = { window: { from: 9, to: 12 }, expiresTurn: 10 };
  assert.equal(windowLabel(ev, { hour: 7, turn: 8 }), '9点开始');
  assert.equal(windowLabel(ev, { hour: 10, turn: 9 }), '还剩2小时');
  assert.equal(windowLabel({ expiresTurn: 10 }, { hour: 10, turn: 9 }), '还剩1回合');
});
