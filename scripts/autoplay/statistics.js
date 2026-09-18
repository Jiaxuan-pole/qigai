import { summarizeMechanisms, mechanismSection } from './mechanism-report.js';

export function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(q * sorted.length) - 1);
  return sorted[index];
}

const quantiles = (values) => ({
  count: values.length,
  p10: quantile(values, 0.1),
  p50: quantile(values, 0.5),
  p90: quantile(values, 0.9),
});

function sumMaps(runs, field) {
  const totals = {};
  for (const run of runs) {
    for (const [key, value] of Object.entries(run[field] || {})) totals[key] = (totals[key] || 0) + value;
  }
  return totals;
}

const sortedEntries = (record, limit = Infinity) => Object.entries(record)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
  .slice(0, limit);

const MIND_ACCOUNTS = ['work', 'wish', 'body', 'hobby', 'night', 'other'];

function emptyBreakdownSummary() {
  return {
    work: { actorSlots: 0, cash: 0, mealGrants: 0 },
    replacements: { hobby: 0, care: 0, shopping: 0, warmth: 0, preflight: 0, mechanics: 0 },
    meals: { consumed: 0, extraMeals: 0, immediate: 0, night: 0 },
    mind: {
      inferred: true,
      ...Object.fromEntries(MIND_ACCOUNTS.map((key) => [key, { positive: 0, negative: 0, net: 0 }])),
      observedDelta: 0,
    },
    mindBand40To70: { actorTurns: 0, totalActorTurns: 0, percentage: null },
  };
}

function addBreakdown(target, source) {
  if (!source) return target;
  for (const key of Object.keys(target.work)) target.work[key] += source.work?.[key] || 0;
  for (const key of Object.keys(target.replacements)) target.replacements[key] += source.replacements?.[key] || 0;
  for (const key of Object.keys(target.meals)) target.meals[key] += source.meals?.[key] || 0;
  for (const key of MIND_ACCOUNTS) {
    target.mind[key].positive += source.mind?.[key]?.positive || 0;
    target.mind[key].negative += source.mind?.[key]?.negative || 0;
    target.mind[key].net += source.mind?.[key]?.net || 0;
  }
  target.mind.observedDelta += source.mind?.observedDelta || 0;
  target.mindBand40To70.actorTurns += source.mindBand40To70?.actorTurns || 0;
  target.mindBand40To70.totalActorTurns += source.mindBand40To70?.totalActorTurns || 0;
  target.mindBand40To70.percentage = target.mindBand40To70.totalActorTurns
    ? target.mindBand40To70.actorTurns * 100 / target.mindBand40To70.totalActorTurns : null;
  return target;
}

const aggregateBreakdown = (runs, select) => runs.reduce((total, run) => addBreakdown(total, select(run)), emptyBreakdownSummary());

