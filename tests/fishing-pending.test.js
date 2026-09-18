import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, autoResolvePending, travelTo } from '../public/game/engine.js';

before(loadData);
function pending() {
  const s = fresh(23); s.pendingMorning = null;
  s.pending.fishingQte = [{ id:'fishQte:23:1:0:xuan',actorId:'xuan',day:1,hourTick:0,skill:0,fishItemId:'fish_common',zoneStart:0,zoneWidth:40 }];
  return s;
}
test('待收竿时不能跨街，自动对局真实处理挑战且不重复领奖', () => {
  const s = pending(), bytes = JSON.stringify(s);
  const movement = travelTo(s,'xuan','river');
  assert.ok(movement.error); assert.equal(movement.state,s);
  const out = autoResolvePending(s);
  assert.equal(out.state.pending.fishingQte.length,0);
  assert.equal(JSON.stringify(s),bytes);
  const again=autoResolvePending(out.state);
  assert.deepEqual(again.state.items,out.state.items);
});
