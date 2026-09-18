import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { eventChoice, travelTo } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { PACKS, chooseEvent } from '../public/game/events.js';
import { normalizeSave, validateSave } from '../public/game/save.js';
import { beginCombat, actCombat, closeCombat, combatPending } from '../public/game/combat.js';
import { ready } from './engine-fixtures.js';

before(loadData);

function encounter(seed = 27, actorId = 'xuan', kind = 'thugs') {
  const s = ready(seed, { day: 9, turn: 35, slot: 3, ma: true });
  const templateId = kind === 'thugs' ? 'street_thugs' : 'chengguan_sweep';
  s.actors[actorId].location = 'station';
  s.events.push({ uid: 'combat-event', templateId, district: 'station', spawnedTurn: s.turn,
    expiresTurn: s.turn + 1, status: 'open', reserved: null, title: PACKS[templateId].title,
    setup: '', major: false, cast: null });
  return s;
}

const start = (s, actorId = 'xuan', kind = 'thugs') => beginCombat(s, { actorId, kind, eventUid: 'combat-event' });
const move = (s, action) => actCombat(s, s.pending.combat.id, action, s.pending.combat.round);

test('反抗立即进入纯函数战斗，原事件被占用且时钟不前进', () => {
  const s = encounter(), old = structuredClone(s);
  const r = eventChoice(s, 'combat-event', 'fight', 'xuan');
  assert.equal(r.error, undefined);
  assert.equal(combatPending(r.state), true);
  assert.equal(r.state.pending.combat.phase, 'fighting');
  assert.equal(r.state.events.at(-1).status, 'combat');
  assert.equal(r.state.hourTick, s.hourTick);
  assert.deepEqual(s, old);
  assert.match(eventChoice(r.state, 'combat-event', 'pay', 'xuan').error, /战斗|冲突/);
});

test('远处的角色不能隔空反抗，别的待办也不能被战斗覆盖', () => {
  const s = encounter();
  s.actors.xuan.location = 'camp';
  assert.match(start(s).error, /在场|现场|街区/);
  s.actors.xuan.location = 'station';
  s.pending.beg.push({ actorId: 'fan' });
  assert.match(start(s).error, /待办|互动/);
});

test('同种子同选择逐回合一致，防守改变承伤并让下一次攻击更有效', () => {
  let guarded, attacked;
  for (let seed = 1; seed < 100; seed++) {
    const s = start(encounter(seed)).state;
    if (s.pending.combat.intent !== 'guard') { guarded = move(s, 'defend'); attacked = move(s, 'attack'); break; }
  }
  assert.ok(guarded && attacked);
  assert.ok(guarded.state.pending.combat.playerStamina > attacked.state.pending.combat.playerStamina);
  assert.ok(guarded.state.pending.combat.opening > 0);
  const s = start(encounter()).state, old = structuredClone(s);
  assert.deepEqual(move(s, 'attack'), move(s, 'attack'));
  assert.deepEqual(s, old);
  assert.equal(move(s, 'attack').state.hourTick, s.hourTick);
});

test('动作携带回合身份，重复动作和非法动作不再结算', () => {
  const s = start(encounter()).state, c = s.pending.combat;
  const first = move(s, 'attack');
  const duplicate = actCombat(first.state, c.id, 'attack', c.round);
  assert.match(duplicate.error, /回合|处理/);
  assert.equal(duplicate.state, first.state);
  assert.match(move(s, 'anything').error, /动作/);
});

test('攻击能决出胜负，沿用精神、伤情及混混保护后果且只应用一次', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const input = encounter(seed, seed % 2 ? 'ma' : 'xuan');
    const actor = seed % 2 ? 'ma' : 'xuan';
    if (actor === 'ma') for (const p of Object.values(input.actors)) { p.health = 100; p.energy = 100; p.location = 'station'; }
    else { input.actors.xuan.health = 5; input.actors.xuan.energy = 1; }
    let s = start(input, actor).state;
    for (let i = 0; i < 8 && s.pending.combat.phase === 'fighting'; i++) s = move(s, 'attack').state;
    const c = s.pending.combat;
    assert.equal(c.phase, 'resolved');
    outcomes.add(c.result.outcome);
    assert.equal(s.events.at(-1).status, 'resolved');
    assert.equal(s.hourTick, input.hourTick);
    if (c.result.outcome === 'win') { assert.equal(s.flags.thugRespect, s.day + 10); assert.ok(s.actors[actor].mind > input.actors[actor].mind); }
    else { assert.ok(s.actors[actor].mind < input.actors[actor].mind); assert.ok(s.actors[actor].health < input.actors[actor].health); assert.equal(s.actors[actor].life, 'downed'); }
    assert.equal(move(s, 'attack').state, s);
    assert.match(move(s, 'attack').error, /结束|处理/);
    const closed = closeCombat(s, c.id);
    assert.equal(closed.state.pending.combat, null);
    assert.equal(closeCombat(closed.state, c.id).state, closed.state);
    assert.match(chooseEvent(closed.state, 'combat-event', 'fight', actor).error, /不在/);
  }
  assert.deepEqual([...outcomes].sort(), ['lose', 'win']);
});

test('撤离可结束冲突并支付既有逃跑代价，城管落败保留罚款禁摊', () => {
  let fled;
  for (let seed = 1; seed < 100 && !fled; seed++) {
    const s = start(encounter(seed)).state;
    const r = move(s, 'flee');
    if (r.state.pending.combat.result?.outcome === 'flee') fled = { before: s, after: r.state };
  }
  assert.ok(fled);
  assert.equal(fled.before.actors.xuan.energy - fled.after.actors.xuan.energy, 8);
  const input = encounter(8, 'xuan', 'chengguan');
  input.actors.xuan.energy = 1; input.actors.xuan.health = 15;
  let s = start(input, 'xuan', 'chengguan').state;
  while (s.pending.combat.phase === 'fighting') s = move(s, 'attack').state;
  assert.equal(s.pending.combat.result.outcome, 'lose');
  assert.ok(s.flags.cooldown.phonestall > s.day);
  assert.ok(s.cash < input.cash);
});

test('待战斗和待确认结果都阻止结算与跨街', () => {
  let s = start(encounter()).state;
  assert.match(settle(s).error, /战斗|冲突/);
  assert.match(travelTo(s, 'xuan', 'market').error, /战斗|冲突|待办/);
  while (s.pending.combat.phase === 'fighting') s = move(s, 'attack').state;
  assert.match(settle(s).error, /战斗|冲突/);
});

test('战斗中途存档恢复保持下一回合一致，拒绝损坏会话与脱离事件的会话', () => {
  const s = move(start(encounter()).state, 'defend').state;
  assert.deepEqual(validateSave(s), { ok: true });
  const restored = normalizeSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(move(restored, 'attack').state.pending.combat, move(s, 'attack').state.pending.combat);
  for (const mutate of [c => { c.round = -1; }, c => { c.playerStamina = 1000; }, c => { c.intent = 'fake'; }, c => { c.actorId = 'fake'; }]) {
    const broken = structuredClone(s); mutate(broken.pending.combat);
    assert.equal(validateSave(broken).ok, false);
  }
  const orphaned = structuredClone(s); orphaned.events = [];
  assert.equal(validateSave(orphaned).ok, false);
  const legacy = encounter(); delete legacy.pending.combat;
  assert.equal(normalizeSave(legacy).pending.combat, null);
});
