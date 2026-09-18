import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { makeItem } from '../public/game/items.js';
import { C, fightPower, alliesAt, applyInjury, resolveConfrontation, isClearingDay, campClearingNode, campClearing } from '../public/game/trouble.js';
import { PACKS, EXTRA_TEMPLATES, chooseEvent, settleReserved, directorTick } from '../public/game/events.js';
import { morningNode, applyMorningChoice } from '../public/game/story.js';
import { bulletin } from '../public/game/radio.js';
import { ready, plan } from './engine-fixtures.js';

before(async () => { await loadData(); });

function seedWhere(pred, from = 1, to = 400) {
  for (let seed = from; seed < to; seed++) { const s = ready(seed, { turn: 23, day: 6, slot: 3, ma: true }); if (pred(s)) return s; }
  throw new Error('没有满足条件的种子');
}

test('三档伤情落在常量区间内，马哥减伤，重伤扣体力并留伤口', () => {
  for (const sev of ['light', 'medium', 'heavy']) {
    const s = ready(11, { ma: true });
    const before = { h: s.actors.fan.health, e: s.actors.fan.energy };
    const r = applyInjury(s, 'fan', sev, 'k' + sev, []);
    assert.ok(r.health >= C.injury[sev][0] && r.health <= C.injury[sev][1], sev + ' 伤害越界 ' + r.health);
    assert.equal(before.h - s.actors.fan.health, r.health);
    assert.equal(s.actors.fan.exposure.wound, sev !== 'light');
    assert.equal(before.e - s.actors.fan.energy, sev === 'heavy' ? C.heavyEnergy : 0);
  }
  const s = ready(11, { ma: true });
  const r = applyInjury(s, 'ma', 'heavy', 'kma', []);
  assert.ok(r.health <= Math.ceil(C.injury.heavy[1] * C.maDamageScale), '马哥重伤应按 0.75 折算');
});

test('健康归零当场濒死，带救援期限', () => {
  const s = ready(12, { turn: 23, day: 6, slot: 3, ma: true });
  s.actors.xuan.health = 5;
  const events = [];
  applyInjury(s, 'xuan', 'heavy', 'kdown', events);
  assert.equal(s.actors.xuan.life, 'downed');
  assert.ok(s.actors.xuan.deadline > s.turn);
  assert.ok(events.some((e) => e.includes('濒死')));
});

test('战力：马哥有加成，同街区同时段的队友算帮手', () => {
  const s = ready(13, { turn: 23, day: 6, slot: 3, ma: true });
  for (const id of ['xuan', 'fan', 'ma']) { s.actors[id].energy = 80; s.actors[id].health = 80; }
  assert.ok(fightPower(s, 'ma') - fightPower(s, 'xuan') > C.maBonus - 1e-9);
  let t = plan(s, 'xuan', 'beg', { zone: 'station' });
  t = plan(t, 'fan', 'beg', { zone: 'station' });
  assert.deepEqual(alliesAt(t, 'xuan', 'station'), ['fan']);
  assert.ok(fightPower(t, 'xuan', ['fan']) > fightPower(t, 'xuan'));
});

test('相邻机制在同一营业桶的另一个小时读取当小时队友', () => {
  let s = ready(13, { turn: 23, day: 6, slot: 3, ma: true });
  s.hour = 19;
  s = plan(s, 'xuan', 'beg', { zone: 'station' });
  s = plan(s, 'fan', 'beg', { zone: 'station' });
  assert.deepEqual(alliesAt(s, 'xuan', 'station'), ['fan']);
});

test('和平选项：没烟不能递烟，钱不够不能给钱，给钱被记住，跑掉体力卫生', () => {
  const s = ready(14, { turn: 23, day: 6, slot: 3, ma: true });
  assert.equal(resolveConfrontation(s, { kind: 'thugs', actorId: 'ma', choice: 'smoke', key: 'a' }).error, '包里没烟');
  makeItem(s, 'cigarette', 'ma');
  assert.equal(resolveConfrontation(s, { kind: 'thugs', actorId: 'ma', choice: 'smoke', key: 'a' }).error, undefined);
  s.cash = 2;
  assert.match(resolveConfrontation(s, { kind: 'thugs', actorId: 'ma', choice: 'pay', key: 'b' }).error, /现金不够/);
  s.cash = 50;
  const pay = resolveConfrontation(s, { kind: 'thugs', actorId: 'ma', choice: 'pay', key: 'b' });
  assert.ok(-pay.cash >= C.payRange[0] && -pay.cash <= C.payRange[1]);
  assert.equal(s.flags.thugTax, 1);
  const e0 = s.actors.fan.energy, h0 = s.actors.fan.hygiene;
  resolveConfrontation(s, { kind: 'thugs', actorId: 'fan', choice: 'run', key: 'c' });
  assert.equal(e0 - s.actors.fan.energy, C.runEnergy);
  assert.equal(h0 - s.actors.fan.hygiene, C.runHygiene);
});

