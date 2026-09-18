import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import {
  clamp, wishMindLoss, wishPressure, wishStage, mindStep, hygieneRisk,
  diseaseStage, diseaseStep, canApplyCare, makeDowned, resolveDeadline,
  ticketOutcome, cardOutcome, begOutcome, foodReserve,
  validateDialogue, validateEventProposal,
} from '../public/game/rules.js';
import { validateCart } from '../public/game/shop.js';

let rules;
before(async () => {
  const data = await loadData();
  rules = data.rules;
});

test('clamp 保留范围内数值并支持自定义上下界', () => {
  for (const [value, expected] of [[-1, 0], [0, 0], [28, 28], [100, 100], [101, 100]]) {
    assert.equal(clamp(value), expected, `数值 ${value} 必须限制在零至一百之间`);
  }
  assert.equal(clamp(3, 5, 9), 5, '自定义下界必须生效');
  assert.equal(clamp(12, 5, 9), 9, '自定义上界必须生效');
});

test('愿望单条压力分段与叠加封顶', () => {
  for (const [intensity, loss] of [[0, 0], [59, 0], [60, 1], [84, 1], [85, 2], [100, 2]]) {
    assert.equal(wishMindLoss(intensity, rules), loss, `强度 ${intensity} 的单条精神损失必须为 ${loss}`);
  }
  for (const [intensities, expected] of [[[], 0], [[59, 59], 0], [[60, 85], 3], [[100, 100, 100], 3]]) {
    assert.equal(wishPressure(Object.freeze(intensities), rules), expected, '愿望不足六十不扣精神，多条叠加每回合至多扣三');
  }
});

for (const [intensity, key] of [[0, 'idle'], [24, 'idle'], [25, 'hinting'], [44, 'hinting'], [45, 'asked'], [59, 'asked'], [60, 'nagging'], [84, 'nagging'], [85, 'obsessed'], [100, 'obsessed']]) {
  test(`愿望五段边界：强度 ${intensity}`, () => {
    assert.equal(wishStage(intensity).key, key, `强度 ${intensity} 必须落在策划规定的愿望阶段`);
  });
}

test('精神第一次归零不伤害，连续第四回合才扣八点健康', () => {
  const initial = Object.freeze({ mind: 0, zeroTurns: 0, crisis: false, health: 82 });
  let state = initial;
  for (let turn = 1; turn <= 4; turn++) {
    state = mindStep(state, 0, 0, rules);
    assert.deepEqual(state, { mind: 0, zeroTurns: turn, crisis: turn === 4, health: turn === 4 ? 74 : 82, damage: turn === 4 ? 8 : 0 }, `连续归零第 ${turn} 回合必须保留前三回合干预窗口`);
  }
  assert.equal(initial.health, 82, '精神推进不能修改传入角色状态');
});

test('持续压力三的参考算例恰在第二十三回合健康归零', () => {
  let state = { mind: 28, health: 82, zeroTurns: 0, crisis: false };
  for (let turn = 1; turn <= 23; turn++) {
    state = mindStep(state, 3, 0, rules);
    assert.equal(state.health === 0, turn === 23, `第 ${turn} 回合必须符合参考函数的二十三回合归零时点`);
  }
});

test('支持先恢复精神再结算压力，达到二十解除崩溃', () => {
  const initial = { mind: 0, health: 40, zeroTurns: 5, crisis: true };
  assert.deepEqual(mindStep(initial, 3, 23, rules), { mind: 20, health: 40, zeroTurns: 0, crisis: false, damage: 0 }, '恢复二十三再扣压力三必须在本回合解除危机并停止伤害');
  for (const recovery of [1, 19]) {
    assert.deepEqual(mindStep(initial, 0, recovery, rules), { mind: recovery, health: 36, zeroTurns: 5, crisis: true, damage: 4 }, '危机中精神一至十九仍扣四点健康且保留危机');
  }
  assert.equal(mindStep({ ...initial, health: 2 }, 0, 0, rules).health, 0, '危机伤害不能把健康扣成负数');
});

