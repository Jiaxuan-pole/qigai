import { ACTIONS } from './actions.js';
import { getData } from './data.js';
import { active, alive, foodEquivalent, NAMES } from './engine.js';
import { FAVORS } from './favors.js';
import { districtName } from './npcs.js';
import { shopClosedReason } from './shop.js';

const STAGES = [
  ['先把吃住稳住', ['meals', 'shelter2', 'cash1'], '先建立饭源，再把雨夜和急用钱准备好。'],
  ['备好暴雨退路', ['shelter2', 'food1', 'cash2'], '第18天有暴雨，提前准备避雨处、口粮和备用现金。'],
  ['给早寒备好寝具', ['blankets', 'shelter2', 'cash1'], '第25天早寒，每名队员都需要能分到的干毯。'],
  ['把手艺变成收入', ['work3', 'food1', 'cash2'], '通过维修、跑腿或商户单，积累能持续接单的劳动。'],
  ['积累稳定劳动', ['work6', 'shelter2', 'cash2'], '保留劳动积累和备用钱，给试工与合作留出时间。'],
  ['把身体和营地收拾好', ['clean', 'hygiene', 'care'], '第54天卫生巡查、第57天诊疗复查，检查营地与每个人的身体。'],
  ['备齐寒潮物资', ['shelter3', 'blankets', 'food2', 'cash2'], '第71-74天寒潮将至，先把住所、干毯和储备补齐。'],
  ['守住寒潮中的吃住', ['shelter3', 'blankets', 'warmth', 'food1'], '寒潮期间补回保暖与口粮，检查每个人都能过夜。'],
  ['为最后十天留余地', ['work10', 'cash2', 'food1'], '继续积累劳动，保留最后一段路所需的饭钱和救助费用。'],
  ['带着余粮走到最后一夜', ['safe', 'food1', 'cash1'], '处理濒死救援并留好口粮，走到第100天夜间结局。'],
];