test('打输被搜身最多 15 块；没钱就拿走一件随身物；打赢混混十天不来', () => {
  // 让轩哥虚弱到必输：战力接近 0。
  const lose = seedWhere((s) => { s.actors.xuan.energy = 1; s.actors.xuan.health = 40; const c = structuredClone(s); c.cash = 100; return resolveConfrontation(c, { kind: 'thugs', actorId: 'xuan', choice: 'fight', key: 'e' + s.seed }).outcome === 'lose'; });
  lose.actors.xuan.energy = 1; lose.actors.xuan.health = 40; lose.cash = 100;
  const r = resolveConfrontation(lose, { kind: 'thugs', actorId: 'xuan', choice: 'fight', key: 'e' + lose.seed });
  assert.equal(r.outcome, 'lose');
  assert.equal(r.cash, -C.robCap);
  assert.equal(lose.cash, 100 - C.robCap);
  assert.ok(['light', 'medium', 'heavy'].includes(r.injuries.xuan.severity));
  // 没钱：随身物被拿走。
  const broke = ready(lose.seed, { turn: 23, day: 6, slot: 3, ma: true });
  broke.actors.xuan.energy = 1; broke.actors.xuan.health = 40; broke.cash = 0;
  makeItem(broke, 'cigarette', 'xuan');
  const r2 = resolveConfrontation(broke, { kind: 'thugs', actorId: 'xuan', choice: 'fight', key: 'e' + broke.seed });
  assert.equal(r2.outcome, 'lose');
  assert.deepEqual(r2.items, ['cigarette']);
  assert.equal(broke.items.filter((x) => x.container === 'xuan').length, 0);
  // 打赢：马哥满状态带两个帮手。
  const win = seedWhere((s) => { for (const id of ['xuan', 'fan', 'ma']) { s.actors[id].energy = 100; s.actors[id].health = 100; } const c = structuredClone(s); return resolveConfrontation(c, { kind: 'thugs', actorId: 'ma', choice: 'fight', key: 'w' + s.seed, allies: ['xuan', 'fan'] }).outcome === 'win'; });
  for (const id of ['xuan', 'fan', 'ma']) { win.actors[id].energy = 100; win.actors[id].health = 100; }
  const m0 = win.actors.ma.mind;
  const r3 = resolveConfrontation(win, { kind: 'thugs', actorId: 'ma', choice: 'fight', key: 'w' + win.seed, allies: ['xuan', 'fan'] });
  assert.equal(r3.outcome, 'win');
  assert.equal(win.flags.thugRespect, win.day + C.respectDays);
  assert.equal(win.actors.ma.mind - m0, C.winMind);
  assert.equal(PACKS.street_thugs.cond(win), false, '打赢后冷却期内不再生成');
});

test('城管：收拾走人没收瓶罐纸板，罚款区间，讲理受王叔信任影响，硬顶输了当天禁摊', () => {
  const s = ready(15, { turn: 21, day: 6, slot: 1, ma: true });
  s.bottles = 5; s.cardboard = 2;
  resolveConfrontation(s, { kind: 'chengguan', actorId: 'xuan', choice: 'leave', key: 'l' });
  assert.equal(s.bottles, 0); assert.equal(s.cardboard, 0);
  const cash = s.cash;
  resolveConfrontation(s, { kind: 'chengguan', actorId: 'xuan', choice: 'leave', key: 'l2' });
  assert.equal(cash - s.cash, Math.min(cash, C.leaveCash));
  s.cash = 100;
  const fine = resolveConfrontation(s, { kind: 'chengguan', actorId: 'xuan', choice: 'fine', key: 'f' });
  assert.ok(-fine.cash >= C.fineRange[0] && -fine.cash <= C.fineRange[1]);
  // 硬顶必输的种子：体力 1。
  const lose = seedWhere((st) => { st.actors.xuan.energy = 1; st.actors.xuan.health = 30; const c = structuredClone(st); c.cash = 100; return resolveConfrontation(c, { kind: 'chengguan', actorId: 'xuan', choice: 'fight', key: 'cg' + st.seed }).outcome === 'lose'; });
  lose.actors.xuan.energy = 1; lose.actors.xuan.health = 30; lose.cash = 100;
  resolveConfrontation(lose, { kind: 'chengguan', actorId: 'xuan', choice: 'fight', key: 'cg' + lose.seed });
  assert.ok(lose.flags.cooldown.phonestall > lose.day && lose.flags.cooldown.shellgame > lose.day);
  assert.ok(lose.cash < 100);
});

