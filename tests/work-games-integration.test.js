import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, sellBottles } from '../public/game/engine.js';
import { validateSave } from '../public/game/save.js';
import { UI } from '../public/ui/core.js';
import { showPendingWorkGame } from '../public/ui/work-game-flow.js';

before(loadData);

function element() {
  const listeners = new Map();
  const classes = new Set();
  return {
    innerHTML: '', hidden: false, disabled: false, scrollTop: 0, style: {},
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
    focus() {}, contains() { return true; }, querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
    clickAction(name, data = {}) { listeners.get('click')?.({ target: { closest: () => ({ dataset: { workAction: name, ...data } }) } }); },
  };
}

test('真实工作弹层回调逐步保存、刷新同题、结算后可继续且不能重复领取', () => {
  const original = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  const cues = [];
  const nodes = Object.fromEntries(['toast', 'modal', 'modalOverlay', 'modalContent', 'modalClose', 'workGameRoot', 'workGameContinue'].map(id => [id, element()]));
  globalThis.document = { activeElement: null, body: { style: {} }, getElementById: id => nodes[id] };
  globalThis.window = { jwsnAudio: { play: (name) => cues.push(name), cancelScope() {} } };
  const saves = new Map();
  globalThis.localStorage = { setItem: (key, value) => saves.set(key, value) };
  UI.render = () => {};
  try {
    const s = fresh(9301);
    s.pendingMorning = null; s.hour = 10; s.hourTick = 4; s.turn = 1; s.slot = 1; s.bottles = 5;
    s.actors.xuan.location = 'recycle';
    const sold = sellBottles(s, 'xuan', { controlledActorId: 'xuan' });
    assert.equal(sold.error, undefined);
    UI.state = sold.state;
    const id = UI.state.pending.workGames[0].id;
    const challenge = structuredClone(UI.state.pending.workGames[0].challenge);
    assert.equal(showPendingWorkGame(), true);
    assert.equal(nodes.modalOverlay.classList.contains('open'), true);
    nodes.workGameRoot.clickAction('piece', { id: challenge.pieces[0].id });
    nodes.workGameRoot.clickAction('bin', { id: challenge.bins[0].id });
    const saved = JSON.parse([...saves.values()].at(-1));
    assert.equal(saved.pending.workGames[0].id, id);
    assert.deepEqual(saved.pending.workGames[0].challenge, challenge);
    assert.equal(saved.pending.workGames[0].inputs.length, 1);
    assert.deepEqual(cues, ['work_sort']);
    nodes.workGameRoot.clickAction('forfeit');
    assert.deepEqual(cues, ['work_sort', 'back']);
    assert.equal(UI.state.pending.workGames.length, 0);
    assert.equal(UI.state.cash, s.cash + 5);
    assert.equal(nodes.workGameContinue.hidden, false);
    nodes.workGameContinue.onclick();
    assert.equal(nodes.modalOverlay.classList.contains('open'), false);
    assert.equal(validateSave(UI.state).ok, true);
    assert.equal(UI.state.ledger.start + UI.state.ledger.income - UI.state.ledger.expense, UI.state.cash);
    assert.equal(showPendingWorkGame(), false);
    assert.equal(UI.state.workGameCompleted.filter(value => value === id).length, 1);
  } finally {
    globalThis.document = original.document;
    globalThis.window = original.window;
    globalThis.localStorage = original.localStorage;
    UI.state = null;
  }
});

test('工作挑战只在真实完成后给成功和奖金 cue，重绘不重播', () => {
  const original = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  const nodes = Object.fromEntries(['toast', 'modal', 'modalOverlay', 'modalContent', 'modalClose', 'workGameRoot', 'workGameContinue'].map(id => [id, element()]));
  const cues = [];
  globalThis.document = { activeElement: null, body: { style: {} }, getElementById: id => nodes[id] };
  globalThis.window = { jwsnAudio: { play: cue => cues.push(cue), cancelScope() {} } };
  globalThis.localStorage = { setItem() {} };
  UI.render = () => {};
  try {
    const state = fresh(9302);
    state.pendingMorning = null; state.hour = 10; state.hourTick = 4; state.turn = 1; state.slot = 1; state.bottles = 5;
    state.actors.xuan.location = 'recycle';
    UI.state = sellBottles(state, 'xuan', { controlledActorId: 'xuan' }).state;
    const challenge = UI.state.pending.workGames[0].challenge;
    showPendingWorkGame();
    for (const piece of challenge.pieces) {
      nodes.workGameRoot.clickAction('piece', { id: piece.id });
      nodes.workGameRoot.clickAction('bin', { id: piece.material });
    }
    assert.equal(UI.state.pending.workGames[0].progress.done, true);
    nodes.workGameRoot.clickAction('finish');
    assert.deepEqual(cues, [...Array(5).fill('work_sort'), 'work_success', 'coin']);
    nodes.workGameRoot.clickAction('finish');
    assert.deepEqual(cues, [...Array(5).fill('work_sort'), 'work_success', 'coin']);
    nodes.workGameContinue.onclick();
  } finally {
    Object.assign(globalThis, original);
    UI.state = null;
  }
});
