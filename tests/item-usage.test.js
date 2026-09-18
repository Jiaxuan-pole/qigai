import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import * as engine from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';

before(loadData);

test('同一包香烟的每日两次额度按使用者分开，显示消耗者剩余次数', () => {
  let state = engine.fresh(443);
  const pack = makeItem(state, 'cigarette', 'camp');
  const initialMind = state.actors.fan.mind;
  for (let i = 0; i < 2; i++) {
    const result = engine.useItem(state, 'xuan', pack.uid);
    assert.equal(result.error, undefined);
    state = result.state;
  }
  assert.match(engine.useItem(state, 'xuan', pack.uid).error, /两次/);
  const fan = engine.useItem(state, 'fan', pack.uid);
  assert.equal(fan.error, undefined);
  assert.equal(fan.state.actors.fan.mind, initialMind + 4);
  assert.equal(typeof engine.itemUsage, 'function');
  assert.deepEqual(engine.itemUsage(fan.state, 'xuan', 'cigarette'), { used: 2, limit: 2, remaining: 0, unit: '次' });
  assert.deepEqual(engine.itemUsage(fan.state, 'fan', 'cigarette'), { used: 1, limit: 2, remaining: 1, unit: '次' });
});

test('饮酒额度按人物醉意计算，烈酒占两格，不影响同伴', () => {
  let state = engine.fresh(443);
  const spirit = makeItem(state, 'spirit', 'camp');
  const beer = makeItem(state, 'beer', 'camp');
  state = engine.useItem(state, 'xuan', spirit.uid).state;
  assert.match(engine.useItem(state, 'xuan', beer.uid).error, /饮酒上限/);
  const fan = engine.useItem(state, 'fan', beer.uid);
  assert.equal(fan.error, undefined);
  assert.equal(typeof engine.itemUsage, 'function');
  assert.deepEqual(engine.itemUsage(fan.state, 'xuan', 'beer'), { used: 2, limit: 2, remaining: 0, unit: '醉意' });
  assert.deepEqual(engine.itemUsage(fan.state, 'fan', 'spirit'), { used: 1, limit: 2, remaining: 1, unit: '醉意' });
  assert.equal(engine.itemUsage(fan.state, 'fan', 'bread'), null);
});
