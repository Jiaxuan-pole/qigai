import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { createSaveStore } from '../server/save-store.js';

const data = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../03_开发数据_商店物品愿望事件100日.json', import.meta.url), 'utf8'));
setData(data);

test('shared saves persist, list metadata only, and reject invalid input and stale revisions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jwsn-saves-'));
  try {
    const store = createSaveStore(dir);
    const state = fresh(11);
    await assert.rejects(store.create({ name: '  ', state }), { status: 400 });
    await assert.rejects(store.create({ name: 'bad\nname', state }), { status: 400 });
    await assert.rejects(store.create({ name: '好', state: { ...state, cash: -1 } }), { status: 400 });
    const first = await store.create({ name: '  我的进度  ', state });
    assert.equal(first.name, '我的进度');
    assert.equal(first.revision, 1);
    assert.equal((await store.list())[0].state, undefined);
    assert.equal((await createSaveStore(dir).get(first.id)).state.seed, 11);
    await assert.rejects(store.get('../outside'), { status: 400 });
    const next = { ...state, day: 2, hour: 6, hourTick: 16, slot: 0, turn: 4 };
    const updates = await Promise.allSettled([
      store.update(first.id, { state: next, expectedRevision: 1 }),
      store.update(first.id, { state, expectedRevision: 1 }),
    ]);
    assert.equal(updates.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(updates.find((x) => x.status === 'rejected').reason.status, 409);
    const second = await store.create({ name: '别人的进度', state: fresh(22) });
    assert.equal((await store.get(second.id)).state.seed, 22);
    assert.equal((await store.get(first.id)).state.seed, 11);
    const night = { spot: 'camp', day: 1, stage: 'chat' };
    const nightSave = await store.create({ name: '夜间进度', state: next, night });
    assert.deepEqual((await createSaveStore(dir).get(nightSave.id)).night, night);
    await assert.rejects(store.create({ name: '错误夜间', state, night }), { status: 400 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('browser queue keeps latest state and pauses after a conflict', async () => {
  const calls = [];
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async (_path, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    if (calls.length === 2) return { ok: false, status: 409, json: async () => ({ ok: false, reason: '冲突', current: { revision: 3 } }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, save: { id: 'id', revision: 2, name: 'A' } }) };
  };
  try {
    const client = await import('../public/ui/saves-client.js?queue-test');
    client.setActiveSharedSave({ id: 'id', revision: 1, name: 'A' });
    client.queueSharedSave({ day: 1 });
    client.queueSharedSave({ day: 2 });
    await client.flushSharedSave();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].state.day, 2);
    assert.equal(client.getActiveSharedSave().revision, 2);
    client.queueSharedSave({ day: 3 });
    await assert.rejects(client.flushSharedSave(), /冲突/);
    client.queueSharedSave({ day: 4 });
    assert.equal(client.getSharedSaveStatus(), 'conflict');
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = oldFetch; globalThis.localStorage = oldStorage; }
});

test('shared night metadata rejects executable or malformed screening values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jwsn-screen-'));
  try {
    const state = fresh(55); state.day = 2; state.hourTick = 16; state.turn = 4;
    const screening = { title: '街头', sources: ['街头'], audience: ['xuan', 'fan'], guest: null, premiere: true, gains: { fan: '<img src=x onerror=alert(1)>', other: 4 }, lines: [{ name: '凡哥', text: '看完了。' }] };
    await assert.rejects(createSaveStore(dir).create({ name: '坏放映', state, night: { spot: 'camp', day: 1, screening } }), { status: 400 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('v3 shared night migrates without changing record identity or revision', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jwsn-night-v3-'));
  try {
    const state = fresh(56);
    state.version = 3; state.day = 2; state.slot = 0; state.turn = 4;
    for (const id of ['xuan', 'fan', 'ma']) state.plan[id] = [null, null, null, null];
    const night = { spot: 'camp', day: 1, stage: 'chat' };
    const store = createSaveStore(dir);
    const first = await store.create({ name: '旧夜', state, night });
    assert.equal(first.state.version, 4);
    assert.equal(first.state.hour, 6);
    assert.equal(first.revision, 1);
    const second = await store.update(first.id, { state: first.state, night, expectedRevision: first.revision });
    assert.equal(second.id, first.id);
    assert.equal(second.name, first.name);
    assert.equal(second.revision, 2);
    assert.deepEqual(second.night, night);
    await assert.rejects(store.update(first.id, { state: first.state, night, expectedRevision: 1 }), { status: 409 });
    assert.equal((await store.get(first.id)).revision, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
