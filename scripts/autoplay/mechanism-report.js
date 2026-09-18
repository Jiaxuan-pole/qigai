import { createMechanismMetrics } from './mechanism-metrics.js';

export function summarizeMechanisms(runs) {
  const shape = createMechanismMetrics();
  return Object.fromEntries(Object.entries(shape).filter(([key]) => !key.startsWith('_')).map(([group, defaults]) => {
    const keys = new Set([...Object.keys(defaults), ...runs.flatMap((run) => Object.keys(run.mechanics?.[group] || {}))]);
    return [group, Object.fromEntries([...keys].map((key) => {
      const values = runs.map((run) => run.mechanics?.[group]?.[key] || 0);
      const total = values.reduce((sum, value) => sum + value, 0);
      return [key, { total, mean: runs.length ? total / runs.length : 0, samples: values.filter((value) => value !== 0).length, min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 }];
    }))];
  }));
}

const value = (number) => Number(number.toFixed(2));
const rate = (a, b) => b ? `${value(a * 100 / b)}%` : '无样本';
const GROUPS = { bins: '翻桶', beg: '读人乞讨', phonestall: '手机摊', shellgame: '猜球摊', salvage: '旧物', favors: '委托', facility: '设施' };
const FIELDS = [
  ['翻桶行动', 'bins', 'actions'], ['桶数（含开板即放弃）', 'bins', 'boards'], ['揭格数', 'bins', 'reveals'], ['脏物次数', 'bins', 'dirtHits'],
  ['桶内零钱', 'bins', 'cash'], ['瓶罐（按1元折现）', 'bins', 'bottles'], ['实际售瓶现金（勿重复计入净收益）', 'bins', 'bottleSales'],
  ['不洁面包份数', 'bins', 'bread'], ['不洁面包即时吃下', 'bins', 'dirtyBreadImmediate'], ['纸板', 'bins', 'cardboard'], ['零件', 'bins', 'parts'], ['布料', 'bins', 'cloth'],
  ['肥皂碎块（每块1次）', 'bins', 'soap'], ['翻桶肥皂使用次数', 'bins', 'soapUsed'], ['烟头', 'bins', 'butts'], ['坏手机', 'bins', 'broken_phone'], ['坏收音机', 'bins', 'broken_radio'], ['坏耳机', 'bins', 'broken_headphones'],
  ['手套购买次数', 'bins', 'glovesBought'], ['手套支出', 'bins', 'gloveExpense'], ['翻桶净现金及瓶罐折现', 'bins', 'netCash'],
  ['读人场次', 'beg', 'sessions'], ['日间现金低于乞讨门槛次数', 'beg', 'lowCashSlots'], ['低现金但被高优先级排程占用', 'beg', 'blockedLowCashSlots'], ['开场次数', 'beg', 'openings'], ['like次数', 'beg', 'likes'], ['开口次数', 'beg', 'asks'], ['开口成功次数', 'beg', 'successes'],
  ['读人净现金', 'beg', 'netCash'], ['读人获赠饭', 'beg', 'food'], ['读人线索', 'beg', 'tips'], ['被拒精神损失', 'beg', 'refusalMindLoss'],
  ['手机摊次数', 'phonestall', 'actions'], ['手机摊净收入', 'phonestall', 'netCash'], ['猜球摊次数', 'shellgame', 'actions'], ['猜球摊净收入', 'shellgame', 'netCash'], ['被城管赶走', 'shellgame', 'expelled'],
  ['修复件数', 'salvage', 'repairs'], ['旧物卖出', 'salvage', 'sold'], ['旧物留下', 'salvage', 'kept'], ['留下收音机', 'salvage', 'radiosKept'], ['旧物回赠', 'salvage', 'gifted'], ['修好未处置', 'salvage', 'unsold'], ['旧物净现金（零件另列）', 'salvage', 'netCash'],
  ['委托接单', 'favors', 'accepted'], ['委托完成', 'favors', 'completed'], ['委托失约', 'favors', 'expired'], ['委托净现金', 'favors', 'netCash'], ['委托额外工作餐', 'favors', 'bonusMeals'],
  ['设施建造', 'facility', 'built'], ['收音机夜间播报', 'upkeep', 'radioNights'], ['洗漱总次数', 'upkeep', 'washes'],
  ['肠胃病', 'diseases', 'gut'], ['皮肤病', 'diseases', 'skin'], ['伤口感染', 'diseases', 'wound'], ['受寒虚弱', 'diseases', 'chill'],
  ['pending兜底次数', 'pending', 'fallbacks'], ['终局pending余量', 'pending', 'remaining'], ['机制即时接口失败', 'commands', 'failures'],
];

