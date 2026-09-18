// 天气、章节、关键日节点与结局。关键日节点是可执行的选择，不只是晨报标题。
import { getData } from './data.js';
import { rng } from './rng.js';
import { clamp } from './rules.js';
import { makeItem } from './items.js';
import { relation } from './npcs.js';
import { campClearingNode, isClearingDay, campClearing } from './trouble.js';

// 天气：D4 夜雨、D18 强降雨、D25 早寒、D71—74 寒潮；其余按 4 日一雨，第七章起偏冷。
export function weatherOf(seed, day) {
  if (day >= 71 && day <= 74) return day === 72 || day === 73 ? { kind: 'coldwave', label: '寒潮峰值', temp: -8, out: 16, night: 24 } : { kind: 'cold', label: '寒潮', temp: -4, out: 12, night: 18 };
  if (day === 18) return { kind: 'storm', label: '强降雨', temp: 9, out: 12, night: 14 };
  if (day === 25) return { kind: 'cold', label: '早寒', temp: 1, out: 12, night: 18 };
  if (day === 4 || day % 4 === 0) return { kind: 'rain', label: '下雨', temp: 7, out: 8, night: 10 };
  if (day >= 61 && day <= 100) return rng(seed, 'wx:' + day) < 0.35 ? { kind: 'cold', label: '阴冷', temp: 2, out: 10, night: 14 } : { kind: 'overcast', label: '阴天', temp: 5, out: 3, night: 6 };
  return rng(seed, 'wx:' + day) < 0.4 ? { kind: 'clear', label: '晴', temp: 12, out: 1, night: 3 } : { kind: 'overcast', label: '阴天', temp: 8, out: 2, night: 4 };
}

export function forecast(seed, day) {
  return [1, 2, 3].map((d) => ({ day: day + d, ...weatherOf(seed, day + d) })).filter((x) => x.day <= 100);
}

export function chapterOf(day) {
  return getData().chapters.find((c) => day >= c.startDay && day <= c.endDay);
}

export function dayNode(day) {
  return getData().dailyNodes.find((d) => d.day === day);
}

const alive = (s) => Object.keys(s.actors).filter((id) => s.actors[id].life === 'active');

