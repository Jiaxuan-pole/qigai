// 无状态纯规则：只吃数字，不碰 state。数值出处见策划 01 的章节号与 03 JSON 的 rules。
// 全部是虚构游戏参数，不模拟现实医疗、赔率或剂量。

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// 07 愿望：单条愿望本回合的精神损失。60-84 扣 1，85-100 扣 2。
export function wishMindLoss(intensity, rules) {
  const d = rules.desire;
  if (intensity >= d.highThreshold) return d.highMindLoss;
  if (intensity >= d.midThreshold) return d.midMindLoss;
  return 0;
}

// 07 多条愿望叠加封顶（默认每人每回合 3）。
export function wishPressure(intensities, rules) {
  const cap = rules.desire.mindLossCapPerActorPerTurn;
  const sum = intensities.reduce((a, x) => a + wishMindLoss(x, rules), 0);
  return Math.min(cap, sum);
}

// 07 强度分段的人物反应，UI 直接用。
export function wishStage(intensity) {
  if (intensity >= 85) return { key: 'obsessed', label: '反复纠结', hint: '执念，每回合精神-2' };
  if (intensity >= 60) return { key: 'nagging', label: '一直惦记', hint: '情绪受影响，每回合精神-1' };
  if (intensity >= 45) return { key: 'asked', label: '明确提出', hint: '已直接开口，给安排空间' };
  if (intensity >= 25) return { key: 'hinting', label: '暗示', hint: '多看两眼、转移话题' };
  return { key: 'idle', label: '只是念头', hint: '' };
}

// 08 精神危机链：一个行动回合更新一次，夜间不重复调用。
// state: {mind, zeroTurns, crisis, health}；pressure 为本回合愿望压力（已封顶），recovery 为本回合恢复量。
export function mindStep(state, pressure, recovery = 0, rules) {
  const mc = rules.mentalCrisis;
  const cap = rules.desire.mindLossCapPerActorPerTurn;
  let mind = clamp(state.mind + recovery - Math.min(cap, Math.max(0, pressure)));
  let zeroTurns = state.zeroTurns;
  let crisis = state.crisis;
  if (mind >= mc.recoveryMindThreshold) {
    zeroTurns = 0;
    crisis = false;
  } else if (mind === mc.triggerMind) {
    zeroTurns += 1;
    if (zeroTurns >= mc.consecutiveTurns) crisis = true;
  } else if (!crisis) {
    zeroTurns = 0;
  }
  const damage = crisis ? (mind === 0 ? mc.zeroMindHealthDamage : mc.lowMindHealthDamage) : 0;
  return { mind, zeroTurns, crisis, health: clamp(state.health - damage), damage };
}

// 09 每日一次暴露检定的概率。
export function hygieneRisk(hygiene, flags = {}, rules) {
  const h = rules.hygiene;
  let extra = 0;
  for (const [floor, add] of h.hygieneRiskBuckets) {
    if (hygiene >= floor) { extra = add; break; }
  }
  let p = h.baseRisk + extra;
  if (flags.dirtyFood) p += h.dirtyFoodExtra;
  if (flags.openWound) p += h.uncoveredWoundExtra;
  if (flags.care) p -= h.careReduction;
  return Math.min(h.riskCap, Math.max(0, Math.round(p * 1000) / 1000));
}

// 10 病情分段：返回每回合健康消耗与标签。
export function diseaseStage(severity, rules) {
  if (severity <= 0) return { stage: 0, label: '已缓解', damage: 0 };
  for (const [lo, hi, dmg] of rules.disease.healthDamageStages) {
    if (severity >= lo && severity <= hi) {
      const label = lo >= 85 ? '危重' : lo >= 60 ? '重度' : lo >= 30 ? '中度' : '轻度';
      return { stage: lo >= 85 ? 3 : lo >= 60 ? 2 : lo >= 30 ? 1 : 0, label, damage: dmg };
    }
  }
  return { stage: 0, label: '轻度', damage: 0 };
}

