// 卫生、疾病、精神危机的状态推进。数值全部走 rules.js，这里只负责把它们接到角色身上。
import { getData } from './data.js';
import { rng } from './rng.js';
import { clamp, diseaseStep, diseaseStage, hygieneRisk, mindStep } from './rules.js';

export const DISEASES = {
  gut: { name: '肠胃不适', basic: ['rehydration'], matching: ['care_course'], support: 'rehydration', hint: '补液用品减轻附加消耗；诊所计划用品才能压病情' },
  skin: { name: '卫生相关皮肤感染', basic: ['cleaning_care'], matching: ['cleaning_care', 'care_course'], hint: '清洁护理包可护理；保持卫生≥40，否则每回合多+2' },
  wound: { name: '未护理伤口感染', basic: ['bandage', 'cleaning_care'], matching: ['bandage', 'cleaning_care', 'care_course'], hint: '绷带只对重度以下有效；重度需诊所计划' },
  chill: { name: '受寒虚弱', basic: [], matching: [], hint: '暖处休整与干燥床位能压下去；症状缓解包减轻惩罚' },
};

export function addDisease(state, actorId, kind, severity, cause, events) {
  const p = state.actors[actorId];
  if (p.diseases.some((d) => d.kind === kind)) return null;
  if (p.diseases.length >= 2) return null;
  state.diseaseSeq = (state.diseaseSeq || 0) + 1;
  const d = { uid: 'd' + state.diseaseSeq, kind, severity: clamp(severity, 1, 100), known: kind === 'chill' || kind === 'wound', plan: false, startDay: state.day, cause, reliefUntil: 0 };
  p.diseases.push(d);
  events.push(`${state.names[actorId]}${d.known ? '出现' + DISEASES[kind].name : '身体不对劲（' + cause + '），需要诊所评估'}。`);
  return d;
}

// 某件用品对某病是否算“匹配护理”。
export function careMatches(disease, itemId) {
  const def = DISEASES[disease.kind];
  if (itemId === 'care_course') return disease.plan && disease.known;
  if (disease.kind === 'wound' && itemId === 'bandage') return disease.severity < 60;
  return def.basic.includes(itemId) && def.matching.includes(itemId);
}

// 一个行动回合的病情推进。flags: dirty, rested, safeSleep, caredIds(set of disease uid)
export function progressDiseases(state, actorId, flags, events) {
  const p = state.actors[actorId];
  const rules = getData().rules;
  let total = 0;
  for (const d of p.diseases) {
    const matching = flags.cared?.has(d.uid) || (d.kind === 'chill' && flags.rested && flags.warmPlace);
    const r = diseaseStep(d.severity, p.health, { dirty: flags.dirty && d.kind !== 'chill', matchingCare: matching, rest: flags.rested, safeSleep: flags.safeSleep }, rules);
    let damage = r.damage;
    if (d.supportUntil && state.turn <= d.supportUntil) damage = Math.max(0, damage - 3);
    if (d.reliefUntil && state.turn <= d.reliefUntil) damage = Math.max(0, damage - 3);
    d.severity = r.severity;
    p.health = clamp(p.health - damage);
    total += damage;
    if (d.severity <= 0) { events.push(`${state.names[actorId]}的${DISEASES[d.kind].name}已缓解。`); p.immune[d.kind] = state.day + 3; if (d.kind === 'wound') p.exposure.wound = false; }
  }
  p.diseases = p.diseases.filter((d) => d.severity > 0);
  return total;
}

// 精神：愿望压力与恢复量进危机链。
export function mentalTick(state, actorId, pressure, recovery, events) {
  const p = state.actors[actorId];
  const rules = getData().rules;
  const wasCrisis = p.crisis;
  const r = mindStep({ mind: p.mind, zeroTurns: p.zeroTurns, crisis: p.crisis, health: p.health }, pressure, recovery, rules);
  p.mind = r.mind;
  p.zeroTurns = r.zeroTurns;
  p.crisis = r.crisis;
  p.health = r.health;
  if (r.crisis && !wasCrisis) events.push(`${state.names[actorId]}精神崩溃：连续${rules.mentalCrisis.consecutiveTurns}回合精神归零，每回合健康-${rules.mentalCrisis.zeroMindHealthDamage}，直到精神回到${rules.mentalCrisis.recoveryMindThreshold}以上。`);
  else if (!r.crisis && wasCrisis) events.push(`${state.names[actorId]}走出了崩溃。`);
  else if (!r.crisis && r.zeroTurns > 0) events.push(`${state.names[actorId]}精神已连续${r.zeroTurns}回合为0；再${rules.mentalCrisis.consecutiveTurns - r.zeroTurns}回合将崩溃并损失健康。`);
  return r.damage;
}

// 夜间每人一次暴露检定，以及极端污秽保底。
export function nightExposure(state, actorId, events) {
  const p = state.actors[actorId];
  const rules = getData().rules;
  const flags = { dirtyFood: p.exposure.dirtyFood, openWound: p.exposure.wound && !p.exposure.woundCovered, care: p.exposure.cared };
  const risk = hygieneRisk(p.hygiene, flags, rules);
  const r = rng(state.seed, 'expo:' + state.day + ':' + actorId);
  // 病种必须对应暴露来源：伤口未护理→伤口感染，不洁食物→肠胃，卫生<60→皮肤；三者都没有就不抽病。
  const kind = flags.openWound ? 'wound' : flags.dirtyFood ? 'gut' : p.hygiene < 60 ? 'skin' : null;
  if (kind && p.diseases.length < 2 && r < risk && !(p.immune[kind] > state.day)) {
    addDisease(state, actorId, kind, 12 + Math.floor(r * 100) % 10, kind === 'wound' ? '伤口没有处理' : kind === 'gut' ? '吃了不干净的东西' : '长期不洗', events);
  }
  // 伤口一旦被护理覆盖就不再算暴露；不洁食物只算当天。
  p.exposure = { dirtyFood: false, wound: p.exposure.wound && !p.exposure.woundCovered, woundCovered: false, cared: false };
  return risk;
}

export function diseaseLabel(d) {
  const stage = diseaseStage(d.severity, getData().rules);
  return `${DISEASES[d.kind].name}${d.known ? '' : '（待诊断）'} ${stage.label} ${d.severity}`;
}
