import { ACTIONS } from './actions.js';
import { getData } from './data.js';
import { active, alive, assign, foodEquivalent, NAMES } from './engine.js';
import { FAVORS } from './favors.js';
import { itemDef } from './items.js';
import { districtName, REGULARS } from './npcs.js';
import { dayNode, routeDone, routeLabel, routeProgress } from './story.js';
import { windowLabel } from './headlines.js';
import { currentTask } from './clock.js';
import { preflight } from './settle.js';
import { survivalStageObjective } from './survival-objectives.js';

const names = (state, id) => state.names?.[id] || NAMES[id];
const plan = (state, actorId, actionId, zone = ACTIONS[actionId].zone, label) => canSuggest(state, actorId, actionId, zone) ? ({
  kind: 'plan', label: label || `安排${names(state, actorId)}${ACTIONS[actionId].name}`, actorId, actionId, zone,
}) : null;

function canSuggest(state, actorId, actionId, zone) {
  const action = ACTIONS[actionId];
  if (!action || action.eventOnly || action.min || action.fixed) return false;
  const result = assign(state, actorId, state.hour, actionId, { zone });
  if (result.error) return false;
  // 晨间说明结束后即可执行；其余限制复用真实整小时预检，避免目标另写一套规则。
  result.state.pendingMorning = null;
  return !preflight(result.state).error;
}

function nextAction(state, actorId) {
  if (!['planning', 'tail'].includes(state.phase)) return null;
  const task = currentTask(state, actorId);
  const scheduled = task && plan(state, actorId, task.id, task.zone);
  if (scheduled) return scheduled;
  const candidates = actorId === 'fan' ? ['kitchen', 'sketch', 'rest'] : actorId === 'ma' ? ['run', 'rest'] : ['scavenge', 'rest'];
  return candidates.map((id) => plan(state, actorId, id)).find(Boolean) || null;
}

function travelPlan(state, actorId, zone, label) {
  const candidates = ({ service: ['warm'], market: ['shop', 'beg', 'bottles'], station: ['bottles', 'beg', 'shop'], recycle: ['scavenge', 'bottles', 'shop'], cinema: ['beg', 'shop'], camp: ['rest'] })[zone] || [];
  return candidates.map((id) => plan(state, actorId, id, zone, label)).find(Boolean) || null;
}

function survivalObjectives(state) {
  const tasks = [];
  const living = alive(state);
  for (const actorId of living) {
    const actor = state.actors[actorId];
    const name = names(state, actorId);
    if (actor.life === 'downed') {
      tasks.push({ id: `survival:${actorId}:aid`, kind: 'survival', status: 'urgent', priority: 0, actorId,
        title: `先救${name}`, detail: `救援截止回合${actor.deadline}，当前回合${state.turn}。去服务站联系救助。`,
        location: districtName('service'), progress: 0, target: 1, cta: plan(state, actorId, 'aid') });
      continue;
    }
    const risks = [
      ['food', actor.food <= 20, '先吃一份饭', '饱食', null, '打开背包吃饭'],
      ['warmth', actor.warmth <= 20, '去服务站取暖', '保暖', 'warm'],
      ['energy', actor.energy < 20, '先恢复体力', '体力', 'rest'],
      ['mind', actor.mind < getData().rules.mentalCrisis.recoveryMindThreshold, '休整一下', '精神', 'warm'],
      ['hygiene', actor.hygiene <= getData().rules.hygiene.criticalDirtyThreshold, '去公共水点洗漱', '卫生', 'wash'],
    ];
    for (const [stat, needed, title, label, actionId, button] of risks) {
      if (!needed) continue;
      const cta = actionId ? plan(state, actorId, actionId) : { kind: 'inventory', actorId, label: button };
      tasks.push({ id: `survival:${actorId}:${stat}`, kind: 'survival', status: 'urgent', priority: 1, actorId,
        title: `${name}：${title}`, detail: `${label}${actor[stat]}/100。${actionId ? ACTIONS[actionId].note : '使用自己背包或身边可取用的食物；缺饭时去服务站领餐。'}`,
        location: districtName(cta?.zone || actor.location), progress: actor[stat], target: 100, cta });
    }
  }
  if (living.length) {
    const target = living.length * getData().rules.foodPerLivingActorPerDay;
    const progress = foodEquivalent(state);
    const complete = progress >= target;
    const cta = complete ? null : ['kitchen', 'soup', 'shop'].flatMap((actionId) => active(state).map((actorId) => plan(state, actorId, actionId, actionId === 'shop' ? 'market' : ACTIONS[actionId].zone))).find(Boolean) || null;
    tasks.push({ id: 'survival:food', kind: 'survival', status: complete ? 'completed' : 'active', priority: complete ? 90 : 5,
      title: '留够一天的饭', detail: `${living.length}人每天需要${target}份正餐当量，当前有${progress}份新鲜食物。`,
      location: districtName(cta?.zone || 'camp'),
      progress, target, unit: '份', cta });
  }
  return tasks;
}