export function mechanismSection(entries) {
  const cell = (entry, group, field) => {
    const stat = entry.summary.mechanics[group][field];
    return `${value(stat.mean)}（${stat.samples}/${entry.summary.runCount}；最少${stat.min}）`;
  };
  const lines = [
    '## 第二批机制同种子对照', '',
    '各格为“每局均值（该指标非零样本数/总局数；单局最少）”，零触发局留在分母。各机制的行动/场次行给出实际触发覆盖；收入为零不代表没有执行。净收益采用现金与资源分开计量：瓶罐按已实现的1元/个回收价折现，翻桶净额为零钱+瓶罐−手套支出；面包、纸板、零件、布料、肥皂按实物单位列示。肥皂碎块只有1次使用量，不能当作整块5次装折价；不洁面包也不冒充无风险正餐。旧物净现金不扣虚拟购料费，实际耗材在机会成本表列示。', '',
    `| 指标 | ${entries.map((entry) => entry.label).join(' | ')} |`,
    `| --- | ${entries.map(() => '---:').join(' | ')} |`,
  ];
  for (const [label, group, field] of FIELDS) lines.push(`| ${label} | ${entries.map((entry) => cell(entry, group, field)).join(' | ')} |`);
  lines.push(`| 开场命中率（like/开场） | ${entries.map((entry) => rate(entry.summary.mechanics.beg.likes.total, entry.summary.mechanics.beg.openings.total)).join(' | ')} |`);
  lines.push(`| 开口成功率（获益/开口） | ${entries.map((entry) => rate(entry.summary.mechanics.beg.successes.total, entry.summary.mechanics.beg.asks.total)).join(' | ')} |`);
  lines.push(`| 预检失败（每局；失败样本数） | ${entries.map((entry) => `${value(entry.summary.preflightFailures / entry.summary.runCount)}；${entry.summary.preflightFailureSamples}/${entry.summary.runCount}`).join(' | ')} |`, '');
  const balanced = entries.find((entry) => entry.id === 'balanced')?.summary;
  if (balanced && balanced.mechanics.beg.sessions.samples < balanced.runCount) {
    const absent = balanced.runCount - balanced.mechanics.beg.sessions.samples;
    const noLowCash = balanced.runCount - balanced.mechanics.beg.lowCashSlots.samples;
    lines.push(`覆盖验收未全部通过：均衡读人乞讨 ${balanced.mechanics.beg.sessions.samples}/${balanced.runCount} 局触发，${absent} 局为零；其中 ${noLowCash} 局在马哥日间决策时从未出现“现金 < 存活人数×16”的条件。保留严格门槛与维护优先级，没有人为花掉储备来制造互动。零触发不算通过，逐种子原因见交办单5回执。`, '');
  }
  lines.push('### 机会成本', '',
    '被替换工作数取成功执行的机制行动与原计划的差异；放弃工资按原工作公开固定工资及已解锁加成估算，未伪装成实际扣款。追加洗漱指翻桶暴露后、由卫生维护触发且尚有卫生损耗未恢复的洗漱，不是控制全部状态的独立因果估计。未给无售卖接口的材料编造价格；材料消耗和替代基础维修省下的零件独立列出。count接单即时完成、无额外行动，奖励餐与常规帮厨一起结算。', '',
    `| 指标 | ${entries.map((entry) => entry.label).join(' | ')} |`, `| --- | ${entries.map(() => '---:').join(' | ')} |`);
  for (const [group, label] of Object.entries(GROUPS)) {
    for (const [field, text] of [['replacedWork', '替换工作'], ['lostWorkCash', '放弃固定工资'], ['additionalWashes', '追加洗漱'], ['partsConsumed', '耗零件'], ['woodConsumed', '耗木料'], ['clothConsumed', '耗布料'], ['savedWorkParts', '替换工作省零件']]) {
      lines.push(`| ${label}·${text} | ${entries.map((entry) => cell(entry, group, field)).join(' | ')} |`);
    }
  }
  lines.push('', '只做刘姐帮厨、老陈跑腿的首个 count 委托；借物与 deliver 型委托未验证。修理桌只在营地箱有坏电视时考虑，桶不掉电视；剧情赠送坏电视可触发施工。手套只在轩哥到达旧影院且留足救援、护理、两餐储备时采购；常规路线可能不经过该店，熟练度≥6仍可看到脏格警告。', '');
  return lines.join('\n');
}
