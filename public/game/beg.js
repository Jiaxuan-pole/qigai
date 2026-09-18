// 读人乞讨：路人有隐藏类型与耐心值，开场白选对了才轮到开口要东西。结果仍由规则层的权重表决定。
import { getData } from './data.js';
import { rng } from './rng.js';
import { begOutcome, clamp } from './rules.js';
import { makeItem } from './items.js';
import { districtName } from './npcs.js';

export const TYPES = {
  hurried: { label: '赶时间', patience: 1, likes: ['direct', 'ma'], hates: ['story'], hint: '眼睛一直在看路口' },
  vain: { label: '爱听好话', patience: 2, likes: ['compliment', 'fan'], hates: ['direct'], hint: '衣服熨得很平，手机壳是新的' },
  tough: { label: '吃硬不吃软', patience: 2, likes: ['direct', 'ma'], hates: ['compliment'], hint: '袖子卷到肘，说话不看人' },
  story: { label: '爱听故事', patience: 3, likes: ['story', 'xuan'], hates: [], hint: '手里的咖啡快凉了也没走' },
  clean: { label: '怕脏', patience: 2, likes: ['compliment'], hates: [], hint: '离你半步远，鼻子皱了一下', hygieneGate: 40 },
  kind: { label: '心软', patience: 3, likes: ['story', 'fan'], hates: [], hint: '看了你一眼又看了一眼' },
};

export const OPENINGS = {
  compliment: { label: '先夸两句', text: { xuan: '大哥这鞋利索，走路带风。', fan: '您这件外套的颜色，街上没第二件。', ma: '老板一看就是做大事的。' } },
  direct: { label: '直说处境', text: { xuan: '不绕弯：没地方住，缺顿饭钱。', fan: '实话，今天还没吃，能不能帮一把。', ma: '兄弟，直说了，今天差顿饭。' } },
  story: { label: '讲一段', text: { xuan: '我原来写代码的，公司没了，房也没了，就剩这台电脑。', fan: '我拍过片子，差三个镜头，现在连镜头盖都当了。', ma: '我跑腿的，袋子破了饭洒了，就这么一路倒霉到今天。' } },
  special: { label: '拿手活', text: { xuan: '您手机卡不卡？我帮您清一下后台，不要钱。', fan: '站两分钟，我给您画张速写，画得不像不收。', ma: '我认得站口每个工头，您要找活我能带路。' } },
};

// 每种类型对各开场白的反应：like 加耐心并露出类型提示，hate 直接走人。
export function reactionOf(type, actorId, opening) {
  const t = TYPES[type];
  const key = opening === 'special' ? actorId : opening;
  if (t.likes.includes(key)) return 'like';
  if (t.hates.includes(key)) return 'hate';
  return 'neutral';
}

export function npcType(state, npcId) {
  const keys = Object.keys(TYPES);
  return keys[Math.floor(rng(state.seed, 'ntype:' + npcId) * keys.length)];
}

export function beginSession(state, actorId, district, targets, style = 'ask', meta = {}) {
  // 同一路人全队每天只有一次结果：已经被问过的直接跳过，不重复占用。
  const npcs = targets.filter((id) => !state.daily.begged[id]).slice(0, getData().rules.begging.encountersPerMainAction).map((id) => {
    const type = npcType(state, id);
    state.daily.begged[id] = actorId;
    const m = meta[id] || {};
    return { id, name: m.name || id, job: m.job || '', type, patience: TYPES[type].patience, stage: 'open', log: [], result: null, revealed: false };
  });
  const session = { actorId, district, slot: state.slot, style, npcs, refusals: 0, cash: 0, done: npcs.length === 0 };
  if (npcs.length) state.pending.beg.push(session);
  return session;
}

// 选开场白。返回该 npc 的反应文本；耐心归零则这位路人走人。
export function chooseOpening(state, session, npcId, opening) {
  const n = session.npcs.find((x) => x.id === npcId);
  if (!n || n.stage !== 'open') return { error: '这位路人现在不能这样说' };
  if (!OPENINGS[opening]) return { error: '没有这句开场白' };
  const p = state.actors[session.actorId];
  const t = TYPES[n.type];
  if (t.hygieneGate && p.hygiene < t.hygieneGate) {
    n.stage = 'done'; n.result = { kind: 'refusal' }; session.refusals += 1;
    n.log.push('对方往后退了半步：“你先……去洗洗吧。”');
    return { reaction: 'hate', text: n.log.at(-1), stage: n.stage };
  }
  const r = reactionOf(n.type, session.actorId, opening);
  const line = OPENINGS[opening].text[session.actorId];
  let reply;
  if (r === 'like') { n.patience += 1; n.revealed = true; reply = REPLIES.like[n.type]; }
  else if (r === 'hate') { n.patience -= 2; reply = REPLIES.hate[n.type]; }
  else { reply = REPLIES.neutral[n.type]; }
  n.log.push(`${state.names[session.actorId]}：“${line}”`, `对方：${reply}`);
  if (n.patience <= 0) { n.stage = 'done'; n.result = { kind: 'refusal' }; session.refusals += 1; n.log.push('对方走了。'); }
  else n.stage = 'ask';
  return { reaction: r, text: reply, stage: n.stage, patience: n.patience };
}