function favorObjectives(state) {
  const tasks = [];
  const actors = active(state);
  // favorStatus / relation 会补写记录，目标视图直接读取存档以保持只读。
  for (const [npcId, chain] of Object.entries(FAVORS)) {
    const record = state.favors?.[npcId];
    const regular = REGULARS.find((npc) => npc.id === npcId);
    const completed = chain.steps.filter((step) => record?.done?.includes(step.id));
    const base = { id: `favor:${npcId}`, kind: 'favor', title: `与${chain.name}建立长期互助`,
      progress: completed.length, target: chain.steps.length, unit: '阶段', location: districtName(regular.district) };
    const step = record?.active ? chain.steps.find((entry) => entry.id === record.active.id) : chain.steps[record?.step || 0];
    if (!step) {
      tasks.push({ ...base, status: 'completed', priority: 90, detail: `已完成：${completed.map((entry) => entry.title).join('、')}。${completed.map((entry) => entry.reward.text).join('')}`, cta: null });
      continue;
    }
    const target = step.kind === 'count' ? step.need : 1;
    const progress = record?.active?.progress || 0;
    let status = record?.active ? (progress >= target ? 'ready' : 'active') : 'available';
    let detail = `当前阶段：${step.title}（${progress}/${target}）。${step.text} 完成后：${step.reward.text}`;
    let cta = null;
    let zone = regular.district;
    if (record?.active) {
      detail += ` 截止第${record.active.deadline}天。`;
      if (status === 'ready') detail += ' 已达到要求，推进后由委托结算发放奖励。';
      else if (step.kind === 'deliver') {
        const recipient = REGULARS.find((npc) => npc.id === step.to);
        zone = recipient.district;
        const carrier = actors.find((actorId) => state.items.some((item) => item.itemId === step.item && item.container === actorId));
        detail += ` 把${itemDef(step.item).name}放进携带者背包，送到${districtName(zone)}交给${recipient.name}。`;
        if (carrier) cta = state.actors[carrier].location === zone
          ? { kind: 'deliver', npcId, actorId: carrier, label: `交付${itemDef(step.item).name}` }
          : travelPlan(state, carrier, zone, `安排${names(state, carrier)}前往${recipient.name}处`);
        else if (actors.length) cta = { kind: 'inventory', actorId: actors[0], label: `准备${itemDef(step.item).name}` };
      } else {
        for (const actionId of step.actions) {
          const zones = step.zone ? [step.zone] : ACTIONS[actionId].zone === 'pick' ? (actionId === 'repair_item' ? ['camp', 'recycle'] : [regular.district]) : [ACTIONS[actionId].zone];
          cta ||= zones.flatMap((location) => actors.map((actorId) => plan(state, actorId, actionId, location))).find(Boolean) || null;
        }
        if (cta) zone = cta.zone;
        detail += ` 下一步：${step.actions.map((id) => ACTIONS[id].name).join('或')}。`;
        if (!cta) detail += ' 当前条件还不满足，检查体力、物品和已安排的行动后再试。';
      }
    } else {
      const actorId = actors.find((id) => state.actors[id].location === zone) || actors[0];
      const trust = state.relations?.[npcId]?.trust || 0;
      if ((record?.cooldownUntil || 0) > state.day || trust < step.trustMin || !actorId) {
        status = 'locked';
        detail += (record?.cooldownUntil || 0) > state.day ? ` 第${record.cooldownUntil}天可再次接取。` : ` 需要信任${step.trustMin}，当前${trust}。`;
        if (actorId) cta = { kind: 'npcs', district: zone, actorId, label: `找${chain.name}` };
      } else {
        detail += ` 接取后${step.days}天内完成，先到${districtName(zone)}找${chain.name}。`;
        cta = state.actors[actorId].location === zone
          ? { kind: 'accept', npcId, actorId, label: `接下${chain.name}的委托` }
          : travelPlan(state, actorId, zone, `去${districtName(zone)}找${chain.name}`);
      }
    }
    if (['ending', 'gameover'].includes(state.phase)) {
      status = 'failed';
      cta = null;
    }
    tasks.push({ ...base, status, priority: record?.active ? 20 : status === 'locked' ? 60 : 40,
      detail, location: districtName(zone), stepId: step.id, stepProgress: progress, stepTarget: target, deadline: record?.active?.deadline ?? null, cta });
  }
  return tasks;
}

