// 路人、熟面孔、履约记录、垃圾桶。路人按（日、街区、时段）确定生成，熟人有记忆。
import { getData } from './data.js';
import { rng, pick, intBetween } from './rng.js';
import { begOutcome, clamp } from './rules.js';
import { makeItem } from './items.js';

export const REGULARS = [
  { id: 'reg_chen', name: '老陈', district: 'station', slots: [0, 1, 2], job: '站口装卸工', tags: ['工友', '直来直去'], gives: 'cash' },
  { id: 'reg_liu', name: '刘姐', district: 'market', slots: [0, 1], job: '早市摊主', tags: ['嘴硬心软', '认人'], gives: 'food' },
  { id: 'reg_zhao', name: '小赵', district: 'cinema', slots: [2, 3], job: '学生', tags: ['爱看涂鸦', '零钱不多'], gives: 'cash' },
  { id: 'reg_wang', name: '王叔', district: 'service', slots: [0, 1, 2, 3], job: '服务站志愿者', tags: ['讲规矩', '记得每个人'], gives: 'tip' },
  { id: 'reg_lu', name: '鲁叔', district: 'recycle', slots: [1, 2], job: '仓库老板', tags: ['要人搬货', '给活不给钱'], gives: 'tip' },
  { id: 'reg_xu', name: '许姐', district: 'cinema', slots: [1, 2], job: '工作间主人', tags: ['看作品说话'], gives: 'tip' },
];

const JOBS = ['外卖骑手', '保洁阿姨', '上班族', '退休大爷', '带孩子的妈妈', '夜班保安', '小店老板', '送货司机', '中学生家长', '游客', '摆摊小贩', '快递员', '面馆伙计', '代驾师傅'];
const MOODS = [
  { key: 'hurried', label: '赶时间' },
  { key: 'good', label: '心情不错' },
  { key: 'annoyed', label: '有点烦' },
  { key: 'idle', label: '闲着' },
  { key: 'offwork', label: '刚下班' },
];

export function regularOf(npcId) {
  return REGULARS.find((r) => r.id === npcId) || null;
}

export function relation(state, npcId) {
  if (!state.relations[npcId]) state.relations[npcId] = { trust: 0, helped: 0, refused: 0, jobs: 0, lastDay: 0 };
  return state.relations[npcId];
}

// 某街区某时段可见的路人（4—6 个），含在场的熟人。
export function passersby(state, district, slot) {
  const key = `npc:${state.day}:${district}:${slot}`;
  const n = intBetween(rng(state.seed, key + ':n'), 4, 6);
  const out = [];
  for (const reg of REGULARS) {
    if (reg.district !== district || !reg.slots.includes(slot)) continue;
    if (rng(state.seed, key + ':' + reg.id) < 0.55) {
      const rel = state.relations[reg.id] || { trust: 0, helped: 0 };
      out.push({ id: reg.id, name: reg.name, job: reg.job, mood: pick(rng(state.seed, key + ':m:' + reg.id), MOODS), regular: true, tags: reg.tags, trust: rel.trust, known: rel.helped > 0 || rel.jobs > 0 });
    }
  }
  for (let i = out.length; i < n; i++) {
    const id = `p:${state.day}:${district}:${slot}:${i}`;
    out.push({ id, name: pick(rng(state.seed, id + ':job'), JOBS), job: '', mood: pick(rng(state.seed, id + ':mood'), MOODS), regular: false, tags: [], trust: 0, known: false });
  }
  for (const npc of out) npc.asked = Boolean(state.daily.begged[npc.id]);
  return out;
}