test('尚未崩溃时中断归零会清计数，压力上下界与恢复上界有效', () => {
  const initial = { mind: 0, health: 82, zeroTurns: 3, crisis: false };
  assert.equal(mindStep(initial, 0, 1, rules).zeroTurns, 0, '未崩溃时精神回到一必须中断连续归零');
  assert.equal(mindStep({ ...initial, mind: 10 }, 99, 0, rules).mind, 7, '调用者传入超过三的压力也必须封顶');
  assert.equal(mindStep({ ...initial, mind: 10 }, -3, 0, rules).mind, 10, '负压力不能变成额外精神奖励');
  assert.equal(mindStep(initial, 0, 120, rules).mind, 100, '精神恢复不能超过一百');
});

test('卫生四档边界、护理减免与四成风险上限', () => {
  for (const [hygiene, expected] of [[0, 0.18], [19, 0.18], [20, 0.04], [39, 0.04], [40, 0.025], [59, 0.025], [60, 0.02], [100, 0.02]]) {
    assert.equal(hygieneRisk(hygiene, {}, rules), expected, `卫生 ${hygiene} 必须使用对应风险档位`);
  }
  assert.equal(hygieneRisk(5, { dirtyFood: true, openWound: true }, rules), 0.4, '最脏加不洁食物和伤口的风险封顶四成');
  assert.equal(hygieneRisk(80, { care: true }, rules), 0, '护理降低风险但不能产生负概率');
  assert.equal(hygieneRisk(5, { dirtyFood: true, openWound: true, care: true }, rules), 0.34, '护理必须从总暴露风险中减去六个百分点');
  for (let bits = 0; bits < 8; bits++) {
    const flags = { dirtyFood: Boolean(bits & 1), openWound: Boolean(bits & 2), care: Boolean(bits & 4) };
    let previous = 1;
    for (let hygiene = 0; hygiene <= 100; hygiene++) {
      const risk = hygieneRisk(hygiene, flags, rules);
      assert.ok(risk <= previous && risk >= 0 && risk <= 0.4, '任意暴露组合下，卫生改善不能提高风险且风险始终在零至四成');
      previous = risk;
    }
  }
});

for (const [severity, stage, label, damage] of [[0, 0, '已缓解', 0], [1, 0, '轻度', 0], [29, 0, '轻度', 0], [30, 1, '中度', 3], [59, 1, '中度', 3], [60, 2, '重度', 6], [84, 2, '重度', 6], [85, 3, '危重', 10], [100, 3, '危重', 10]]) {
  test(`疾病四段边界：严重度 ${severity}`, () => {
    assert.deepEqual(diseaseStage(severity, rules), { stage, label, damage }, `严重度 ${severity} 的标签和伤害必须同时对应策划分段`);
  });
}

test('匹配护理加休整十回合清零，重病不处理二十回合健康归零', () => {
  let treated = { severity: 70, health: 100 };
  for (let turn = 1; turn <= 10; turn++) {
    treated = diseaseStep(treated.severity, treated.health, { matchingCare: true, rest: true }, rules);
    assert.equal(treated.severity, 70 - turn * 7, '护理减七加休整减三与基础增长三叠加后，每回合净减七');
  }
  assert.ok(treated.health > 0, '十回合匹配护理必须在活着时使病情归零');
  let untreated = { severity: 70, health: 100 };
  for (let turn = 0; turn < 20; turn++) untreated = diseaseStep(untreated.severity, untreated.health, {}, rules);
  assert.deepEqual(untreated, { severity: 100, health: 0, damage: 10 }, '重病不处理二十回合须封顶严重度并扣到零健康');
});