// 清晨节点：返回 {title, text, choices:[{id,label,requires?,effect}]} 或 null。
export function morningNode(state) {
  const s = state;
  const d = s.day;
  const anyActive = alive(s);
  const ma = s.actors.ma.life === 'active';
  const fan = s.actors.fan.life === 'active';
  const xuan = s.actors.xuan.life === 'active';
  switch (d) {
    case 1: return { title: '被城市登出', text: '轩哥和凡哥在旧桥下过了第一夜。现金72，四份饭，两张地铺床单。今天先认清店在哪、谁能干什么；桥下也许会有新面孔。', choices: [{ id: 'go', label: '开始第一天' }] };
    case 3: return ma ? { title: '给马哥找张床', text: '马哥昨晚睡在地铺上。家具城卖基础床，买后送到营地包裹；回营拆包并摆放，今晚才能睡上干燥的床。也可以先去服务站过夜。', choices: [
      { id: 'build', label: '去家具城看看床' },
      { id: 'later', label: '先攒饭钱，过两天再说' },
    ] } : null;
    case 4: return { title: '第一场夜雨', text: '今晚有雨。防雨等级' + s.camp.rain + '/3；等级不足时营地过夜会淋湿、保暖下降。可以修棚、去服务站过夜，或硬扛。', choices: [{ id: 'ok', label: '知道了' }] };
    case 15: return { title: '积水线往上了', text: '第18天有强降雨预告。营地防雨' + s.camp.rain + '/3。可以修棚到2级以上、找鲁叔或许姐借仓存放设备，或提前转移。', choices: [{ id: 'ok', label: '记下了' }] };
    case 18: return { title: '雨不会挑人', text: '暴雨。防雨' + s.camp.rain + '/3。', choices: [
      { id: 'stay', label: s.camp.rain >= 2 ? '棚子够用，留在营地' : '硬扛（今晚全员淋湿，营地箱物品受潮）' },
      { id: 'storage', label: '把设备寄存到鲁叔/许姐那里（需任一信任≥2）', requires: (st) => (relation(st, 'reg_lu').trust >= 2 || relation(st, 'reg_xu').trust >= 2 ? null : '还没有信得过你们的人') },
      { id: 'shelter', label: '全员去服务站过夜（挤，但干）' },
    ] };
    case 25: return { title: '第一阵冷风', text: '早寒。今天保暖损失加大，晚上没有干燥床位的人会很难受。这不是最终寒潮。', choices: [{ id: 'ok', label: '多穿点' }] };
    case 28: return { title: '没有片尾字幕', text: '第28天，什么也没结束。日子还长。', choices: [{ id: 'ok', label: '继续' }] };
    case 30: return { title: '第一张愿望清单', text: '三个人各自想要的东西列在了愿望板上。看看谁的愿望积压最重。', choices: [{ id: 'ok', label: '去看愿望板' }] };
    case 35: return { title: '一格只能去一个地方', text: '今天日间有一单联合商户单（轩+凡，收入80），站口同一时段也会开牌局。选一个。', choices: [{ id: 'ok', label: '明白' }] };
    case 44: return { title: '明天下午撞期', text: '明天午后：轩哥连续试工（日间+午后两格，成功后解锁固定维修位），凡哥的采访需要马哥同槽协助（放弃马哥自己的活）。今天先准备好相机电量。', choices: [{ id: 'ok', label: '安排一下' }] };
    case 45: return { title: '两件重要的事', text: '轩哥试工：安排日间与午后连续两格「基础维修」即可通过。凡哥采访：安排凡哥「许可采访」且马哥同槽在旧影院（任一行动）。', choices: [{ id: 'ok', label: '开始' }] };
    case 54: return { title: '卫生巡查', text: '街道来人巡查营地。营地脏污' + s.camp.dirt + '/100，超过60会被要求限期清理并影响服务站信任。', choices: [{ id: 'ok', label: '知道了' }] };
    case 57: return { title: '阶段诊疗复查', text: '诊所今天免费复查：所有已知病情今天在诊所可免费建立计划。', choices: [{ id: 'ok', label: '好' }] };
    case 66: return { title: '寒潮的日期写出来了', text: '第71—74天寒潮，72—73日最冷。需要：防雨3级或服务站过夜、每人一条毯子、足够食物、药品。彩票亭关门，便利店只开日间午后。', choices: [{ id: 'ok', label: '开始准备' }] };
    case 70: return { title: '最后一次检查', text: '毯子' + s.items.filter((x) => x.itemId === 'blanket').length + '/' + anyActive.length + '，防雨' + s.camp.rain + '/3，食物' + s.effectiveFood + '份，现金' + s.cash + '。', choices: [{ id: 'ok', label: '明天开始' }] };
    case 85: return { title: '想要的不只是活着', text: '有三条长期路线可以选，也可以都不选。选定后需在第98天前完成条件。', choices: [
      { id: 'rent', label: '合租一间小屋：需在D98前攒到现金260（三人）/200（两人）/140（一人）' },
      { id: 'studio', label: fan || xuan ? '小工作室：作品≥3且轩哥或凡哥完成固定单≥6次' : '小工作室（需要轩哥或凡哥在世）', requires: (st) => (st.actors.fan.life === 'active' || st.actors.xuan.life === 'active' ? null : '没有人做这条路线') },
      { id: 'job', label: ma ? '马哥的固定岗位：累计跑腿≥10次且D98前保持信任' : '马哥的固定岗位（马哥不在了）', requires: (st) => (st.actors.ma.life === 'active' ? null : '马哥不在了') },
      { id: 'none', label: '先不选，继续过日子' },
    ] };
    case 88: return { title: '路线确认', text: '当前路线：' + routeLabel(s) + '。' + routeProgress(s), choices: [{ id: 'ok', label: '继续' }] };
    case 98: return { title: '准备', text: '还有两天。' + routeProgress(s), choices: [{ id: 'ok', label: '把最后的事做完' }] };
    case 100: return { title: '今晚终于有答案', text: '第100天。今晚之后按真实的存活者收束。', choices: [{ id: 'ok', label: '过完这一天' }] };
    default: {
      // 熟人给的旧电视：三个人各有想法，修好后卖/留/送只能选一样。
      if (d >= 12 && !s.flags.tvOffered && (relation(s, 'reg_lu').trust >= 2 || relation(s, 'reg_xu').trust >= 2)) {
        const who = relation(s, 'reg_lu').trust >= 2 ? '鲁叔' : '许姐';
        return { title: '这台旧电视，最后归谁', text: `${who}指着墙角一台落灰的电视：“能修就拿走，修不好别再搬回来。”轩哥看了一眼后盖，说能修，要修理桌和两个零件。凡哥想把它留在营地放片。马哥已经问到老周收六十。`, choices: [
          { id: 'take', label: '搬回营地（进营地箱，等轩哥修）' },
          { id: 'leave', label: '不要，省得吵' },
        ] };
      }
      const clearing = campClearingNode(s);
      if (clearing) return clearing;
      const c = getData().chapters.find((x) => x.startDay === d);
      if (c) return { title: '第' + c.number + '章 ' + c.title, text: c.objective + '。' + c.systems + '。', choices: [{ id: 'ok', label: '开始' }] };
      return null;
    }
  }
}

