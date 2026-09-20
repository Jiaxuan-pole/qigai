import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { rng } from '../public/game/rng.js';
import { finishWorkGame } from '../public/game/work-games.js';
import { settle } from '../public/game/settle.js';
import { plan, ready } from './engine-fixtures.js';

before(loadData);

function setup(seed, action, actor, options = {}) {
  let s = ready(seed, { turn: 16, ma: true });
  s.cash = 100; s.ledger = { start: 100, income: 0, expense: 0 };
  for (const p of Object.values(s.actors)) { p.energy = 100; p.health = 100; p.food = 100; p.warmth = 100; p.mind = 100; }
  if (action === 'oddjob') {
    s.events.push({ uid: 'test-job', status: 'reserved', expiresTurn: 18 });
    const r = plan(s, actor, action, { zone: options.zone ?? 'market', eventUid: 'test-job', pay: options.pay });
    return r;
  }
  return plan(s, actor, action);
}

test('摆摊与事件按实际工资创建一局', () => {
  for (const [action, actor] of [['phonestall', 'xuan'], ['shellgame', 'ma']]) {
    const s = setup(901, action, actor);
    const r = settle(s, { controlledActorId: actor });
    assert.equal(r.error, undefined);
    const roll = rng(s.seed, `busk:${s.turn + 1}:${actor}`);
    const pay = action === 'phonestall' ? 4 + Math.floor(roll * 4) : roll < 0.2 ? 0 : 3 + Math.floor(roll * 8);
    assert.equal(r.state.cash, s.cash + pay);
    assert.equal(r.state.pending.workGames.length, 1);
    assert.equal(r.state.pending.workGames[0].variant, action);
    assert.equal(r.state.pending.workGames[0].basePay, pay);
  }
  for (const [pay, zone] of [[22, 'market'], [26, 'station'], [30, 'market'], [36, 'recycle']]) {
    const s = setup(902 + pay, 'oddjob', 'ma', { pay, zone });
    const r = settle(s, { controlledActorId: 'ma' });
    assert.equal(r.error, undefined, r.error);
    assert.equal(r.state.cash, s.cash + pay);
    assert.equal(r.state.pending.workGames[0].basePay, pay);
    assert.equal(r.state.pending.workGames[0].variant, 'oddjob');
  }
});

test('被赶走仍收入零且奖金零', () => {
  const seed = Array.from({ length: 1000 }, (_, n) => n + 1).find(n => rng(n, 'busk:17:ma') < 0.2);
  const s = setup(seed, 'shellgame', 'ma');
  const mind = s.actors.ma.mind;
  const r = settle(s, { controlledActorId: 'ma' });
  assert.equal(r.error, undefined);
  assert.equal(r.state.cash, s.cash);
  assert.equal(r.state.actors.ma.mind, mind - 3);
  const game = r.state.pending.workGames[0];
  assert.equal(game.basePay, 0);
  const finished = finishWorkGame(r.state, game.id, { forfeit: true });
  assert.equal(finished.bonus, 0);
  assert.equal(finished.state.cash, s.cash);
  assert.match(finishWorkGame(finished.state, game.id, { forfeit: true }).error, /当前挑战/);
});

test('夜班加成进入短工基价且队友自动不弹', () => {
  let s = setup(999, 'oddjob', 'ma', { pay: 31, zone: 'station' });
  s.flags.chenNightWatch = true;
  const r = settle(s, { controlledActorId: 'ma' });
  assert.equal(r.error, undefined);
  assert.equal(r.state.pending.workGames[0].basePay, 36);
  assert.equal(r.state.cash, s.cash + 36);
  const other = settle(s, { controlledActorId: 'xuan' });
  assert.equal(other.error, undefined);
  assert.equal(other.state.pending.workGames?.length ?? 0, 0);
  assert.equal(other.state.cash, r.state.cash);
});