test('疾病按推进后阶段扣血，安全睡眠只额外改善推进前轻症', () => {
  for (const [severity, expected] of [[27, { severity: 30, health: 97, damage: 3 }], [57, { severity: 60, health: 94, damage: 6 }], [82, { severity: 85, health: 90, damage: 10 }]]) {
    assert.deepEqual(diseaseStep(severity, 100, {}, rules), expected, '跨过分段阈值的本回合必须按新病情扣血');
  }
  assert.equal(diseaseStep(20, 100, { dirty: true }, rules).severity, 25, '脏污条件只额外增长二，不重复叠加');
  assert.deepEqual(diseaseStep(29, 100, { safeSleep: true }, rules), { severity: 30, health: 97, damage: 3 }, '原病情二十九可享受安全睡眠额外减二');
  assert.equal(diseaseStep(30, 100, { safeSleep: true }, rules).severity, 33, '原病情三十不再享受轻症睡眠减免');
  assert.deepEqual(diseaseStep(2, 100, Object.freeze({ matchingCare: true, rest: true }), rules), { severity: 0, health: 100, damage: 0 }, '充分护理归零后不产生负严重度或残留伤害');
  assert.deepEqual(diseaseStep(0, 40, { dirty: true }, rules), { severity: 0, health: 40, damage: 0 }, '病情已经归零时推进不能凭空重新发病或回血');
});

test('护理四个条件缺一不可，光有库存不治疗', () => {
  const ready = { hasSupply: true, matchedPlan: true, committedCare: true, sameContainerAccess: true };
  assert.equal(canApplyCare(ready), true, '用品、匹配计划、已排护理和同容器可及全齐才生效');
  for (const key of Object.keys(ready)) {
    assert.equal(canApplyCare({ ...ready, [key]: false }), false, `护理缺少条件 ${key} 时必须拒绝`);
    const missing = { ...ready };
    delete missing[key];
    assert.equal(canApplyCare(missing), false, `护理未提供条件 ${key} 时必须拒绝`);
  }
});

test('马哥命硬整局一次，期限回合先救援后判死', () => {
  assert.deepEqual(makeDowned('ma', 9, false, rules), { deadline: 11, gritUsed: true, extra: true }, '马哥首次濒死必须得到两回合并消耗命硬');
  assert.deepEqual(makeDowned('ma', 9, true, rules), { deadline: 10, gritUsed: true, extra: false }, '马哥再次濒死只有一回合');
  for (const actor of ['xuan', 'fan']) {
    assert.deepEqual(makeDowned(actor, 9, false, rules), { deadline: 10, gritUsed: false, extra: false }, '其他角色只有一回合且不能获得马哥特质');
  }
  assert.equal(resolveDeadline('downed', 10, 9, false), 'downed', '截止前不能提前判死');
  for (const turn of [10, 11]) assert.equal(resolveDeadline('downed', 10, turn, false), 'dead', '达到或超过截止回合且未获救必须死亡');
  assert.equal(resolveDeadline('downed', 10, 10, true), 'active', '期限回合救援成功必须先于死亡判定');
  for (const life of ['active', 'dead', 'unjoined']) assert.equal(resolveDeadline(life, 10, 10, true), life, '期限函数只改变濒死者，不复活死者或招募未入队者');
});

test('第一百日末保留至四百零二回合的既有救援尾声', () => {
  const downed = makeDowned('ma', rules.durationDays * rules.slotsPerDay, false, rules);
  assert.equal(downed.deadline, 402, '第一百日最后一回合首次濒死的马哥仍有两次救援机会');
  assert.equal(rules.rescue.tailMaxGlobalTurn, 402, '尾声上限须与策划四百零二回合一致');
  assert.equal(rules.rescue.noNewWorkOrIncomeInTail, true, '尾声规则必须禁止新工作和正常收入');
  assert.equal(resolveDeadline('downed', downed.deadline, 401, false), 'downed', '尾声第一回合不能提早终局');
  assert.equal(resolveDeadline('downed', downed.deadline, 402, true), 'active', '最后尾声回合仍允许及时救援');
  assert.equal(resolveDeadline('downed', downed.deadline, 402, false), 'dead', '最后尾声回合未救援才判死');
});