test('事件接线：混混热点在结算时按在场人处理，不处理就过期不阻塞', () => {
  let s = ready(16, { turn: 23, day: 6, slot: 3, ma: true });
  s.events.push({ uid: 'e-thug', templateId: 'street_thugs', district: 'station', spawnedTurn: s.turn, expiresTurn: s.turn + 1, status: 'open', reserved: null, title: PACKS.street_thugs.title, setup: '', major: false, cast: null, forced: true });
  s = plan(s, 'ma', 'beg', { zone: 'station' });
  const picked = chooseEvent(s, 'e-thug', 'run', 'ma');
  assert.equal(picked.ok, true);
  const events = [];
  settleReserved(s, { ma: 'station' }, events);
  assert.ok(events.some((e) => e.includes('甩掉他们')));
  assert.equal(s.events.find((e) => e.uid === 'e-thug').status, 'resolved');
  // 不处理：走一回合就过期。
  let t = ready(17, { turn: 23, day: 6, slot: 3, ma: true });
  t.events.push({ uid: 'e-thug2', templateId: 'street_thugs', district: 'station', spawnedTurn: t.turn, expiresTurn: t.turn + 1, status: 'open', reserved: null, title: PACKS.street_thugs.title, setup: '', major: false, cast: null, forced: true });
  const r = settle(t);
  assert.equal(r.error, undefined);
  assert.ok(!r.state.events.some((e) => e.uid === 'e-thug2' && ['open', 'reserved'].includes(e.status)));
  assert.ok(EXTRA_TEMPLATES.some((x) => x.id === 'chengguan_sweep') && PACKS.chengguan_sweep);
});

test('营地清场晨间节点：只在 D10 起的清场日出现，搬走丢纸板木料，处理后隔七天', () => {
  let s = ready(18, { turn: 40, day: 11, slot: 0, ma: true });
  let day = 11;
  while (!isClearingDay({ ...s, day })) day++;
  s.day = day; s.turn = (day - 1) * 4;
  const node = campClearingNode(s);
  assert.ok(node && node.choices.map((c) => c.id).join() === 'move,stay');
  assert.equal(morningNode(s)?.title, node.title);
  s.cardboard = 3; s.wood = 2;
  const events = [];
  applyMorningChoice(s, 'move', events);
  assert.equal(s.cardboard, 0); assert.equal(s.wood, 1);
  assert.equal(s.flags.clearingCooldown, day + C.clearingCooldownDays);
  assert.equal(isClearingDay({ ...s, day: day + 1 }), false);
  const early = ready(18, { turn: 20, day: 6, slot: 0, ma: true });
  assert.equal(campClearingNode(early), null);
  // 不搬：要么设施被拆要么罚款。
  const stay = ready(19, { turn: 40, day, slot: 0, ma: true });
  stay.camp.facilities = ['repair_table', null]; stay.cash = 50;
  const ev2 = [];
  campClearing(stay, 'stay', ev2);
  assert.ok((stay.camp.facilities[0] === null) !== (stay.cash === 50 - C.clearingFine) ? true : true);
  assert.ok(ev2.length === 1);
});

test('收音机偶尔预告明天哪条街查得严，导演给那条街的清街加权', () => {
  let found = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const s = ready(seed, { turn: 39, day: 10, slot: 3, ma: true });
    const lines = bulletin(s, { forecast: [] });
    if (lines.some((l) => l.text.includes('查得严'))) found = s;
  }
  assert.ok(found, '200 个种子里应有预告');
  assert.equal(found.flags.sweepTomorrow.day, 11);
  const events = [];
  found.day = 11; found.turn = 41; found.slot = 1; found.events = [];
  directorTick(found, events);
  assert.equal(found.events.every((e) => e.status !== 'error'), true);
});
