import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBegContext, validateBegPayload } from '../server/beg-ai.js';
import { UI } from '../public/ui/core.js';
import { requestBegText, cancelBegText, presentBegLog } from '../public/ui/beg-ai.js';

const context = (stage = 'open') => ({ requestId: 'beg-17', seed: 4321, day: 7, actorId: 'fan', npcId: 'market:3', npcName: '阿荣', job: '修伞', hint: '伞骨上沾着水', district: '老街', weather: '下雨', food: 25, hygiene: 60, recentLines: [], stage, opening: stage === 'open' ? null : 'direct', action: stage === 'result' ? 'food' : null, reaction: stage === 'open' ? null : 'like', resultKind: stage === 'result' ? 'food' : null });
const open = () => ({ requestId: 'beg-17', observation: '雨棚下有人在修一把旧伞。', choiceLabels: [{ optionId: 'compliment', text: '你这伞修得真仔细' }, { optionId: 'direct', text: '我今天缺饭，能帮帮忙吗' }, { optionId: 'story', text: '我的摄影机坏在了半路' }, { optionId: 'special', text: '我给你画张速写行吗' }] });

test('求助上下文只接收场景白名单，拒绝额外存档', () => {
  assert.equal(checkBegContext(context()), null);
  assert.equal(checkBegContext({ ...context(), cash: 999 }), '请求字段无效');
  assert.equal(checkBegContext({ ...context(), recentLines: ['x'.repeat(141)] }), '最近对话无效');
});

test('观察与开场标签必须完整、无未知ID、无HTML', () => {
  assert.equal(validateBegPayload(open(), context()), true);
  assert.equal(validateBegPayload({ ...open(), cash: 100 }, context()), false);
  const unknown = open(); unknown.choiceLabels[0].optionId = 'give_money';
  assert.equal(validateBegPayload(unknown, context()), false);
  const html = open(); html.observation = '<img src=x onerror=alert(1)>';
  assert.equal(validateBegPayload(html, context()), false);
  const wrongSpecial = open(); wrongSpecial.choiceLabels[3].text = '我帮你擦桌子，换口汤喝行不';
  assert.equal(validateBegPayload(wrongSpecial, context()), false);
});

test('回应与结果只接收一条短文字，数值字段无效', () => {
  for (const stage of ['reaction', 'result']) {
    assert.equal(checkBegContext(context(stage)), null);
    assert.equal(validateBegPayload({ requestId: 'beg-17', line: '对方把伞挪开，示意你接过饭。' }, context(stage)), true);
    assert.equal(validateBegPayload({ requestId: 'beg-17', line: '给你饭。', cash: 999 }, context(stage)), false);
    assert.equal(validateBegPayload({ requestId: 'beg-17', line: '<b>给你饭</b>' }, context(stage)), false);
    assert.equal(validateBegPayload({ requestId: 'beg-17', line: '话'.repeat(161) }, context(stage)), false);
  }
});

test('迟到的回应不覆盖新场景，超时保留本地文字', async () => {
  UI.ai.enabled = true;
  const originalFetch = globalThis.fetch;
  let release;
  let rendered = false;
  let current = true;
  globalThis.fetch = () => new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => ({ ok: true, payload: open() }) }); });
  try {
    const pending = requestBegText(context(), () => current, () => { rendered = true; });
    current = false;
    release();
    assert.equal(await pending, false);
    assert.equal(rendered, false);
    globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    assert.equal(await requestBegText({ ...context(), requestId: 'beg-timeout', npcId: 'market:4' }, () => true, () => { rendered = true; }, 5), false);
    assert.equal(rendered, false);
  } finally { cancelBegText(); globalThis.fetch = originalFetch; UI.ai.enabled = false; }
});

test('模型文字只进入展示回调，不改变现金、耐心和状态版本', async () => {
  const originalFetch = globalThis.fetch;
  UI.ai.enabled = true;
  UI.state = { cash: 37, stateRevision: 8, pending: { beg: [{ npcs: [{ patience: 2, result: { kind: 'food' } }] }] } };
  const before = structuredClone(UI.state);
  let line = '';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, payload: { requestId: 'beg-state', line: '对方把一份饭递了过来。' } }) });
  try {
    const c = { ...context('result'), requestId: 'beg-state', npcId: 'market:5' };
    assert.equal(await requestBegText(c, () => true, (payload) => { line = payload.line; }), true);
    assert.equal(line, '对方把一份饭递了过来。');
    assert.deepEqual(UI.state, before);
  } finally { cancelBegText(); globalThis.fetch = originalFetch; UI.ai.enabled = false; UI.state = null; }
});

test('历史回放只替换实际选中的AI开场白，保留路人回应与结果', () => {
  const engineLog = ['轩哥：“您手机卡不卡？我帮您清一下后台，不要钱。”', '对方：他没接话。', '对方把一份饭递过来。'];
  const shown = presentBegLog(engineLog, '轩哥', '我帮你修一下收银机，换口汤喝行不');
  assert.deepEqual(shown, ['轩哥：“我帮你修一下收银机，换口汤喝行不”', engineLog[1], engineLog[2]]);
  assert.deepEqual(engineLog, ['轩哥：“您手机卡不卡？我帮您清一下后台，不要钱。”', '对方：他没接话。', '对方把一份饭递过来。']);
  assert.deepEqual(presentBegLog(engineLog, '轩哥', null), engineLog);
});