export function survivalStageObjective(state, plan, favors) {
  const rules = getData().rules;
  const stage = Math.min(STAGES.length - 1, Math.max(0, Math.floor((state.day - 1) / 10)));
  const [title, keys, context] = STAGES[stage];
  const startDay = stage * 10 + 1;
  const endDay = Math.min(startDay + 9, rules.durationDays);
  const living = alive(state);
  const actors = active(state);
  const dailyFood = living.length * rules.foodPerLivingActorPerDay;
  const ended = ['ending', 'gameover'].includes(state.phase);
  const anyPlan = (ids, zone, label) => ids.flatMap((id) => actors.map((actorId) => plan(state, actorId, id, zone || ACTIONS[id].zone, label))).find(Boolean) || null;
  const inventory = (label, actorId = actors[0]) => actorId ? { kind: 'inventory', actorId, label } : null;
  const recovery = () => anyPlan(['warm', 'rest']);
  const earning = () => anyPlan(['kitchen', 'repair', 'run', 'carry', 'scavenge']) || recovery();
  const favor = (npcId) => favors.find((task) => task.id === `favor:${npcId}`);
  const condition = (id, label, progress, target, next, cta, complete = progress >= target) => ({ id, label, progress, target, complete, next, cta });
  const checks = keys.map((key) => {
    if (key === 'meals') {
      const step = FAVORS.reg_liu.steps[0];
      const record = state.favors?.reg_liu;
      const done = state.flags.liuBonusMeal || record?.done?.includes(step.id);
      const progress = done ? step.need : record?.active?.id === step.id ? Math.min(step.need, record.active.progress) : 0;
      const task = favor('reg_liu');
      return condition('meals', `稳定饭源：刘姐早班${progress}/${step.need}`, progress, step.need,
        record?.active?.id === step.id ? `完成刘姐的早餐帮厨，还差${Math.max(0, step.need - progress)}次。${task.detail}` : `到老街找刘姐，接下「${step.title}」；完成后每次帮厨多得一份饭。${task.detail}`,
        task.cta || recovery());
    }
    if (key.startsWith('shelter')) {
      const target = Number(key.at(-1));
      const shelter = Boolean(state.flags.wangShelter) || (state.relations?.reg_wang?.trust || 0) >= 2;
      const progress = shelter ? target : state.camp.rain;
      const repair = anyPlan(['helper']);
      const task = favor('reg_wang');
      return condition('shelter', `防雨${state.camp.rain}/${target}或服务站过夜区${shelter ? '已开放' : '未开放'}`, progress, target,
        repair ? `把防雨修到${target}级。雇工帮助修棚每次需现金36、木料2、布料2；也可两人共同修棚，花12、木料2、布料2。` : `完成王叔的首个委托，开放服务站过夜区；防雨${target}级也可达标。${task.detail}`,
        repair || task.cta || recovery());
    }
    if (key.startsWith('cash')) {
      const days = Number(key.at(-1));
      const target = rules.rescue.serviceCost + dailyFood * rules.foodPrice * days;
      return condition('cash', `应急现金${state.cash}/${target}`, state.cash, target,
        `还需攒${Math.max(0, target - state.cash)}现金，预留${days}天饭钱和一次联系救助费用。先安排能执行的劳动，体力不足先休整。`, earning());
    }
    if (key.startsWith('food')) {
      const days = Number(key.at(-1));
      const target = dailyFood * days;
      const progress = foodEquivalent(state);
      const cta = anyPlan(['kitchen', 'soup']) || (!shopClosedReason(state, 'convenience', state.slot) ? anyPlan(['shop'], 'market', '去老街补充正餐') : null) || recovery();
      return condition('food', `${days}天新鲜口粮${progress}/${target}份`, progress, target,
        `还缺${Math.max(0, target - progress)}份正餐当量；优先早餐帮厨或服务站领餐，也可在营业时去老街采买。过期食物不计入。`, cta);
    }
    if (key === 'blankets') {
      const blankets = state.items.filter((item) => item.itemId === 'blanket' && !item.wet);
      const own = living.filter((id) => blankets.some((item) => item.container === id));
      const shared = blankets.filter((item) => item.container === 'camp').length;
      const progress = Math.min(living.length, own.length + shared);
      const misplaced = living.find((id) => blankets.filter((item) => item.container === id).length > 1);
      const wet = state.items.find((item) => item.itemId === 'blanket' && item.wet && (item.container === 'camp' || living.includes(item.container)));
      const available = (state.shops.convenience.stock.blanket || 0) > 0;
      const cta = misplaced ? inventory('分配多余的干毯', misplaced)
        : wet ? inventory('整理待晾干的毯子', living.includes(wet.container) ? wet.container : actors[0])
          : available && !shopClosedReason(state, 'convenience', state.slot) ? anyPlan(['shop'], 'market', '去便利店准备干毯') : recovery();
      return condition('blankets', `可分配干毯${progress}/${living.length}条`, progress, living.length,
        misplaced ? `把${state.names?.[misplaced] || NAMES[misplaced]}包里多余的干毯放到营地箱，供其他人分配。`
          : wet ? '把湿毯放入营地箱，在无雨夜或有晾晒架时晾干；每人背包一条，或留在营地箱统一分配。'
            : `还需${living.length - progress}条干毯，到老街阿旺便利店购买，每条24。${available ? '需在营业时采买。' : `当前缺货，${state.shops.convenience.soldOut.blanket ? `第${state.shops.convenience.soldOut.blanket}天` : '补货后'}再来。`}`,
        cta);
    }
    if (key.startsWith('work')) {
      const target = Number(key.slice(4));
      const progress = (state.flags.repairs || 0) + (state.flags.runs || 0) + (state.flags.fixedJobs || 0);
      const work = anyPlan(['repair', 'run', 'table', 'shoot', 'edit']);
      return condition('work', `维修、跑腿与商户单累计${progress}/${target}次`, progress, target,
        work ? `还差${Math.max(0, target - progress)}次，下一单安排${ACTIONS[work.actionId].name}。` : '先补足体力、零件或设备。轩哥可分类回收攒零件；马哥可跑腿；凡哥可拍摄或剪辑商户单。',
        work || anyPlan(['scavenge']) || recovery());
    }
    if (key === 'clean') return condition('clean', `营地脏污${state.camp.dirt}/60以下`, Math.max(0, 100 - state.camp.dirt), 40,
      '安排营地整理，把脏污降到60及以下，避免卫生巡查扣信任。', anyPlan(['campclean']) || recovery());
    if (key === 'care') {
      const diseases = living.flatMap((id) => state.actors[id].diseases.map((disease) => ({ ...disease, actorId: id })));
      const untreated = diseases.find((disease) => !disease.known || !disease.plan);
      return condition('care', `病情已建护理计划${diseases.filter((disease) => disease.known && disease.plan).length}/${diseases.length}`, diseases.filter((disease) => disease.known && disease.plan).length, diseases.length,
        untreated ? `${state.names?.[untreated.actorId] || NAMES[untreated.actorId]}去服务站诊所评估，建立护理计划；计划后按病情准备护理用品。` : '已有病情都已建立护理计划，继续按计划护理。',
        untreated ? plan(state, untreated.actorId, 'clinic') || earning() : null);
    }
    const stat = key === 'hygiene' ? 'hygiene' : key === 'warmth' ? 'warmth' : 'life';
    const threshold = stat === 'hygiene' ? rules.hygiene.criticalDirtyThreshold : 20;
    const safe = (id) => stat === 'life' ? state.actors[id].life === 'active' : state.actors[id][stat] > threshold;
    const missing = living.find((id) => !safe(id));
    const progress = living.filter(safe).length;
    const action = stat === 'life' ? 'aid' : stat === 'hygiene' ? 'wash' : 'warm';
    const label = stat === 'life' ? '已脱离濒死' : stat === 'hygiene' ? `卫生高于${threshold}` : `保暖高于${threshold}`;
    return condition(key, `${label}：${progress}/${living.length}人`, progress, living.length,
      missing ? `${state.names?.[missing] || NAMES[missing]}先${ACTIONS[action].name}。${ACTIONS[action].note}` : '保持现有状态，留出吃饭和休整时间。',
      missing ? plan(state, missing, action) || recovery() : null);
  });
  const progress = checks.filter((check) => check.complete).length;
  const next = checks.find((check) => !check.complete);
  const status = state.phase === 'gameover' || !living.length ? 'failed'
    : state.phase === 'ending' && state.day >= rules.durationDays ? 'completed' : progress === checks.length ? 'ready' : 'active';
  const cta = ended ? null : next?.cta || null;
  const closing = status === 'failed' ? '旅程已结束，本阶段未完成。' : status === 'completed' ? '至少一人走到了第100天的最后一夜。'
    : next ? `下一步：${next.next}${!cta ? '当前先完成正在进行的事项，再安排下一步。' : ''}` : `本阶段准备已达标，维持到第${endDay}天，再进入下一阶段。`;
  return { id: `survival:stage:${stage + 1}`, kind: 'survival', priority: 0, title: `第${startDay}-${endDay}天：${title}`,
    detail: context + checks.map((check) => `${check.complete ? '已备好' : '待准备'}：${check.label}`).join('；') + `。${closing}`,
    progress, target: checks.length, unit: '项准备', status, location: districtName(cta?.zone || ''), cta,
    conditions: checks.map(({ id, label, progress, target, complete }) => ({ id, label, progress, target, complete })) };
}