const REPLIES = {
  like: { hurried: '“说重点，我赶时间。”他倒是停下了。', vain: '他笑了，整了整衣领。', tough: '“行，痛快。”', story: '“然后呢？”她把咖啡换到另一只手。', clean: '她点了点头，没往后退。', kind: '“唉。”她叹了口气。' },
  neutral: { hurried: '他看了眼手表。', vain: '“嗯。”', tough: '他没接话。', story: '她等着你说下去。', clean: '她保持着距离。', kind: '“你说。”' },
  hate: { hurried: '“没空。”他走了两步。', vain: '“你这人说话真直。”脸拉下来了。', tough: '“少来这套。”', story: '“……”', clean: '她皱了皱眉。', kind: '“别这样说自己。”' },
};

// 开口要东西：cash / food / tip。结果由权重表决定，耐心与熟人信任只挪拒绝概率。
export function ask(state, session, npcId, kind) {
  const n = session.npcs.find((x) => x.id === npcId);
  if (!n || n.stage !== 'ask') return { error: '还没到开口的时候' };
  if (!['cash', 'food', 'tip'].includes(kind)) return { error: '不知道要什么' };
  const rules = getData().rules;
  const rel = state.relations[npcId];
  const shift = Math.min(28, n.patience * 5 + ((rel && rel.trust) || 0) * 3);
  const r = rng(state.seed, `begask:${state.day}:${npcId}`);
  let out = begOutcome(r, rules, { refusalShift: shift });
  n.stage = 'done';
  if (out.kind === 'refusal') { n.result = { kind: 'refusal' }; session.refusals += 1; n.log.push(ASK_REFUSE[kind]); return { kind: 'refusal', text: ASK_REFUSE[kind] }; }
  // 开口要什么就尽量给什么：现金按耐心档 3/6/12；饭一份；线索一条。
  if (kind === 'cash') { const cash = n.patience >= 4 ? 12 : n.patience >= 3 ? 6 : 3; state.cash += cash; state.ledger.income += cash; session.cash += cash; n.result = { kind: 'cash', cash }; n.log.push(`对方掏了${cash}块。`); return { kind: 'cash', cash, text: n.log.at(-1) }; }
  if (kind === 'food') { makeItem(state, 'meal', session.actorId); n.result = { kind: 'food' }; n.log.push('对方把手里那份没动过的饭给了你。'); return { kind: 'food', text: n.log.at(-1) }; }
  state.pendingJobTips.push({ district: session.district, day: state.day, from: n.id, npcId: n.id });
  n.result = { kind: 'job_tip' }; n.log.push('对方说那边今天缺人，让你去问问。');
  return { kind: 'job_tip', text: n.log.at(-1) };
}

const ASK_REFUSE = { cash: '“没零钱。”', food: '“这是我自己的。”', tip: '“我也不清楚。”' };

// 收尾：结算被拒的精神损失（每日每人上限 2），熟人加信任，标记完成。
export function finishSession(state, session) {
  if (session.done) { state.pending.beg = state.pending.beg.filter((x) => x !== session); return { done: true, loss: 0, summary: '' }; }
  for (const n of session.npcs) if (n.stage !== 'done') { n.stage = 'done'; n.result = { kind: 'skipped' }; }
  const rules = getData().rules;
  const p = state.actors[session.actorId];
  const already = state.daily.refusalLoss[session.actorId] || 0;
  const loss = Math.min(session.refusals, Math.max(0, rules.begging.dailyRefusalMindLossCap - already));
  state.daily.refusalLoss[session.actorId] = already + loss;
  if (loss > 0) p.mind = clamp(p.mind - loss);
  for (const n of session.npcs) {
    if (n.result && n.result.kind !== 'refusal' && n.result.kind !== 'skipped' && state.relations[n.id]) { state.relations[n.id].helped += 1; state.relations[n.id].trust = clamp(state.relations[n.id].trust + 1, 0, 5); }
  }
  session.done = true;
  session.loss = loss;
  state.pending.beg = state.pending.beg.filter((x) => x !== session);
  const got = session.npcs.filter((n) => n.result && !['refusal', 'skipped'].includes(n.result.kind)).length;
  return { done: true, loss, summary: `${state.names[session.actorId]}在${districtName(session.district)}开口求助${session.npcs.length}次，${got}次有收获${session.cash ? '，共' + session.cash + '块' : ''}${loss ? '，被拒精神-' + loss : ''}。` };
}

// 无 UI 时（自动对局）按固定顺序走完：拿手活开场，再要现金。
export function autoResolve(state, session) {
  if (session.done) return finishSession(state, session);
  for (const n of session.npcs) {
    if (n.stage === 'open') chooseOpening(state, session, n.id, 'special');
    if (n.stage === 'ask') ask(state, session, n.id, 'cash');
  }
  return finishSession(state, session);
}