// 10 一个行动回合的病情推进。flags: dirty（卫生<25 或脏污工作）、matchingCare、rest、safeSleep（仅夜间轻症）。
export function diseaseStep(severity, health, flags = {}, rules) {
  if (severity <= 0) return { severity: 0, health, damage: 0 };
  const d = rules.disease;
  let growth = d.untreatedGrowthPerTurn;
  if (flags.dirty) growth += d.badHygieneExtra;
  if (flags.matchingCare) growth -= d.matchingCareReduction;
  if (flags.rest) growth -= d.restReduction;
  if (flags.safeSleep && severity < 30) growth -= d.safeSleepMildSeverityReduction;
  const next = clamp(severity + growth);
  const stage = diseaseStage(next, rules);
  return { severity: next, health: clamp(health - stage.damage), damage: stage.damage };
}

// 10.3 护理生效的四个条件缺一不可：有用品、计划匹配、真的安排了护理、同一容器可及。
export function canApplyCare({ hasSupply, matchedPlan, committedCare, sameContainerAccess }) {
  return Boolean(hasSupply && matchedPlan && committedCare && sameContainerAccess);
}

// 15 濒死：T 回合末健康 0，普通到 T+1 末，马哥首次到 T+2 末（整局一次）。
export function makeDowned(actorId, turn, gritUsed, rules) {
  const r = rules.rescue;
  const extra = actorId === rules.join.actorId && !gritUsed;
  return {
    deadline: turn + (extra ? r.maFirstFollowingTurns : r.standardFollowingTurns),
    gritUsed: gritUsed || extra,
    extra,
  };
}

// 15 期限判定：先救援后判死。
export function resolveDeadline(life, deadline, turn, rescued) {
  if (life !== 'downed') return life;
  if (rescued) return 'active';
  return turn >= deadline ? 'dead' : 'downed';
}

// 04 彩票：购买时按购票人牌彩运锁定返还（含本金）。
export function ticketOutcome(actorId, r, rules) {
  const g = rules.gambling;
  const weights = actorId === 'ma' ? g.ticketWeights.ma : g.ticketWeights.others;
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return g.ticketGrossPayouts[i];
  }
  return g.ticketGrossPayouts[g.ticketGrossPayouts.length - 1];
}

// 06 抽象牌局：入场 10，返还 20/10/0 含本金。
export function cardOutcome(actorId, r, rules) {
  const g = rules.gambling;
  const weights = actorId === 'ma' ? g.cardWeights.ma : g.cardWeights.others;
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return g.cardGrossPayouts[i];
  }
  return 0;
}

// 05 一次乞讨接触。modifiers.refusalShift 把拒绝权重挪给小额零钱（声望/技能用），不改总和。
export function begOutcome(r, rules, modifiers = {}) {
  const b = rules.begging;
  const weights = b.weights.slice();
  const shift = Math.max(0, Math.min(weights[0], modifiers.refusalShift || 0));
  weights[0] -= shift;
  weights[1] += shift;
  const total = weights.reduce((a, x) => a + x, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return { kind: b.outcomeKinds[i], cash: b.currencyOutcomes[i] };
  }
  return { kind: 'refusal', cash: 0 };
}

// 04 饭钱保护：max(0, 存活入队人数×2 − 有效食物份数)×8，另加已确认护理费。
export function foodReserve(aliveCount, effectiveFood, rules, careCommitted = 0) {
  return Math.max(0, aliveCount * rules.foodPerLivingActorPerDay - effectiveFood) * rules.foodPrice + careCommitted;
}

// 04 §06 对话输出契约校验。返回 {ok, reason}。
const DIALOGUE_KEYS = ['requestId', 'sceneId', 'stateRevision', 'lines', 'choiceLabels', 'desireCueRefs'];

