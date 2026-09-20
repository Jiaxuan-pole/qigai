import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import * as engine from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';

before(loadData);

test('香烟不设每日上限，按使用者分开计次，用量只显示次数', () => {
  let state = engine.fresh(443);
  const pack = makeItem(state, 'cigarette', 'camp');
  pack.uses = 40;
  const initialMind = state.actors.fan.mind;
  for (let i = 0; i < 17; i++) {
    const result = engine.useItem(state, 'xuan', pack.uid);
    assert.equal(result.error, undefined, `第${i + 1}次`);
    state = result.state;
  }
  assert.equal(state.actors.xuan.smokes, 17);
  const fan = engine.useItem(state, 'fan', pack.uid);
  assert.equal(fan.error, undefined);
  assert.equal(fan.state.actors.fan.mind, initialMind + 4);
  assert.deepEqual(engine.itemUsage(fan.state, 'xuan', 'cigarette'), { used: 17, limit: null, remaining: null, unit: '次' });
  assert.deepEqual(engine.itemUsage(fan.state, 'fan', 'cigarette'), { used: 1, limit: null, remaining: null, unit: '次' });
});

test('饮酒不设次数上限：醉意仍封顶2，饮酒次数按人分开累计', () => {
  let state = engine.fresh(443);
  const spirit = makeItem(state, 'spirit', 'camp');
  spirit.uses = 9;
  const beer = makeItem(state, 'beer', 'camp');
  beer.uses = 9;
  const mind = state.actors.xuan.mind;
  state = engine.useItem(state, 'xuan', spirit.uid).state;
  assert.equal(state.actors.xuan.intox, 2);
  assert.equal(state.actors.xuan.mind, mind + 6, '第一杯给足');
  const again = engine.useItem(state, 'xuan', beer.uid);
  assert.equal(again.error, undefined);
  assert.equal(again.state.actors.xuan.intox, 2);
  assert.equal(again.state.actors.xuan.drinks, 2);
  assert.equal(again.state.actors.xuan.mind, mind + 7, '之后每杯只剩 1，精神买不到无限');
  const fan = engine.useItem(again.state, 'fan', beer.uid);
  assert.equal(fan.error, undefined);
  assert.deepEqual(engine.itemUsage(fan.state, 'xuan', 'beer'), { used: 2, limit: null, remaining: null, unit: '次' });
  assert.deepEqual(engine.itemUsage(fan.state, 'fan', 'spirit'), { used: 1, limit: null, remaining: null, unit: '次' });
  assert.deepEqual(engine.itemUsage(fan.state, 'fan', 'tea'), { used: 0, limit: 1, remaining: 1, unit: '次' });
  assert.equal(engine.itemUsage(fan.state, 'fan', 'bread'), null);
});