export function summarizeRuns(runs) {
  const n = runs.length;
  const survivorCounts = { 3: 0, 2: 0, 1: 0, 0: 0 };
  for (const run of runs) survivorCounts[run.survivors]++;
  const checkpoints = {};
  const metric = (rows, key) => quantile(rows.map((row) => row[key]).filter(Number.isFinite), 0.5);
  for (let day = 10; day <= 100; day += 10) {
    const rows = runs.map((run) => run.series.find((row) => row.day === day)).filter(Boolean);
    checkpoints[day] = {
      count: rows.length,
      cash: metric(rows, 'cash'),
      health: metric(rows, 'health'),
      mind: metric(rows, 'mind'),
      hygiene: metric(rows, 'hygiene'),
    };
  }
  const firstDeaths = runs.map((run) => run.firstDeathDay).filter((day) => day !== null);
  const deathReasons = {};
  for (const run of runs) for (const death of run.deaths) deathReasons[death.cause] = (deathReasons[death.cause] || 0) + 1;
  const stageLabels = ['D1-20', 'D21-40', 'D41-60', 'D61-80', 'D81-100'];
  return {
    runCount: n,
    completedDay100: runs.filter((run) => run.completedDay100).length,
    survivalRates: Object.fromEntries(Object.entries(survivorCounts).map(([count, value]) => [count, n ? value * 100 / n : 0])),
    cashQuantiles: {
      p10: quantile(runs.map((run) => run.cash), 0.1),
      p50: quantile(runs.map((run) => run.cash), 0.5),
      p90: quantile(runs.map((run) => run.cash), 0.9),
    },
    hourTicks: quantiles(runs.map((run) => run.hourTick).filter(Number.isFinite)),
    actionCounts: quantiles(runs.map((run) => run.actionCount).filter(Number.isFinite)),
    checkpoints,
    deathReasons: sortedEntries(deathReasons),
    firstDeathDay: { count: firstDeaths.length, ...quantiles(firstDeaths) },
    preflightFailures: runs.reduce((sum, run) => sum + run.preflightFailures, 0),
    preflightFailureSamples: runs.filter((run) => run.preflightFailures > 0).length,
    mechanics: summarizeMechanisms(runs),
    preflightReasons: sortedEntries(sumMaps(runs, 'preflightReasons'), 5),
    stoppageReasons: sortedEntries(sumMaps(runs, 'stoppageReasons')),
    foodOutageDays: runs.reduce((sum, run) => sum + run.foodOutageDays, 0),
    wishBreakdowns: runs.reduce((sum, run) => sum + run.wishBreakdowns, 0),
    diseaseCases: runs.reduce((sum, run) => sum + run.diseaseCases, 0),
    lotteryBuyDays: runs.reduce((sum, run) => sum + run.lotteryBuyDays, 0),
    cardGameDays: runs.reduce((sum, run) => sum + run.cardGameDays, 0),
    cigarettePurchases: runs.reduce((sum, run) => sum + (run.cigarettePurchases || 0), 0),
    ordinaryCash: quantiles(runs.flatMap((run) => run.dayCash.ordinary)),
    deliveryCash: quantiles(runs.flatMap((run) => run.dayCash.delivery)),
    careCash: quantiles(runs.flatMap((run) => run.dayCash.care)),
    breakdown: aggregateBreakdown(runs, (run) => run.breakdown),
    stages: Object.fromEntries(stageLabels.map((label) => [label, aggregateBreakdown(runs, (run) => run.stages?.[label])])),
  };
}

const value = (number) => number === null || number === undefined ? '无样本' : String(Math.round(number * 10) / 10);
const percentage = (number) => `${value(number)}%`;
const rowList = (entries) => entries.length ? entries.map(([key, count]) => `${key} ${count}`).join('；') : '无';
const cashBand = (band) => `n=${band.count}，p10=${value(band.p10)}，p50=${value(band.p50)}，p90=${value(band.p90)}`;
const BLOCKS = '▁▂▃▄▅▆▇█';

function sparkline(values, fixed = null) {
  const present = values.filter(Number.isFinite);
  if (!present.length) return values.map(() => '·').join('');
  const low = fixed ? fixed[0] : Math.min(...present);
  const high = fixed ? fixed[1] : Math.max(...present);
  return values.map((entry) => {
    if (!Number.isFinite(entry)) return '·';
    if (high === low) return BLOCKS[3];
    const index = Math.max(0, Math.min(BLOCKS.length - 1, Math.round((entry - low) / (high - low) * (BLOCKS.length - 1))));
    return BLOCKS[index];
  }).join('');
}

const signed = (number) => number > 0 ? `+${value(number)}` : value(number);
const mindAccount = (entry) => `${signed(entry.positive)} / ${signed(entry.negative)} / 净${signed(entry.net)}`;
const replacementText = (entry) => `爱好 ${entry.hobby}、护理 ${entry.care}、购物 ${entry.shopping}、保暖 ${entry.warmth}、预检 ${entry.preflight}、机制 ${entry.mechanics}`;