for (const [name, outcome, payoutKey, weightKey, costKey, netMeans] of [
  ['彩票', ticketOutcome, 'ticketGrossPayouts', 'ticketWeights', 'ticketPrice', { ma: 0.25, xuan: -3.40, fan: -3.40 }],
  ['牌局', cardOutcome, 'cardGrossPayouts', 'cardWeights', 'cardStake', { ma: 2.5, xuan: -0.5, fan: -0.5 }],
]) {
  for (const actor of ['ma', 'xuan', 'fan']) test(`${name}：${actor} 的赔率、含本金返还与零点零零五步长频率`, () => {
    const g = rules.gambling;
    const payouts = g[payoutKey];
    const weights = g[weightKey][actor === 'ma' ? 'ma' : 'others'];
    assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 100, '各角色每张权重表必须归一到一百');
    const counts = payouts.map(() => 0);
    let midpointTotal = 0;
    for (let i = 0; i < 200; i++) {
      const payout = outcome(actor, i / 200, rules);
      assert.ok(payouts.includes(payout), '实际抽样不能出现权重表之外的返还');
      counts[payouts.indexOf(payout)]++;
      midpointTotal += outcome(actor, (i + 0.5) / 200, rules);
    }
    for (let i = 0; i < weights.length; i++) {
      assert.ok(Math.abs(counts[i] / 200 - weights[i] / 100) <= 0.01 + 1e-12, `返还 ${payouts[i]} 的实测频率与权重误差不得超过一个百分点`);
    }
    const grossMean = payouts.reduce((sum, payout, i) => sum + payout * weights[i] / 100, 0);
    assert.ok(Math.abs(grossMean - g[costKey] - netMeans[actor]) < 1e-9, '彩票净期望与牌局含本金返还必须符合参考算例');
    assert.ok(Math.abs(midpointTotal / 200 - grossMean) < 1e-9, '抽样函数的区间中点平均返还必须与权重期望一致');
    if (name === '牌局' && actor === 'ma') assert.equal(midpointTotal / 200, 12.5, '马哥牌局平均返还十二点五必须包含本金');
  });
}

test('乞讨权重和为一百，拒绝修正只转移到三元零钱', () => {
  const b = rules.begging;
  const original = structuredClone(b);
  assert.equal(b.weights.reduce((sum, weight) => sum + weight, 0), 100, '六种乞讨结果权重必须归一到一百');
  const outcomeKeys = b.outcomeKinds.map((kind, i) => `${kind}:${b.currencyOutcomes[i]}`);
  for (const [shift, moved] of [[0, 0], [10, 10], [-10, 0], [35, 35], [100, 35]]) {
    const counts = b.weights.map(() => 0);
    for (let i = 0; i < 200; i++) {
      const result = begOutcome((i + 0.5) / 200, rules, { refusalShift: shift });
      const index = outcomeKeys.indexOf(`${result.kind}:${result.cash}`);
      assert.ok(index >= 0, '乞讨只能返回规定的零钱、食物、线索或拒绝');
      counts[index]++;
    }
    const expected = b.weights.map((weight, i) => (weight + (i === 0 ? -moved : i === 1 ? moved : 0)) * 2);
    assert.deepEqual(counts, expected, '修正须限于拒绝和三元之间挪动，其他四档概率不变且总和不变');
  }
  assert.deepEqual(b, original, '抽样修正不能改写共享规则权重');
});

test('饭钱按实际规则单价和存活者日用餐份数计算，再加护理费', () => {
  for (const [alive, food, care, expected] of [[3, 0, 0, 48], [2, 1, 12, 36], [3, 6, 12, 12], [3, 8, 0, 0], [0, 0, 0, 0]]) {
    assert.equal(foodReserve(alive, food, rules, care), expected, '缺餐才预留饭钱，食物富余不能抵扣已确认护理费用');
  }
  const changed = structuredClone(rules);
  changed.foodPrice = 11;
  changed.foodPerLivingActorPerDay = 3;
  assert.equal(foodReserve(2, 1, changed, 7), 62, '饭钱必须读取传入规则的单价与每日份数，不能硬编码八元两餐');
});

