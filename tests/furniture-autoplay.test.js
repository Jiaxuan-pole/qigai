import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { placedBedCount } from '../public/game/furniture.js';
import { morningNode, applyMorningChoice } from '../public/game/story.js';
import { observeState } from '../scripts/autoplay/observe.js';
import { chooseFurniturePurchase, chooseFurnitureSetup, planActions } from '../scripts/autoplay/policies.js';
import { applyCommand } from '../scripts/autoplay/runner.js';
import { settle, preflight } from '../public/game/settle.js';

before(loadData);

test('D3 build choice points to furniture store without scheduling a bed action', () => {
  const state = fresh(1000);
  state.day = 3;
  state.actors.ma.life = 'active';
  assert.match(morningNode(state).text, /家具城/);
  const plan = structuredClone(state.plan);
  const events = [];
  applyMorningChoice(state, 'build', events);
  assert.deepEqual(state.plan, plan);
  assert.match(events.join(''), /拆包摆放/);
});

test('policy buys unpacks places bed with food reserve', () => {
  let state = fresh(1000);
  state.hour = 10;
  state.slot = 1;
  state.cash = 160;
  state.camp.rain = 2;
  state.actors.xuan.location = 'furniture';
  const purchase = chooseFurniturePurchase(observeState(state));
  assert.deepEqual(purchase.cart, [{ shopId: 'furniture_store', itemId: 'bed_basic', qty: 1 }]);
  const bought = applyCommand(state, purchase);
  assert.equal(bought.error, undefined);
  state = bought.state;
  assert.equal(state.cash, 115);
  assert.equal(state.ledger.expense, 45);
  assert.equal(state.camp.parcels.length, 1);
  assert.equal(placedBedCount(state), 0);
  const parcel = state.camp.parcels[0];
  assert.equal(state.items.find(item => item.uid === parcel.itemUids[0]).container, 'parcel:' + parcel.id);
  let command = chooseFurnitureSetup(observeState(state));
  assert.equal(command.kind, 'unpackParcel');
  state = applyCommand(state, command).state;
  command = chooseFurnitureSetup(observeState(state));
  assert.equal(command.kind, 'placeFurniture');
  state = applyCommand(state, command).state;
  assert.equal(placedBedCount(state), 1);
  assert.equal(state.camp.beds, 1);
  assert.equal(state.camp.placements[0].uid, parcel.itemUids[0]);
  assert.equal(planActions(observeState(state), 'balanced').some(x => x.actionId === 'bed'), false);
});

test('policy protects meals before furniture', () => {
  const state = fresh(1000);
  state.hour = 10;
  state.slot = 1;
  state.cash = 45;
  state.items = state.items.filter(item => item.itemId !== 'meal');
  state.effectiveFood = 0;
  state.actors.xuan.location = 'furniture';
  assert.equal(chooseFurniturePurchase(observeState(state)), null);
  const commands = planActions(observeState(state), 'balanced');
  assert.equal(commands.some(x => x.opts?.cart?.some(line => line.itemId === 'bed_basic')), false);
  assert.ok(commands.some(x => ['scavenge', 'carry', 'run', 'kitchen', 'shop'].includes(x.actionId)));
  assert.equal(commands.some(x => x.actionId === 'bed'), false);
});

test('policy protects treatment and emergency cash before furniture', () => {
  const state = fresh(1000);
  state.hour = 10;
  state.slot = 1;
  state.cash = 50;
  state.actors.xuan.location = 'furniture';
  state.actors.fan.diseases.push({ uid: 'care-needed', known: true, kind: 'skin', severity: 35, plan: true });
  assert.equal(chooseFurniturePurchase(observeState(state)), null);
  state.actors.fan.diseases = [];
  state.actors.fan.life = 'downed';
  state.vouchers = 0;
  assert.equal(chooseFurniturePurchase(observeState(state)), null);
});

test('scheduled furniture shop delivers a parcel through settlement', () => {
  let state = fresh(1000);
  state.pendingMorning = null;
  state.hour = 10;
  state.slot = 1;
  state.cash = 160;
  state.camp.rain = 2;
  const commands = planActions(observeState(state), 'balanced');
  const furniture = commands.find(command => command.opts?.cart?.some(line => line.itemId === 'bed_basic'));
  assert.ok(furniture);
  assert.equal(furniture.opts.zone, 'furniture');
  for (const command of commands) {
    const result = applyCommand(state, command);
    assert.equal(result.error, undefined);
    state = result.state;
  }
  assert.equal(preflight(state).error, undefined);
  const result = settle(state);
  assert.equal(result.error, undefined);
  assert.equal(result.state.camp.parcels.length, 1);
  assert.equal(placedBedCount(result.state), 0);
});