function breakdownSection(summary) {
  const rows = [['总计', summary.breakdown], ...Object.entries(summary.stages)];
  const lines = [
    '### 分项统计与 20 日阶段',
    '',
    '精神分项为按结算前后状态与成功任务推算；每格观察净变化由 other 残差对账。other 包含维护行动、即时烟等物品效果、救援、数值 clamp 与未分类残差。精神格显示“正 / 负 / 净”。工作发放的餐记在工作餐，不计为已经吃到。',
    '',
    '| 阶段 | 劳动人次格 | 劳动现金 | 工作餐份数 | 替换计划工作 | 实际吃餐 | 补餐（即时/夜间） | 精神：工作 | 愿望 | 身体 | 爱好 | 夜间 | other | 40–70 精神角色回合 |',
    '| --- | ---: | ---: | ---: | --- | ---: | --- | --- | --- | --- | --- | --- | --- | ---: |',
  ];
  for (const [label, row] of rows) {
    lines.push(`| ${label} | ${row.work.actorSlots} | ${row.work.cash} | ${row.work.mealGrants} | ${replacementText(row.replacements)} | ${row.meals.consumed} | ${row.meals.extraMeals}（${row.meals.immediate}/${row.meals.night}） | ${mindAccount(row.mind.work)} | ${mindAccount(row.mind.wish)} | ${mindAccount(row.mind.body)} | ${mindAccount(row.mind.hobby)} | ${mindAccount(row.mind.night)} | ${mindAccount(row.mind.other)} | ${row.mindBand40To70.actorTurns}/${row.mindBand40To70.totalActorTurns}（${row.mindBand40To70.percentage === null ? '无样本' : percentage(row.mindBand40To70.percentage)}） |`);
  }
  return lines.join('\n');
}

function strategySection(entry) {
  const s = entry.summary;
  const lines = [
    `## ${entry.label}策略`,
    '',
    `完成 D100：${s.completedDay100}/${s.runCount}；终局现金口径为 D100 结算现金，提前全灭局保留全灭时现金并单列完成数。`,
    '',
    '| 指标 | 结果 |',
    '| --- | --- |',
    `| 存活率（3/2/1/0 人） | ${percentage(s.survivalRates[3])} / ${percentage(s.survivalRates[2])} / ${percentage(s.survivalRates[1])} / ${percentage(s.survivalRates[0])} |`,
    `| 100 日/终局现金分位数 | p10=${value(s.cashQuantiles.p10)}，p50=${value(s.cashQuantiles.p50)}，p90=${value(s.cashQuantiles.p90)} |`,
    `| 首次死亡日分位数 | n=${s.firstDeathDay.count}，p10=${value(s.firstDeathDay.p10)}，p50=${value(s.firstDeathDay.p50)}，p90=${value(s.firstDeathDay.p90)} |`,
    `| 死亡原因分布 | ${rowList(s.deathReasons)} |`,
    `| 预检失败次数与原因 Top5 | ${s.preflightFailures}；${rowList(s.preflightReasons)} |`,
    `| 停工原因（体力/精神/醉意/岗位满） | ${rowList(s.stoppageReasons)}（策略主动避让与预检拒绝合计） |`,
    `| 物资断供天数 | ${s.foodOutageDays}（夜间结算后有效食物为 0；同一天最多计一次） |`,
    `| 愿望崩溃次数 | ${s.wishBreakdowns}（crisis 从 false 变为 true） |`,
    `| 疾病发生次数 | ${s.diseaseCases}（同一 actor+diseaseUid 只计一次） |`,
    `| 彩票购买成功日 / 牌局参与日 | ${s.lotteryBuyDays} / ${s.cardGameDays} |`,
    `| 便利店买烟成功次数 | ${s.cigarettePurchases} |`,
    '',
    '### 每 10 日中位数曲线',
    '',
    '| 日 | 到达样本 | 现金 | 健康 | 精神 | 卫生 |',
    '| ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [day, point] of Object.entries(s.checkpoints)) {
    lines.push(`| ${day} | ${point.count} | ${value(point.cash)} | ${value(point.health)} | ${value(point.mind)} | ${value(point.hygiene)} |`);
  }
  const points = Object.values(s.checkpoints);
  lines.push('', '| 曲线 | D10→D100 | 标尺 |', '| --- | --- | --- |', `| 现金 | ${sparkline(points.map((point) => point.cash))} | 本策略检查点自缩放 |`, `| 健康 | ${sparkline(points.map((point) => point.health), [0, 100])} | 0–100 |`, `| 精神 | ${sparkline(points.map((point) => point.mind), [0, 100])} | 0–100 |`, `| 卫生 | ${sparkline(points.map((point) => point.hygiene), [0, 100])} | 0–100 |`, '', '其中 `·` 表示该检查点没有实际到达样本。', '', '### 日现金净变化', '', `- 普通日：${cashBand(s.ordinaryCash)}`, `- 交付日：${cashBand(s.deliveryCash)}`, `- 护理日：${cashBand(s.careCash)}`, '');
  lines.push(breakdownSection(s), '');
  return lines.join('\n');
}