test('参考交易算例：远程和关门被拒，同区营业可买', () => {
  const state = { day: 1, reputation: 50, shops: { pharmacy: { stock: { bandage: 1 }, closedSlots: [] } }, actors: { xuan: { intox: 0 } } };
  const cart = [{ shopId: 'pharmacy', itemId: 'bandage', qty: 1 }];
  assert.ok(validateCart(state, 'xuan', 'camp', 1, cart).error, '参考函数要求远程药房交易被拒');
  assert.ok(validateCart(state, 'xuan', 'service', 3, cart).error, '参考函数要求药房关门时交易被拒');
  assert.equal(validateCart(state, 'xuan', 'service', 1, cart).total, 8, '参考函数要求同区营业时合法购买绷带');
});

const dialogueContext = { requestId: 'r1', sceneId: 'camp', stateRevision: 7, allowedCast: ['xuan', 'fan'], requiredChoiceIds: ['rest'], allowedWishIds: ['wish1'] };
const dialogue = { requestId: 'r1', sceneId: 'camp', stateRevision: 7, lines: [{ speakerId: 'xuan', text: '先缓一缓。' }], choiceLabels: [{ choiceId: 'rest', label: '一起休整' }], desireCueRefs: ['wish1'] };

test('合法对话通过，空选项场景和六条台词边界通过', () => {
  assert.deepEqual(validateDialogue(dialogue, dialogueContext), { ok: true }, '参考对话结构不能被误拒');
  assert.equal(validateDialogue({ ...dialogue, choiceLabels: [], lines: Array.from({ length: 6 }, () => ({ speakerId: 'fan', text: '好'.repeat(160) })) }, { ...dialogueContext, requiredChoiceIds: [] }).ok, true, '允许没有选项的场景，六条各一百六十字台词在范围内');
});

for (const [name, change] of [
  ['顶层越权金额', p => { p.cashDelta = 999; }], ['死者或不在场角色发言', p => { p.lines[0].speakerId = 'ma'; }],
  ['过期版本', p => { p.stateRevision = 6; }], ['错误请求', p => { p.requestId = 'old'; }], ['错误场景', p => { p.sceneId = 'station'; }],
  ['未知选项', p => { p.choiceLabels[0].choiceId = 'revive'; }], ['缺失选项', p => { p.choiceLabels = []; }], ['重复选项', p => { p.choiceLabels.push(p.choiceLabels[0]); }],
  ['数组伪装选项标识', p => { p.choiceLabels[0].choiceId = ['rest']; }], ['未知愿望', p => { p.desireCueRefs = ['new_wish']; }],
  ['台词越权字段', p => { p.lines[0].health = 100; }], ['选项越权字段', p => { p.choiceLabels[0].cash = 100; }],
  ['空台词组', p => { p.lines = []; }], ['七条台词', p => { p.lines = Array(7).fill(p.lines[0]); }],
  ['台词非文本', p => { p.lines[0].text = 1; }], ['台词超长', p => { p.lines[0].text = '字'.repeat(161); }],
  ['空选项文案', p => { p.choiceLabels[0].label = ''; }], ['选项文案超长', p => { p.choiceLabels[0].label = '字'.repeat(81); }], ['缺必填字段', p => { delete p.desireCueRefs; }],
]) test(`对话拒绝：${name}`, () => {
  const payload = structuredClone(dialogue);
  change(payload);
  assert.equal(validateDialogue(payload, dialogueContext).ok, false, `对话必须拒绝${name}，不能把模型数据当成合法状态或选项`);
});

test('对话选项集合不能用逗号拼接碰撞绕过白名单', () => {
  const payload = { ...dialogue, choiceLabels: [{ choiceId: 'rest,wait', label: '伪造选项' }] };
  assert.equal(validateDialogue(payload, { ...dialogueContext, requiredChoiceIds: ['rest', 'wait'] }).ok, false, '两个独立选项不能被一个含逗号的未知标识替代');
});