export function objectives(state) {
  if (!state) return [];
  const duration = getData().rules.durationDays;
  const day = Math.min(state.day, duration);
  const finishedDay = state.hour >= 22 || (state.day === duration && state.phase === 'ending');
  const survived = Math.min(duration, Math.max(0, day - 1 + Number(finishedDay)));
  const ended = ['ending', 'gameover'].includes(state.phase);
  const favors = favorObjectives(state);
  const tasks = [survivalStageObjective(state, plan, favors), ...favors];
  // 今日事的定时热点是今天最该盯的事：排在生存目标之后、章节之前，窗口关了就从列表里消失。
  for (const event of state.events || []) {
    if (!event.window || event.day !== state.day || !['open', 'reserved'].includes(event.status)) continue;
    const who = event.cast?.length ? `，只能${event.cast.map((id) => names(state, id)).join('/')}去` : '';
    tasks.push({ id: `headline:${event.uid}`, kind: 'headline', status: event.status === 'reserved' ? 'active' : 'available', priority: 8,
      title: `今日事：${event.title}`, detail: `${districtName(event.district)}，${windowLabel(event, state)}${who}。`, location: districtName(event.district), progress: null, target: null,
      cta: state.hour >= event.window.from ? { kind: 'event', eventUid: event.uid, label: event.status === 'reserved' ? '查看预约' : '去处理' } : null });
  }
  for (const chapter of getData().chapters.filter((entry) => entry.startDay <= day)) {
    const target = chapter.endDay - chapter.startDay + 1;
    const progress = Math.min(target, Math.max(0, survived - chapter.startDay + 1));
    tasks.push({ id: `chapter:${chapter.id}`, kind: 'chapter', status: progress >= target ? 'completed' : ended ? 'failed' : 'active', priority: progress >= target ? 90 : 10,
      title: `第${chapter.number}章：${chapter.title}`, detail: chapter.objective + '。' + chapter.anchor + '。',
      location: '', progress, target, unit: '天已度过', cta: null });
  }
  for (const route of ['rent', 'studio', 'job']) {
    const view = { ...state, flags: { ...state.flags, route } };
    const selected = state.flags.route === route;
    const done = routeDone(view);
    let status = 'locked';
    if (selected) status = ended ? state.phase === 'ending' && done ? 'completed' : 'failed' : done ? 'ready' : 'active';
    tasks.push({ id: `route:${route}`, kind: 'route', title: routeLabel(view), priority: selected ? 15 : 55,
      status,
      detail: `${selected ? '已选择的长期路线。' : day < 85 ? '第85天可选择的长期路线。' : '尚未选择这条路线。'}${routeProgress(view)}${selected && done && !ended ? '当前已达到条件，保持到最终结局。' : ''}`,
      progress: null, target: null, location: '', cta: null });
  }
  return tasks.sort((a, b) => a.priority - b.priority);
}

export function actionHints(state) {
  if (!state) return [];
  const tasks = survivalObjectives(state);
  const day = Math.min(state.day, getData().rules.durationDays);
  for (const [actorId, focus] of Object.entries(dayNode(day)?.focus || {})) {
    if (state.actors[actorId]?.life !== 'active') continue;
    const cta = nextAction(state, actorId);
    tasks.push({ id: `daily:${day}:${actorId}`, kind: 'daily', status: 'guide', priority: 30, actorId,
      title: `${names(state, actorId)}今日方向`, detail: `${focus}。${cta ? `下一步：${ACTIONS[cta.actionId].name}。` : '当前无法安排新行动，先完成正在进行的事项。'}`,
      location: districtName(cta?.zone || state.actors[actorId].location), progress: null, target: null, cta });
  }
  for (const event of state.events || []) {
    if (!['open', 'reserved'].includes(event.status) || event.expiresTurn <= state.turn) continue;
    tasks.push({ id: `event:${event.uid}`, kind: 'event', title: event.title, status: event.status === 'reserved' ? 'active' : 'available', priority: 35,
      detail: `${event.status === 'reserved' ? '已预约' : '待决定'}，${windowLabel(event, state)}。`,
      location: districtName(event.district), progress: 0, target: 1,
      cta: { kind: 'event', eventUid: event.uid, label: event.status === 'reserved' ? '查看预约' : '查看并决定' } });
  }
  return tasks.sort((a, b) => a.priority - b.priority);
}