export function applyMorningChoice(state, choiceId, events) {
  const d = state.day;
  if (d === 3 && choiceId === 'build') {
    state.flags.bedHint = true;
    events.push('家具城在服务站和回收巷之间，日间与午后营业。先留足饭钱，再买床；包裹送营地，回营拆包摆放后生效。');
  }
  if (d === 18) {
    if (choiceId === 'storage') { state.flags.storedGear = true; events.push('设备寄存好了，暴雨不会淋到它们。'); }
    if (choiceId === 'shelter') { state.flags.shelterDay = 18; events.push('今晚全员去服务站过夜。'); }
    if (choiceId === 'stay' && state.camp.rain < 2) { state.flags.stormSoak = true; events.push('棚子挡不住这场雨。今晚全员淋湿。'); }
  }
  if (d === 54 && state.camp.dirt > 60) { relation(state, 'reg_wang').trust = clamp(relation(state, 'reg_wang').trust - 1, 0, 5); state.flags.inspectionFail = true; events.push('营地被记了一笔：限期清理。王叔的信任-1。'); }
  if (d === 57) state.flags.freePlanDay = 57;
  if (d === 85) state.flags.route = choiceId === 'none' ? null : choiceId;
  if (['move', 'stay'].includes(choiceId) && isClearingDay(state)) campClearing(state, choiceId, events);
  if (!state.flags.tvOffered && (choiceId === 'take' || choiceId === 'leave') && d >= 12 && d !== 85) {
    state.flags.tvOffered = true;
    if (choiceId === 'take') { makeItem(state, 'broken_tv', 'camp'); events.push('坏电视搬回了营地箱。装个修理桌，轩哥用两个零件能修好。'); }
  }
}

export function routeLabel(s) {
  return { rent: '合租小屋', studio: '小工作室', job: '马哥的固定岗位' }[s.flags.route] || '未选择';
}

export function routeProgress(s) {
  const n = alive(s).length;
  if (s.flags.route === 'rent') { const need = n >= 3 ? 260 : n === 2 ? 200 : 140; return `现金${s.cash}/${need}。`; }
  if (s.flags.route === 'studio') return `作品${s.art}/3，固定单${(s.flags.fixedJobs || 0)}/6。`;
  if (s.flags.route === 'job') return `跑腿累计${s.flags.runs || 0}/10。`;
  return '没有长期路线，也可以只是继续生活。';
}