function gapSection(entries) {
  const conservative = entries.find((entry) => entry.id === 'conservative')?.summary;
  const gambler = entries.find((entry) => entry.id === 'gambler')?.summary;
  const notes = [];
  if (conservative) notes.push(`保守策略三人存活率 ${percentage(conservative.survivalRates[3])}，目标 ≥70%，差值 ${value(conservative.survivalRates[3] - 70)} 个百分点。`);
  if (gambler) notes.push(`赌徒策略三人存活率 ${percentage(gambler.survivalRates[3])}，目标 ≤40%，相对上限差值 ${value(gambler.survivalRates[3] - 40)} 个百分点。`);
  for (const entry of entries) {
    const s = entry.summary;
    notes.push(`${entry.label}：普通日 p50=${value(s.ordinaryCash.p50)}（目标 +10～30）；交付日 p50=${value(s.deliveryCash.p50)}（目标 +40～80）；护理日 p50=${value(s.careCash.p50)}（目标 −20～60）。`);
  }
  return notes;
}

function suggestionSection(entries) {
  const conservative = entries.find((entry) => entry.id === 'conservative')?.summary;
  const gambler = entries.find((entry) => entry.id === 'gambler')?.summary;
  const suggestions = [];
  if (conservative && conservative.survivalRates[3] < 70) {
    suggestions.push(`保守策略三人存活率低 ${value(70 - conservative.survivalRates[3])} 个百分点：优先核对 \`rules.foodPrice\` 与 \`items.meal.price\` 是否一致，再分别试调 \`ACTIONS.kitchen.foodGain\`、每格饱食扣减和每日两次进食节奏；\`foodPerLivingActorPerDay\` 只影响饭钱预留，不能直接缓解实际缺饭。`);
  } else suggestions.push('保守策略已达到三人存活目标，暂不建议放宽基础生存参数。');
  if (gambler && gambler.survivalRates[3] > 40) suggestions.push('赌徒策略三人存活率高于目标：可提高付费博彩成本或愿望压力，保持购票时锁定结果不变。');
  else suggestions.push('赌徒策略未高于 40% 上限，暂不建议继续削弱博彩策略。');
  const careSamples = entries.reduce((sum, entry) => sum + entry.summary.careCash.count, 0);
  if (careSamples) suggestions.push('护理日已有样本：若其中位数超出 −20～60，再调整诊所评估费或护理用品价格。');
  else suggestions.push('护理日没有样本，护理经济性不确定；先增加覆盖，不据此调整诊所或用品价格。');
  const deliverySamples = entries.reduce((sum, entry) => sum + entry.summary.deliveryCash.count, 0);
  if (!deliverySamples) suggestions.push('交付日没有样本，交付收益不确定；固定策略未主动抢大单，不能拿普通职业工作替代。');
  for (const entry of entries) {
    if (entry.summary.ordinaryCash.p50 > 30) suggestions.push(`${entry.label}策略普通日 p50=${value(entry.summary.ordinaryCash.p50)} 高于目标：可分别下调 \`ACTIONS.scavenge.cash\`、\`repair.cash\`、\`carry.cash\`、\`run.cash\` 后复跑；这是混合排程结果，不能从本批次断言某一个动作单独造成偏高。`);
  }
  suggestions.push('每次调整后使用相同 1000 起始种子集合复跑，比较参数前后差值。');
  return suggestions;
}