export function validateDialogue(payload, context) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return bad('不是对象');
  const keys = Object.keys(payload).sort();
  if (keys.join(',') !== DIALOGUE_KEYS.slice().sort().join(',')) return bad('字段集合不符');
  for (const k of ['requestId', 'sceneId', 'stateRevision']) {
    if (payload[k] !== context[k]) return bad(k + ' 不匹配');
  }
  const lines = payload.lines;
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 6) return bad('lines 数量越界');
  for (const line of lines) {
    if (!line || typeof line !== 'object' || Object.keys(line).sort().join(',') !== 'speakerId,text') return bad('line 结构错误');
    if (!context.allowedCast.includes(line.speakerId)) return bad('说话人不在场或已死亡');
    if (typeof line.text !== 'string' || line.text.length < 1 || line.text.length > 160) return bad('台词长度越界');
    if (/[<>]/.test(line.text)) return bad('台词含标签字符');
  }
  const labels = payload.choiceLabels;
  if (!Array.isArray(labels)) return bad('choiceLabels 不是数组');
  const ids = [];
  for (const l of labels) {
    if (!l || typeof l !== 'object' || Object.keys(l).sort().join(',') !== 'choiceId,label') return bad('choiceLabel 结构错误');
    if (typeof l.label !== 'string' || l.label.length < 1 || l.label.length > 80) return bad('选项标签长度越界');
    ids.push(l.choiceId);
  }
  if (new Set(ids).size !== ids.length || ids.length !== context.requiredChoiceIds.length ||
      ids.some((id) => !context.requiredChoiceIds.includes(id))) return bad('选项集合与要求不符');
  const refs = payload.desireCueRefs;
  if (!Array.isArray(refs) || refs.some((x) => !context.allowedWishIds.includes(x))) return bad('引用了不允许的愿望');
  return { ok: true };
}

// 04 §08 事件提案校验。
export function validateEventProposal(payload, context) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return bad('不是对象');
  if (payload.requestId !== context.requestId) return bad('requestId 不匹配');
  if (payload.status === 'no_event') {
    if (Object.keys(payload).sort().join(',') !== 'requestId,status') return bad('无事件字段集合不符');
    return { ok: true, empty: true };
  }
  if (payload.status !== 'proposal') return bad('status 非法');
  if (!context.templateIds.includes(payload.templateId)) return bad('模板不在白名单');
  if (!context.themeIds.includes(payload.themeId)) return bad('主题不在白名单');
  if (!context.choiceBundleIds.includes(payload.choiceBundleId)) return bad('选项包不在白名单');
  if (!Array.isArray(payload.castIds) || payload.castIds.some((x) => !context.castIds.includes(x))) return bad('参与者不合法');
  if (typeof payload.title !== 'string' || payload.title.length < 1 || payload.title.length > 40) return bad('标题长度越界');
  if (typeof payload.setup !== 'string' || payload.setup.length < 1 || payload.setup.length > 200) return bad('情境长度越界');
  if (!Array.isArray(payload.choices) || payload.choices.length < 2 || payload.choices.length > 3) return bad('选项数量越界');
  const ids = new Set();
  for (const c of payload.choices) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).sort().join(',') !== 'choiceId,label') return bad('选项结构错误');
    if (!context.choiceIds.includes(c.choiceId)) return bad('choiceId 不在白名单');
    if (ids.has(c.choiceId)) return bad('选项重复');
    ids.add(c.choiceId);
    if (typeof c.label !== 'string' || c.label.length < 1 || c.label.length > 40) return bad('选项文字长度越界');
  }
  for (const k of Object.keys(payload)) {
    if (!['requestId', 'status', 'templateId', 'themeId', 'choiceBundleId', 'castIds', 'title', 'setup', 'choices'].includes(k)) return bad('越权字段 ' + k);
  }
  return { ok: true };
}

function bad(reason) {
  return { ok: false, reason };
}