const eventContext = { requestId: 'e1', templateIds: ['street_cards'], themeIds: ['rain_shelter'], choiceBundleIds: ['cards_observe_play_leave'], castIds: ['ma', 'npc_table_regular_7'], choiceIds: ['observe', 'join_paid', 'leave'] };
const proposal = { requestId: 'e1', status: 'proposal', templateId: 'street_cards', themeId: 'rain_shelter', choiceBundleId: 'cards_observe_play_leave', castIds: ['ma', 'npc_table_regular_7'], title: '雨棚下的牌桌', setup: '雨还没停，桌边空着一张凳子。', choices: [{ choiceId: 'observe', label: '看看再说' }, { choiceId: 'leave', label: '先走了' }] };

test('合法事件提案与无事件响应通过', () => {
  assert.deepEqual(validateEventProposal(proposal, eventContext), { ok: true }, '白名单内模板和两个合法选项必须通过');
  assert.equal(validateEventProposal({ ...proposal, choices: [...proposal.choices, { choiceId: 'join_paid', label: '查看条件' }] }, eventContext).ok, true, '三个合法选项也必须通过');
  assert.deepEqual(validateEventProposal({ requestId: 'e1', status: 'no_event' }, eventContext), { ok: true, empty: true }, '没有合法组合时允许只返回请求标识和无事件状态');
});

for (const [name, change] of [
  ['未知模板', p => { p.templateId = 'unknown'; }], ['未知主题', p => { p.themeId = 'unknown'; }], ['未知选项包', p => { p.choiceBundleId = 'unknown'; }],
  ['未知选项', p => { p.choices[0].choiceId = 'revive'; }], ['死者或不在场人物', p => { p.castIds.push('dead_actor'); }],
  ['顶层越权金额', p => { p.cashDelta = 999; }], ['选项内越权金额', p => { p.choices[0].cashDelta = 999; }],
  ['重复选项', p => { p.choices[1].choiceId = p.choices[0].choiceId; }], ['错误请求', p => { p.requestId = 'old'; }],
  ['非法状态', p => { p.status = 'accepted'; }], ['空标题', p => { p.title = ''; }], ['超长标题', p => { p.title = '字'.repeat(41); }],
  ['空情境', p => { p.setup = ''; }], ['超长情境', p => { p.setup = '字'.repeat(201); }], ['少于两个选项', p => { p.choices.pop(); }],
  ['多于三个选项', p => { p.choices = Array(4).fill(p.choices[0]); }], ['空选项', p => { p.choices[0] = null; }],
  ['空选项文案', p => { p.choices[0].label = ''; }], ['超长选项文案', p => { p.choices[0].label = '字'.repeat(41); }],
]) test(`事件拒绝：${name}`, () => {
  const payload = structuredClone(proposal);
  change(payload);
  assert.equal(validateEventProposal(payload, eventContext).ok, false, `事件必须拒绝${name}，只允许模型提供白名单内文本提案`);
});

for (const key of ['cashDelta', 'templateId', 'choices']) test(`无事件响应拒绝额外字段：${key}`, () => {
  assert.equal(validateEventProposal({ requestId: 'e1', status: 'no_event', [key]: 999 }, eventContext).ok, false, '无事件分支也必须检查字段，不能绕过越权校验');
});

test('两种校验器拒绝非对象输出，无事件也要核对请求', () => {
  for (const payload of [null, [], 'text', 1]) {
    assert.equal(validateDialogue(payload, dialogueContext).ok, false, '对话 JSON 顶层必须是对象');
    assert.equal(validateEventProposal(payload, eventContext).ok, false, '事件 JSON 顶层必须是对象');
  }
  assert.equal(validateEventProposal({ requestId: 'old', status: 'no_event' }, eventContext).ok, false, '无事件响应仍然不能串用旧请求');
});