// 乞讨：最多 3 个目标，每个 npc 全队每天只有一次结果。返回逐人结果。
export function begAt(state, actorId, district, targets, events, style = 'ask') {
  const rules = getData().rules;
  const p = state.actors[actorId];
  // 举纸板：不必开口，被拒不伤精神，但给的少；速写换零钱（凡哥带纸笔）：更少被拒、给得多。
  let perform = false;
  if (style === 'perform' && actorId === 'fan') { const paper = state.items.find((x) => x.itemId === 'paper_set' && x.container === 'fan' && x.uses > 0); if (paper) { paper.uses -= 1; if (paper.uses <= 0) state.items = state.items.filter((x) => x.uid !== paper.uid); perform = true; } }
  const list = passersby(state, district, state.slot);
  const results = [];
  let refusalLoss = 0;
  for (const npcId of targets.slice(0, rules.begging.encountersPerMainAction)) {
    const npc = list.find((x) => x.id === npcId);
    if (!npc || state.daily.begged[npcId]) continue;
    state.daily.begged[npcId] = actorId;
    const r = rng(state.seed, `beg:${state.day}:${npcId}`);
    let shift = 0;
    if (npc.regular) shift += Math.min(10, relation(state, npcId).trust * 3);
    if (perform) shift += 8;
    if (p.hygiene < 20) shift -= 8;
    if (npc.mood.key === 'hurried' && r < 0.12) {
      results.push({ npc, kind: 'refusal', cash: 0, text: `${npc.name}摆摆手：“这会儿赶时间。”` });
      refusalLoss += 1;
      continue;
    }
    let out = begOutcome(r, rules, { refusalShift: Math.max(0, shift) });
    if (shift < 0 && out.kind === 'cash' && rng(state.seed, `begdirty:${state.day}:${npcId}`) < 0.3) out = { kind: 'refusal', cash: 0 };
    // 熟人按自己的路数给：刘姐给饭，王叔/鲁叔/许姐给线索。
    if (npc.regular && out.kind !== 'refusal') {
      const reg = regularOf(npcId);
      if (reg.gives === 'food') out = { kind: 'food', cash: 0 };
      else if (reg.gives === 'tip' && r < 0.6) out = { kind: 'job_tip', cash: 0 };
    }
    if (out.kind === 'refusal') {
      refusalLoss += 1;
      results.push({ npc, kind: 'refusal', cash: 0, text: `${npc.name}摇了摇头。` });
      continue;
    }
    if (out.kind === 'cash') {
      let cash = out.cash;
      if (style === 'sign') cash = Math.max(1, cash - 1);
      if (perform) cash += 4;
      // 账本由结算统一记（settle 把 r.cash 计入本回合 income），这里只动现金。
      state.cash += cash;
      results.push({ npc, kind: 'cash', cash, text: `${npc.name}${perform ? '看了画像，' : ''}给了${cash}块零钱。` });
    } else if (out.kind === 'food') {
      makeItem(state, 'meal', actorId);
      results.push({ npc, kind: 'food', cash: 0, text: `${npc.name}把一份没动过的饭递了过来。` });
    } else if (out.kind === 'job_tip') {
      state.pendingJobTips.push({ district, day: state.day, from: npc.name, npcId });
      results.push({ npc, kind: 'job_tip', cash: 0, text: `${npc.name}说下一时段那边缺人手，让你们去问问。` });
    }
    if (npc.regular) {
      const rel = relation(state, npcId);
      rel.helped += 1;
      rel.trust = clamp(rel.trust + 1, 0, 5);
      rel.lastDay = state.day;
    }
  }
  // 普通拒绝每日每人精神损失上限 2。
  const already = state.daily.refusalLoss[actorId] || 0;
  const loss = style === 'sign' ? 0 : Math.min(refusalLoss, Math.max(0, rules.begging.dailyRefusalMindLossCap - already));
  state.daily.refusalLoss[actorId] = already + loss;
  if (loss > 0) p.mind = clamp(p.mind - loss);
  const cash = results.reduce((a, x) => a + x.cash, 0);
  events.push(`${state.names[actorId]}在${districtName(district)}${style === 'sign' ? '举着纸板' : perform ? '画速写换零钱' : '开口求助'}${results.length}次：${results.map((x) => x.text).join('') || '没有人可以问。'}${loss ? `（被拒精神-${loss}）` : ''}`);
  return { results, cash };
}

export function districtName(id) {
  return getData().districts.find((d) => d.id === id)?.name || id;
}

// 每日一次的短聊：少量恢复，不给钱。
export function chatWith(state, actorId, npcId) {
  const p = state.actors[actorId];
  if (p.life !== 'active') return { error: '现在不能聊天' };
  if (state.daily.chatted[actorId]) return { error: '今天已经聊过一次了，再聊不加精神' };
  state.daily.chatted[actorId] = npcId;
  p.mind = clamp(p.mind + 2);
  if (regularOf(npcId)) relation(state, npcId).lastDay = state.day;
  return { ok: true };
}

// 垃圾桶：每街区两只，每日各一次；结果可预见范围，不掷病骰（不洁食物在吃下时记暴露）。
const BINS = { market: ['市场口垃圾桶', '早餐摊后巷桶'], station: ['站口垃圾桶', '西侧空地桶'], recycle: ['回收巷大桶', '零件堆边桶'] };

export function binsAvailable(state, district) {
  return (BINS[district] || []).map((name, i) => ({ id: `${district}:${i}`, name, used: Boolean(state.daily.bins[`${district}:${i}`]) }));
}

export function digBins(state, actorId, district, events) {
  const avail = binsAvailable(state, district).filter((b) => !b.used);
  const found = [];
  for (const bin of avail.slice(0, 2)) {
    state.daily.bins[bin.id] = actorId;
    const r = rng(state.seed, `bin:${state.day}:${bin.id}`);
    if (r < 0.28) { const it = makeItem(state, 'bread', actorId); it.dirty = true; found.push('一包没开封但来路不明的面包'); }
    else if (r < 0.46) { const n = intBetween(rng(state.seed, `binb:${state.day}:${bin.id}`), 2, 5); state.bottles = (state.bottles || 0) + n; found.push(n + '个瓶罐'); }
    else if (r < 0.58) { makeItem(state, 'butts', actorId); found.push('几个还能抽的烟头'); }
    else if (r < 0.7) { state.cloth += 1; found.push('几块能用的布料'); }
    else if (r < 0.8) { state.parts += 1; found.push('一块电子零件'); }
    else if (r < 0.86) { const c = intBetween(rng(state.seed, `binc:${state.day}:${bin.id}`), 1, 4); state.cash += c; state.ledger.income += c; found.push(c + '块零钱'); }
    else if (r < 0.92) { state.wood += 1; found.push('一块木板'); }
    else if (r < 0.95) { const it = makeItem(state, 'soap', actorId); it.uses = 1; found.push('一小块用剩的肥皂'); }
    else found.push('什么也没有');
  }
  events.push(`${state.names[actorId]}翻了${avail.length ? districtName(district) + '的' + avail.length + '只垃圾桶：' + found.join('、') : '空桶：今天这里已经翻过了'}。`);
  return found;
}

// 捡瓶罐：沿街走一圈，3—8 个；同街区当天第二次递减。
export function collectBottles(state, actorId, district, events) {
  const key = `bottles:${state.day}:${district}`;
  const times = state.daily[key] || 0;
  state.daily[key] = times + 1;
  let n = intBetween(rng(state.seed, key + ':' + times), 3, 8);
  n = Math.max(1, n - times * 2);
  state.bottles = (state.bottles || 0) + n;
  events.push(`${state.names[actorId]}在${districtName(district)}捡了${n}个瓶罐（共${state.bottles}）。`);
  return n;
}