export function renderReport(entries, meta) {
  const seedEnd = 1000 + meta.runs - 1;
  const lines = [
    '# 《今晚睡哪儿》100 日自动对局平衡模拟',
    '',
    `生成命令：\`${meta.command || 'npm run sim'}\``,
    `运行环境：Node ${meta.node || process.version}；每策略 ${meta.runs} 局；固定种子 1000–${seedEnd}；目标天数 ${meta.days}；耗时 ${(meta.elapsedMs / 1000).toFixed(2)} 秒。`,
    '',
    '各策略使用完全相同的种子集合。决策只接收玩家可见投影；真实状态仅由执行器调用公开引擎接口，并由统计器在结算后回顾。健康、精神与卫生曲线只统计当时 active/downed 人物，不含死者与未招募者。提前全灭局不会被当作完成 D100；检查点中位数只使用实际到达该日的样本。',
    '',
    '策略规则：保守策略维持原两餐、维护和劳动规则；均衡策略在原生存维护之后加入第二批机制；旧赌徒的一餐与维护参数保持不变。博彩对照完整复用均衡，只改变购票和 join_paid 决策；均衡新手也复用均衡，仅在读人交互固定拿手活开场并要现金。所有购票受饭钱保护、营业时间与每日博彩额度约束，牌局没有可见机会时不会伪造事件。',
    '',
    '日类型按“护理日 > 交付日 > 普通日”分类；护理日含成功结算的 clinic/aid/rescue/挂载护理，交付日只含 coop/trio/预约 oddjob。曲线先在每局每个检查点对当时存活或濒死人物取中位数，再跨局取中位数。',
    '',
  ];
  lines.push('## 生存与经济总览', '', `| 指标 | ${entries.map((entry) => entry.label).join(' | ')} |`, `| --- | ${entries.map(() => '---:').join(' | ')} |`);
  for (const [label, select] of [
    ['三人存活率', (s) => percentage(s.survivalRates[3])],
    ['终局现金 p50', (s) => value(s.cashQuantiles.p50)],
    ['推进小时 p50', (s) => value(s.hourTicks.p50)],
    ['完成角色行动 p50', (s) => value(s.actionCounts.p50)],
    ['普通日净现金 p50', (s) => value(s.ordinaryCash.p50)],
    ['每局疾病', (s) => value(s.diseaseCases / s.runCount)],
    ['完成 D100', (s) => `${s.completedDay100}/${s.runCount}`],
  ]) lines.push(`| ${label} | ${entries.map((entry) => select(entry.summary)).join(' | ')} |`);
  const control = entries.find((entry) => entry.id === 'gambler_control')?.summary;
  const legacy = entries.find((entry) => entry.id === 'gambler')?.summary;
  if (control && legacy) lines.push('', `博彩对照三人存活率 ${percentage(control.survivalRates[3])}，旧赌徒 ${percentage(legacy.survivalRates[3])}。旧赌徒同时改变了餐食、护理采购、卫生门槛、体力门槛和精神恢复，不能据它的结果单独归因于博彩，也不能把“一餐设定导致0%存活”当成已证实的单变量因果结论。本轮只隔离博彩选择，未做只改一餐/两餐的实验。`, '');
  lines.push(mechanismSection(entries));
  for (const entry of entries) lines.push(strategySection(entry));
  lines.push('## 与目标区间的差距', '', ...gapSection(entries).map((line) => `- ${line}`), '', '## 建议调整参数', '', ...suggestionSection(entries).map((line) => `- ${line}`), '');
  return lines.join('\n');
}