export function routeDone(s) {
  const n = alive(s).length;
  if (s.flags.route === 'rent') return s.cash >= (n >= 3 ? 260 : n === 2 ? 200 : 140);
  if (s.flags.route === 'studio') return s.art >= 3 && (s.flags.fixedJobs || 0) >= 6;
  if (s.flags.route === 'job') return (s.flags.runs || 0) >= 10 && s.actors.ma.life === 'active';
  return false;
}

// 结局：按住房、职业、作品、关系、马哥的选择、遗物组合。
export function computeEnding(state) {
  const s = state;
  const survivors = alive(s);
  const dead = s.deaths.map((x) => s.names[x.id]);
  const lines = [];
  const done = routeDone(s);
  if (survivors.length === 0) return { title: '这回，没有明天', lines: ['所有已入队的人都没有走到第100天。', ...s.deaths.map((x) => `${s.names[x.id]}：第${x.day}天，${x.cause}。`)], grade: 'wipe' };
  if (s.flags.route === 'rent') lines.push(done ? `${survivors.map((id) => s.names[id]).join('、')}在第100天签下了一间小屋。今晚不用再问睡哪儿。` : '小屋的钱没攒够。营地还在，桥还在，明天再想办法。');
  else if (s.flags.route === 'studio') lines.push(done ? '许姐的工作间有了新招牌。作品挂在墙上，有人真的会来看。' : '工作室的事没成，但作品还在，墙上的画没有褪色。');
  else if (s.flags.route === 'job') lines.push(done ? '马哥有了固定岗位。每天早上有人等他，不用再碰运气。' : '固定岗位没谈成。马哥还是站口的熟面孔，活照样有。');
  else lines.push('没有选长期路线。三个人继续过日子，日子本身也是答案。');
  for (const id of survivors) {
    const p = s.actors[id];
    if (id === 'xuan') lines.push(`轩哥：${(s.flags.repairs || 0) >= 10 ? '回收巷的人都知道找他修东西。' : '设备还是旧的，梗还是烂的。'}${p.mind >= 50 ? '他最近不太用梗遮东西了。' : ''}`);
    if (id === 'fan') lines.push(`凡哥：留下了${s.art}幅涂鸦，${(s.flags.films || 0) ? '剪出了' + s.flags.films + '部短片' : s.footage + '段没剪的素材'}${(s.flags.screenings || 0) > 0 ? '，有人认真看完过。' : '，还没人认真看完。'}`);
    if (id === 'ma') lines.push(`马哥：赌了${s.flags.gambles || 0}次，跑了${s.flags.runs || 0}趟腿。${(s.flags.gambles || 0) > (s.flags.runs || 0) ? '他还是相信手气。' : '他更相信自己的腿。'}`);
  }
  if (dead.length) lines.push(`空位：${dead.join('、')}。东西还在，人不会因为睡一觉就回来。`);
  return { title: survivors.length === 3 ? '今晚终于有答案' : survivors.length === 2 ? '两个人的答案' : '一个人的答案', lines, grade: done ? 'route' : 'survive' };
}

// 暴雨/寒潮等固定节点在夜间的附加结算。
export function nightScripted(state, events) {
  const s = state;
  if (s.day === 18 && s.flags.stormSoak) {
    for (const id of alive(s)) { s.actors[id].clothes.wet = true; s.actors[id].warmth = clamp(s.actors[id].warmth - 10); }
    for (const it of s.items) if (it.container === 'camp' && ['blanket', 'clean_clothes', 'underwear', 'socks', 'towel', 'paper_set'].includes(it.itemId) && !s.flags.storedGear) it.wet = true;
    events.push('暴雨灌进营地：全员衣服湿透、保暖-10，营地箱里的布制品受潮。');
  }
}
