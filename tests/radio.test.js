import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { hasRadio, bulletin } from '../public/game/radio.js';

before(async () => { await loadData(); });

function addRadio(s, itemId, container) {
  const item = { uid: 'it' + ++s.itemSeq, itemId, container, uses: 1, dirty: false, wet: false };
  s.items.push(item);
  return item;
}

function context(day, closedTomorrow = []) {
  return { forecast: [{ day: day + 1, kind: 'rain', label: '下雨', temp: 7 }], closedTomorrow };
}

test('radio recognizes only repaired radios in camp or actor bags', () => {
  const s = fresh(501);
  assert.equal(hasRadio(s), false);
  addRadio(s, 'broken_radio', 'camp');
  const item = addRadio(s, 'radio', 'relic:fan');
  assert.equal(hasRadio(s), false);
  for (const container of ['camp', 'xuan', 'fan', 'ma']) {
    item.container = container;
    assert.equal(hasRadio(s), true);
  }
  item.container = 'storage';
  assert.equal(hasRadio(s), false);
});

test('radio returns two to four structured lines with tomorrow forecast and shop status', () => {
  for (let seed = 0; seed < 100; seed++) {
    const s = fresh(seed);
    const lines = bulletin(s, context(s.day, [0, 3]));
    assert.ok(lines.length >= 2 && lines.length <= 4);
    for (const line of lines) {
      assert.ok(['weather', 'shop', 'job', 'warning', 'flavor'].includes(line.kind));
      assert.equal(typeof line.text, 'string');
      assert.ok(line.text.length > 0);
    }
    assert.match(lines.find((line) => line.kind === 'weather').text, /明天.*下雨/);
    assert.match(lines.find((line) => line.kind === 'shop').text, /清晨.*晚间.*关门/);
  }
  const s = fresh(502);
  assert.match(bulletin(s, context(s.day)).find((line) => line.kind === 'shop').text, /照常营业/);
});

test('radio warnings air only on D63-65 and D16-17 without dropping on job days', () => {
  for (let seed = 0; seed < 20; seed++) {
    for (const day of [15, 16, 17, 18, 62, 63, 64, 65, 66]) {
      const s = fresh(seed);
      s.day = day;
      const lines = bulletin(s, context(day));
      const warnings = lines.filter((line) => line.kind === 'warning');
      if (day >= 63 && day <= 65) assert.match(warnings[0]?.text ?? '', /第71—74天寒潮/);
      else if (day === 16 || day === 17) assert.match(warnings[0]?.text ?? '', /第18天强降雨/);
      else assert.equal(warnings.length, 0);
      assert.ok(lines.length <= 4);
    }
  }
});

test('radio is deterministic and queues a tomorrow tip once with about thirty percent frequency', () => {
  let jobs = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const a = fresh(seed);
    const b = fresh(seed);
    a.pendingJobTips = [];
    b.pendingJobTips = [];
    const lines = bulletin(a, context(a.day));
    assert.deepEqual(lines, bulletin(b, context(b.day)));
    assert.deepEqual(a.pendingJobTips, b.pendingJobTips);
    const job = lines.find((line) => line.kind === 'job');
    if (job) {
      jobs++;
      assert.equal(a.pendingJobTips.length, 1);
      const { district, ...tip } = a.pendingJobTips[0];
      assert.deepEqual(tip, { day: 2, from: '电台招工信息', npcId: null });
      assert.ok(['station', 'market', 'recycle', 'cinema'].includes(district));
      assert.deepEqual(bulletin(a, context(a.day)), lines);
      assert.equal(a.pendingJobTips.length, 1);
    } else assert.equal(a.pendingJobTips.length, 0);
  }
  assert.ok(Math.abs(jobs / 1000 - 0.3) <= 0.03, `招工频率 ${jobs}/1000`);
});

test('radio tolerates absent optional fields and does not invent an endgame forecast', () => {
  const s = fresh(503);
  s.day = 100;
  delete s.pendingJobTips;
  const lines = bulletin(s, { forecast: [], closedTomorrow: false });
  assert.ok(lines.length >= 2 && lines.length <= 4);
  assert.match(lines.find((line) => line.kind === 'weather').text, /暂无/);
  assert.ok(Array.isArray(s.pendingJobTips));
  assert.match(bulletin(s, { closedTomorrow: true }).find((line) => line.kind === 'shop').text, /关门/);
});
