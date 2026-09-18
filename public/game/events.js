// 事件导演：按（街区、时段）生成有身份、有期限的热点；效果包由程序执行，AI 只换台词。
import { getData } from './data.js';
import { rng, pick } from './rng.js';
import { clamp } from './rules.js';
import { activeWishes, nudgeWish, fulfillWish, respondWish } from './wishes.js';
import { makeItem } from './items.js';
import { relation } from './npcs.js';
import { pickFilm, canScreen, screenFilm } from './screening.js';
import { resolveConfrontation, alliesAt, C as TROUBLE } from './trouble.js';
import { beginCombat, combatPending } from './combat.js';

const R = getData; // 缩写：规则与模板都从设计数据取

const alive = (s) => Object.keys(s.actors).filter((id) => s.actors[id].life === 'active');
const hasWish = (s, id, t) => s.actors[id].life === 'active' && activeWishes(s, id).some((w) => w.templateId === t);
const anyRegularTrust = (s, n) => Object.values(s.relations).some((r) => r.trust >= n);

// 效果包。kind: book=占用当前格的主行动；present=结算时执行者须在事件街区；instant=选择即生效。
export const PACKS = {
  street_cards: { major: true, title: '雨棚下的牌桌', setup: '有人在空地支起折叠桌，几张旧牌压着一张车票。', choices: [
    { id: 'observe', label: '先看看，跟他们聊两句', kind: 'book', action: 'observe' },
    { id: 'join_paid', label: '入场10，坐一把', kind: 'book', action: 'cards' },
    { id: 'leave', label: '惦记着原来的活，先走了', kind: 'instant' },
  ] },
  lottery_queue: { cond: (s) => s.actors.ma.life === 'active', cast: ['ma'], title: '收银台前的犹豫', setup: '马哥在收银台前停了一下，看着那叠即开彩没伸手。', choices: [
    { id: 'let_think', label: '由他想去，今天不拦', kind: 'instant', effect: (s) => { nudgeWish(s, 'ma', 'ma_lottery', 10); } },
    { id: 'talk_down', label: '拍拍他：先把饭钱留出来', kind: 'instant', effect: (s) => { s.actors.ma.mind = clamp(s.actors.ma.mind - 1); } },
  ] },
  beg_worker: { title: '赶时间的工人', setup: '一个扛着工具袋的人停下来，看了你们一眼，手在口袋里摸了摸。', choices: [
    { id: 'ask', label: '说明处境，问他能不能帮一把', kind: 'present', effect: (s, ev, a, ev2) => { s.cash += 6; s.ledger.income += 6; ev2.push(`${s.names[a]}从工人那里得到6块零钱。`); } },
    { id: 'skip', label: '别耽误人家上工', kind: 'instant' },
  ] },
  beg_food: { title: '拿着多一份饭的路人', setup: '有人多买了一份饭，正在四下看有没有人要。', choices: [
    { id: 'accept', label: '接过来，说声谢谢', kind: 'present', effect: (s, ev, a, ev2) => { makeItem(s, 'meal', a); ev2.push(`${s.names[a]}收到一份没动过的饭。`); } },
    { id: 'decline', label: '让给更需要的人', kind: 'instant' },
  ] },
  beg_artist: { cond: (s) => s.actors.fan.life === 'active', cast: ['fan'], title: '停在涂鸦前的人', setup: '有人在墙前站了很久，问这是谁画的。', choices: [
    { id: 'chat', label: '凡哥跟他聊两句创作', kind: 'present', effect: (s, ev, a, ev2) => { s.actors.fan.mind = clamp(s.actors.fan.mind + 3); relation(s, 'reg_zhao').trust = clamp(relation(s, 'reg_zhao').trust + 1, 0, 5); ev2.push('凡哥聊了会儿墙上的东西，精神+3。'); } },
    { id: 'ask_supply', label: '顺口问他有没有用不上的纸笔', kind: 'present', effect: (s, ev, a, ev2) => { if (rng(s.seed, 'artist:' + ev.uid) < 0.5) { makeItem(s, 'paper_set', a); ev2.push('对方掏出一套没用完的纸笔。'); } else { s.cash += 5; s.ledger.income += 5; ev2.push('对方留下5块钱走了。'); } } },
    { id: 'pass', label: '不打扰', kind: 'instant' },
  ] },
  repair_request: { major: true, cond: (s) => s.actors.xuan.life === 'active', cast: ['xuan'], title: '路边坏掉的扫码设备', setup: '摊主的扫码牌黑了屏，急得直拍。修好给30，要一块零件。', choices: [
    { id: 'take', label: '轩哥接下这单（零件-1，收入30）', kind: 'book', action: 'oddjob', pay: 30, cost: { parts: 1 }, zoneOverride: 'market' },
    { id: 'decline', label: '手上有别的活', kind: 'instant' },
  ] },
  carry_boxes: { major: true, title: '散在地上的箱子', setup: '一车货翻在路边，老板喊着找人搬，给22。', choices: [
    { id: 'take', label: '接下搬运（收入22，体力16）', kind: 'book', action: 'oddjob', pay: 22 },
    { id: 'decline', label: '不接', kind: 'instant' },
  ] },
  free_wall: { major: true, cond: (s) => s.actors.fan.life === 'active' && !s.flags.wallPermit, cast: ['fan'], title: '愿意借墙的店主', setup: '店主指着侧墙说：画点好看的，随你。', choices: [
    { id: 'accept', label: '记下许可，之后带颜料来', kind: 'present', effect: (s, ev, a, ev2) => { s.flags.wallPermit = true; ev2.push('拿到了一面许可墙。'); } },
    { id: 'decline', label: '先不答应', kind: 'instant' },
  ] },
  shared_tea: { title: '可以坐会儿', setup: '志愿者倒了杯热水：坐一会儿吧，不收钱。', choices: [
    { id: 'sit', label: '坐一会儿', kind: 'present', effect: (s, ev, a, ev2) => { s.actors[a].mind = clamp(s.actors[a].mind + 2); s.actors[a].warmth = clamp(s.actors[a].warmth + 6); ev2.push(`${s.names[a]}喝了杯热水，精神+2、保暖+6。`); } },
    { id: 'pass', label: '不了，赶路', kind: 'instant' },
  ] },
  old_customer: { major: true, cond: (s) => anyRegularTrust(s, 3), title: '认出你的老客户', setup: '有人认出了你们，说手上有个活，想找靠谱的人，给36。', choices: [
    { id: 'take', label: '接下这单（收入36）', kind: 'book', action: 'oddjob', pay: 36 },
    { id: 'decline', label: '这次接不了', kind: 'instant' },
  ] },
  clothes_rain: { cond: (s) => Object.values(s.actors).some((p) => p.clothes.wet), title: '晾晒前下雨', setup: '天色不对，晾着的衣服还没干。', choices: [
    { id: 'collect', label: '收衣服进棚（今天先穿着湿的）', kind: 'present', effect: (s, ev, a, ev2) => { ev2.push('衣服收进来了，明早再晾。'); } },
    { id: 'cover', label: '用防雨罩盖上', kind: 'present', requires: (s, a) => s.items.some((x) => x.itemId === 'rain_cover') ? null : '没有防雨罩', effect: (s, ev, a, ev2) => { for (const p of Object.values(s.actors)) p.clothes.wet = false; ev2.push('防雨罩派上了用场，衣服保住了。'); } },
    { id: 'ignore', label: '随它去', kind: 'instant' },
  ] },
  last_soap: { title: '最后一块肥皂', setup: '货架上剩最后一块肥皂，店主说3块钱拿走。', choices: [
    { id: 'buy', label: '3块买下', kind: 'present', requires: (s) => (s.cash >= 3 ? null : '现金不足3'), effect: (s, ev, a, ev2) => { s.cash -= 3; s.ledger.expense += 3; makeItem(s, 'soap', a); ev2.push('3块钱买到一块肥皂。'); } },
    { id: 'pass', label: '不买', kind: 'instant' },
  ] },
  clinic_queue: { major: true, cond: (s) => alive(s).some((id) => s.actors[id].diseases.some((d) => !d.known)), title: '诊所的短队伍', setup: '今天诊所人少，评估只收10。', choices: [
    { id: 'go', label: '安排评估（花10）', kind: 'book', action: 'clinic', costOverride: 10 },
    { id: 'pass', label: '再等等', kind: 'instant' },
  ] },
  care_reminder: { cond: (s) => alive(s).some((id) => s.actors[id].hygiene < 30 || s.actors[id].clothes.dirty), title: '他今天又没换衣服', setup: '有人闻了闻自己的袖子，没说话。卫生太低会真的生病。', choices: [
    { id: 'ok', label: '知道了，今天安排洗漱', kind: 'instant' },
  ] },
  bad_joke: { cond: (s) => s.actors.xuan.life === 'active' && !s.actors.xuan.jokeUsed && !alive(s).some((id) => s.actors[id].grief > 0) && !Object.values(s.actors).some((p) => p.life === 'downed'), cast: ['xuan'], title: '这个梗真够烂的', setup: '轩哥：“我们现在也算云原生了，抬头全是云。”', choices: [
    { id: 'laugh', label: '接一句', kind: 'instant', effect: (s, ev, a, ev2) => { s.actors.xuan.jokeUsed = true; s.actors.xuan.mind = clamp(s.actors.xuan.mind + 3); for (const id of alive(s)) if (id !== 'xuan') s.actors[id].mind = clamp(s.actors[id].mind + 1); ev2.push('梗很烂，但有人接了。轩哥精神+3，其他人+1。'); } },
    { id: 'groan', label: '别说了', kind: 'instant', effect: (s) => { s.actors.xuan.jokeUsed = true; } },
  ] },
  unfinished_wall: { cond: (s) => hasWish(s, 'fan', 'fan_paint'), cast: ['fan'], title: '墙上还差一块', setup: '凡哥：“那面墙还差点蓝。”', choices: [
    { id: 'promise', label: '答应他：安排一趟材料采购', kind: 'instant', effect: (s, ev, a, ev2) => { const w = activeWishes(s, 'fan').find((x) => x.templateId === 'fan_paint'); if (w) { const r = respondWish(s, w.uid, 'promise'); ev2.push(r.error || '和凡哥约好了买颜料。'); } } },
    { id: 'sketch', label: '今晚先一起画纸板', kind: 'instant', effect: (s, ev, a, ev2) => { fulfillWish(s, 'fan', 'fan_paint', 'partial', ev2); } },
    { id: 'nothing', label: '现在顾不上', kind: 'instant' },
  ] },
  one_more_game: { cond: (s) => hasWish(s, 'ma', 'ma_cards'), cast: ['ma'], title: '都到这里了', setup: '马哥：“就看看今天谁在。”手已经摸到口袋里的牌。', choices: [
    { id: 'free', label: '回营打无赌注的', kind: 'instant', effect: (s, ev, a, ev2) => { fulfillWish(s, 'ma', 'ma_cards', 'partial', ev2); } },
    { id: 'no', label: '今天不行', kind: 'instant', effect: (s, ev, a, ev2) => { const w = activeWishes(s, 'ma').find((x) => x.templateId === 'ma_cards'); if (w) { const r = respondWish(s, w.uid, 'decline'); ev2.push(r.message || r.error); } } },
  ] },
  adult_chat: { title: '夜市的一次搭话', setup: '摊边有人主动搭话，聊得还行。', choices: [
    { id: 'chat', label: '聊下去', kind: 'present', effect: (s, ev, a, ev2) => { s.actors[a].mind = clamp(s.actors[a].mind + 4); fulfillWish(s, a, 'adult_connection', 'partial', ev2); ev2.push(`${s.names[a]}聊得不错，精神+4。`); } },
    { id: 'leave', label: '告别', kind: 'instant' },
  ] },
  returned_tool: { cond: (s) => s.flags.lentTool, title: '工具送回来了', setup: '之前借出去的工具被送了回来，还多给了两块零件。', choices: [
    { id: 'take', label: '收下', kind: 'instant', effect: (s, ev, a, ev2) => { s.flags.lentTool = false; s.parts += 2; ev2.push('工具回来了，零件+2。'); } },
  ] },
  lost_note: { title: '湿掉的记事纸', setup: '地上有张湿透的纸条，字迹半糊，像是一张购物清单。', choices: [
    { id: 'read', label: '捡起来看看', kind: 'present', effect: (s, ev, a, ev2) => { if (rng(s.seed, 'note:' + ev.uid) < 0.35) { s.cash += 3; s.ledger.income += 3; ev2.push('纸条里夹着3块钱。'); } else ev2.push('只是一张购物清单：肥皂、面包、给孩子的糖。'); } },
    { id: 'ignore', label: '不管', kind: 'instant' },
  ] },
  job_tip: { major: true, title: '还有一班短工', setup: '告示上写着：临时缺人，给26。', choices: [
    { id: 'take', label: '接这班短工（收入26）', kind: 'book', action: 'oddjob', pay: 26 },
    { id: 'pass', label: '不去', kind: 'instant' },
  ] },
  market_close: { title: '今天提前收摊', setup: '便利店门口贴了条：下一时段盘点，暂停营业。', choices: [
    { id: 'ok', label: '知道了', kind: 'instant', effect: (s) => { const next = s.slot + 1; if (next <= 3 && !s.shops.convenience.closedSlots.includes(next)) s.shops.convenience.closedSlots.push(next); } },
  ] },
  public_water: { title: '水点排队', setup: '免费水点今天人不多。', choices: [
    { id: 'wash', label: '排队洗把脸（卫生+10）', kind: 'present', effect: (s, ev, a, ev2) => { s.actors[a].hygiene = clamp(s.actors[a].hygiene + 10); ev2.push(`${s.names[a]}用免费水点洗了洗，卫生+10。`); } },
    { id: 'pass', label: '不排了', kind: 'instant' },
  ] },
  // 许姐场地与营地放映共用身份、间隔和首映记录；没剪出短片时放素材/涂鸦，走原来的效果但同样占用间隔。
  small_screening: { major: true, cond: (s) => s.actors.fan.life === 'active' && (s.footage > 0 || s.art > 0 || (s.films || []).length > 0) && canScreen(s, s.day), cast: ['fan'], title: '有人愿意看一段', setup: '许姐说工作间晚上空着，可以放一段给几个人看。', choices: [
    { id: 'show', label: '放一段', kind: 'present', effect: (s, ev, a, ev2) => { if (pickFilm(s)) { screenFilm(s, s.day, ['fan'], 'studio', ev2); return; } s.actors.fan.mind = clamp(s.actors.fan.mind + 10); fulfillWish(s, 'fan', 'fan_seen', 'exact', ev2); relation(s, 'reg_xu').trust = clamp(relation(s, 'reg_xu').trust + 1, 0, 5); s.flags.screenings = (s.flags.screenings || 0) + 1; s.flags.lastScreeningDay = s.day; ev2.push('几个人认真看完了。凡哥精神+10。'); } },
    { id: 'later', label: '还没准备好', kind: 'instant' },
  ] },
  shared_dinner: { title: '多坐一个人', setup: '今晚饭够，围坐着吃比各吃各的好。', choices: [
    { id: 'together', label: '一起吃', kind: 'present', effect: (s, ev, a, ev2) => { for (const id of alive(s)) s.actors[id].mind = clamp(s.actors[id].mind + 3); ev2.push('三个人一起吃了顿饭，各精神+3。'); } },
    { id: 'apart', label: '各自吃', kind: 'instant' },
  ] },
  memorial_object: { cond: (s) => s.deaths.length > 0 && s.items.some((x) => x.container.startsWith('relic:')), title: '那个位置空着', setup: '东西还在那儿。今天不想整理，就先别动。', choices: [
    { id: 'sort', label: '整理遗物，放进物资箱', kind: 'present', effect: (s, ev, a, ev2) => { for (const it of s.items) if (it.container.startsWith('relic:')) it.container = 'camp'; for (const id of alive(s)) s.actors[id].mind = clamp(s.actors[id].mind + 2); ev2.push('遗物整理好了，放在大家都能拿到的地方。'); } },
    { id: 'leave', label: '先别动', kind: 'instant' },
  ] },
  warm_place: { major: true, cond: (s) => ['cold', 'coldwave', 'storm'].includes(s.weatherKind), title: '有一处可以躲风', setup: '服务站今晚开放临时过夜区，能挤一挤。', choices: [
    { id: 'shelter', label: '今晚全员去服务站过夜', kind: 'instant', effect: (s, ev, a, ev2) => { s.flags.shelterDay = s.day; ev2.push('今晚去服务站过夜：干燥、暖和，但挤。'); } },
    { id: 'no', label: '留在营地', kind: 'instant' },
  ] },
  dangerous_shortcut: { major: true, title: '近路并不便宜', setup: '翻过那道矮墙能省半小时，但地上全是碎玻璃。', choices: [
    { id: 'shortcut', label: '走近路（省体力6，50%受伤8—14并留伤口）', kind: 'present', effect: (s, ev, a, ev2) => { const p = s.actors[a]; p.energy = clamp(p.energy + 6); if (rng(s.seed, 'short:' + ev.uid) < 0.5) { const hit = 8 + Math.floor(rng(s.seed, 'shorthit:' + ev.uid) * 7); p.health = clamp(p.health - (a === 'ma' ? Math.ceil(hit * 0.75) : hit)); p.exposure.wound = true; ev2.push(`${s.names[a]}走近路划伤了，健康-${hit}，留下伤口需要护理。`); } else ev2.push(`${s.names[a]}走近路省了点力气，没出事。`); } },
    { id: 'around', label: '绕路', kind: 'instant' },
  ] },
  strained_friend: { cond: (s) => s.wishes.some((w) => w.status === 'active' && w.promise && w.promise.expiredNoted && s.actors[w.actor].life === 'active'), title: '今天不想再解释', setup: '有人翻出了之前答应过的事，没有说下去。', choices: [
    { id: 'apologize', label: '道歉，说清楚什么时候能做到', kind: 'instant', effect: (s, ev, a, ev2) => { for (const w of s.wishes) if (w.status === 'active' && w.promise?.expiredNoted) { w.intensity = clamp(w.intensity - 10); s.actors[w.actor].mind = clamp(s.actors[w.actor].mind + 2); } ev2.push('话说开了，压力小了一点。'); } },
    { id: 'silent', label: '不回应', kind: 'instant', effect: (s, ev, a, ev2) => { for (const w of s.wishes) if (w.status === 'active' && w.promise?.expiredNoted) w.intensity = clamp(w.intensity + 10); ev2.push('没人说话。积压更重了。'); } },
  ] },
  quiet_night: { title: '今晚没有新麻烦', setup: '今天没什么新事。有人把明天要用的东西往门边挪了挪。', choices: [
    { id: 'ok', label: '好', kind: 'instant', effect: (s) => { for (const id of alive(s)) s.actors[id].mind = clamp(s.actors[id].mind + 1); } },
  ] },
};

// 03 之外的追加模板（与 03 同结构），并入导演候选。
export const EXTRA_TEMPLATES = [
  { id: 'promo_project', name: '商户想要一支宣传片', category: 'work', districtIds: ['market'], openSlots: [1, 2], effectPolicy: '三人接力：拍摄→剪辑→交付', constraint: '有截止日，缺员可外包不可跳步', defaultExpiresAfterTurns: 2, requiresActivePresentActor: true, aiMode: 'text_or_bounded_assembly', forbiddenAiFields: [], repeatCooldownDays: 10 },
  { id: 'street_thugs', name: '拦路的小混混', category: 'risk', districtIds: ['station', 'market'], openSlots: [3], effectPolicy: '给烟/给钱/说话/跑/硬顶', constraint: '不做通缉与坐牢', defaultExpiresAfterTurns: 1, requiresActivePresentActor: true, aiMode: 'text_or_bounded_assembly', forbiddenAiFields: [], repeatCooldownDays: 4 },
  { id: 'chengguan_sweep', name: '城管清街', category: 'risk', districtIds: ['market', 'station', 'cinema'], openSlots: [1, 2], effectPolicy: '收拾走人/交罚款/讲理/硬顶', constraint: '白天，针对摆摊乞讨的人；不做拘留', defaultExpiresAfterTurns: 1, requiresActivePresentActor: true, aiMode: 'text_or_bounded_assembly', forbiddenAiFields: [], repeatCooldownDays: 5 },
];
PACKS.promo_project = { major: true, cond: (s) => s.day >= 15 && !s.flags.project && s.actors.fan.life === 'active', cast: ['fan', 'xuan', 'ma'], title: '商户想要一支宣传片', setup: '市场口的几家店凑钱要一支两分钟的宣传片：拍摄、剪辑、六天内交到刘姐手上，给90。', choices: [
  { id: 'accept', label: '接下（六天内：凡哥拍摄→剪辑→有人送到老街）', kind: 'instant', effect: (s, ev, a, ev2) => { s.flags.project = { id: 'promo', stage: 1, deadline: s.day + 6, acceptedDay: s.day }; ev2.push('接下了宣传片：第一步凡哥安排「商户宣传拍摄」或「许可采访」，第二步「剪辑小委托」出成品，第三步任何人带成品到老街交付。'); } },
  { id: 'decline', label: '现在接不了', kind: 'instant' },
] };
// 街头冲突走 trouble.js 的模型：和平四种、打架看战力，受伤分三档；同街区同时段的队友算帮手。
const confront = (kind, choice) => (s, ev, a, ev2) => { const r = resolveConfrontation(s, { kind, actorId: a, choice, key: ev.uid, allies: alliesAt(s, a, ev.district) }, ev2); if (r.error) ev2.push(`「${ev.title}」没处理成：${r.error}`); };
PACKS.street_thugs = { major: false, cond: (s) => s.day >= 5 && !((s.flags.thugRespect || 0) > s.day), title: '拦路的小混混', setup: '两个穿连帽衫的堵在巷口：“兄弟，身上有烟没？”', choices: [
  { id: 'smoke', label: '递根烟打发（需自己包里有烟）', kind: 'present', requires: (s, a) => (s.items.some((x) => x.itemId === 'cigarette' && x.container === a && x.uses > 0) ? null : '包里没烟'), effect: confront('thugs', 'smoke') },
  { id: 'pay', label: '给几块钱了事（5—10，会被记住）', kind: 'present', requires: (s) => (s.cash >= TROUBLE.payRange[1] ? null : '现金不足' + TROUBLE.payRange[1]), effect: confront('thugs', 'pay') },
  { id: 'talk', label: '说两句（轩哥讲道理／凡哥举相机／马哥报老陈）', kind: 'present', effect: confront('thugs', 'talk') },
  { id: 'run', label: '跑（体力-8、卫生-3，两成掉东西）', kind: 'present', effect: confront('thugs', 'run') },
  { id: 'fight', label: '当场反抗（攻击、防守或撤离；输了受伤被搜身）', kind: 'combat', combatKind: 'thugs' },
] };
PACKS.chengguan_sweep = { major: false, cond: (s) => s.day >= 8, title: '城管清街', setup: '两辆电动车停在路口，穿制服的挨个摊子拍照：“都收了，别让我说第二遍。”', choices: [
  { id: 'leave', label: '收拾走人（瓶罐纸板被没收，没有就丢半格摊钱）', kind: 'present', effect: confront('chengguan', 'leave') },
  { id: 'fine', label: '交罚款保东西（20—40）', kind: 'present', requires: (s) => (s.cash >= TROUBLE.fineRange[1] ? null : '现金不足' + TROUBLE.fineRange[1]), effect: confront('chengguan', 'fine') },
  { id: 'reason', label: '讲理（王叔信任高或有队友在场更容易过）', kind: 'present', effect: confront('chengguan', 'reason') },
  { id: 'fight', label: '当场反抗（对方很强：受伤、罚款、今天不能摆摊）', kind: 'combat', combatKind: 'chengguan' },
] };

// 霉运模板不做热点，结算时抽文案用。
export const MISFORTUNE_TEXT = { ripped_bag: '袋底开了，东西撒了一地', wrong_entrance: '工作入口换了地方，白跑一段' };
const NO_SPAWN = new Set(['ripped_bag', 'wrong_entrance']);

export function templateOf(id) {
  return R().eventTemplates.find((t) => t.id === id) || EXTRA_TEMPLATES.find((t) => t.id === id);
}

function allTemplates() {
  return R().eventTemplates.concat(EXTRA_TEMPLATES);
}

export function openEvents(state) {
  return state.events.filter((e) => e.status === 'open' || e.status === 'reserved');
}

function spawnOne(state, tplId, district, events, forced = false) {
  const tpl = templateOf(tplId);
  const pack = PACKS[tplId];
  state.eventSeq = (state.eventSeq || 0) + 1;
  const ev = {
    uid: 'e' + state.eventSeq,
    templateId: tplId,
    district,
    spawnedTurn: state.turn,
    // turn 是已完成回合数；热点在接下来两个规划机会里可预约。
    expiresTurn: state.turn + (tpl?.defaultExpiresAfterTurns || R().rules.events.opportunityExpiryDefaultTurns),
    status: 'open',
    reserved: null,
    title: pack.title,
    setup: pack.setup,
    major: Boolean(pack.major),
    cast: pack.cast || null,
    forced,
  };
  state.events.push(ev);
  state.eventCooldown[tplId] = state.day + (tpl?.repeatCooldownDays || 3);
  state.recentTemplates = [tplId, ...state.recentTemplates].slice(0, 6);
  if (pack.major) state.daily.majorEvents += 1;
  events.push(`热点：${ev.title}（${districtLabel(district)}，还剩${ev.expiresTurn - state.turn}回合）`);
  return ev;
}

function districtLabel(id) {
  return R().districts.find((d) => d.id === id)?.name || id;
}

function spawnSmokeTrouble(state, events, visibleCap) {
  if ((state.flags?.fireSmoke ?? 0) > 0) {
    const lastDay = state.flags.fireSmokeDay ?? state.day;
    if (state.day > lastDay) state.flags.fireSmoke = Math.max(0, state.flags.fireSmoke - 2 * (state.day - lastDay));
    state.flags.fireSmokeDay = state.day;
  }
  const smoke = state.flags?.fireSmoke ?? 0;
  const seq = state.flags?.smokeSeq ?? 0;
  if (smoke < 6 || seq <= (state.flags?.smokeProcessedSeq ?? 0)) return;
  if (state.flags.smokeTroubleDay === state.day || openEvents(state).length >= visibleCap) return;
  if (openEvents(state).some((event) => event.district === 'camp')) return;
  const available = ['chengguan_sweep', 'street_thugs'].filter((id) => {
    const pack = PACKS[id];
    return (!pack.cond || pack.cond(state)) && (state.eventCooldown[id] ?? 0) <= state.day;
  });
  if (!available.length) return;
  state.flags.smokeProcessedSeq = seq;
  const chance = Math.min(0.65, 0.1 + (smoke - 6) * 0.04);
  if (rng(state.seed, `fireSmoke:${seq}`) >= chance) return;
  const index = Math.floor(rng(state.seed, `fireSmokeType:${seq}`) * available.length);
  const id = available[index];
  const event = spawnOne(state, id, 'camp', events);
  event.setup = id === 'chengguan_sweep'
    ? '营地的炭烟飘到了路口，巡查的城管循着烟找来：“这里不能这么烧，先把东西收起来。”'
    : '营地的炭烟引来两个小混混。他们站在棚边，盯着火堆和你们的包。';
  state.flags.smokeTroubleDay = state.day;
  state.flags.fireSmoke = Math.max(0, smoke - 6);
}

// 每个规划节点调用一次：过期、生成。
export function directorTick(state, events) {
  for (const ev of state.events) {
    if ((ev.status === 'open' || ev.status === 'reserved') && state.turn >= ev.expiresTurn) {
      ev.status = 'expired';
      ev.reserved = null;
    }
  }
  state.events = state.events.filter((e) => e.status === 'open' || e.status === 'reserved' || state.turn - e.spawnedTurn < 8);
  const rules = R().rules.events;
  // 保底：D1 清晨市场赠餐教学；D6 日间站口牌局。
  if (state.day === 1 && state.slot === 0 && !state.events.some((e) => e.templateId === 'beg_food')) spawnOne(state, 'beg_food', 'market', events, true);
  if (state.day === 6 && state.slot === 1 && !state.events.some((e) => e.templateId === 'street_cards' && e.spawnedTurn === state.turn)) spawnOne(state, 'street_cards', 'station', events, true);
  spawnSmokeTrouble(state, events, rules.visibleAmbientHotspotsCap);
  const visible = () => openEvents(state).length;
  const districts = ['market', 'station', 'recycle', 'cinema', 'service', 'camp'];
  for (const district of districts) {
    if (visible() >= rules.visibleAmbientHotspotsCap) break;
    if (openEvents(state).some((e) => e.district === district)) continue;
    if (rng(state.seed, `spawn:${state.turn}:${district}`) >= rules.locationSpawnProbabilityPerEligibleSlot) continue;
    const cands = allTemplates().filter((t) => {
      if (NO_SPAWN.has(t.id) || !PACKS[t.id]) return false;
      if (!t.districtIds.includes(district) || !t.openSlots.includes(state.slot)) return false;
      if ((state.eventCooldown[t.id] || 0) > state.day) return false;
      const pack = PACKS[t.id];
      if (pack.major && state.daily.majorEvents >= rules.majorEventsTeamDailyCap) return false;
      if (pack.cond && !pack.cond(state)) return false;
      return true;
    });
    if (!cands.length) continue;
    // 近期看过的模板与类别降权，优先没见过的内容。
    // 许姐的工作间开放放映（委托奖励或回赠电视）后，放映事件更常出现。
    const venue = state.flags.xuVenue || state.flags.screeningVenueUnlocked;
    // 给过混混钱的人会被记住；收音机说了明天哪条街查得严，那条街就更容易碰上城管。
    const sweep = state.flags.sweepTomorrow;
    const weights = cands.map((t) => (state.recentTemplates.includes(t.id) ? 0.3 : 1) * (state.recentTemplates.some((id) => templateOf(id)?.category === t.category) ? 0.6 : 1) * (state.seenTemplates[t.id] ? 1 : 1.6) * (venue && t.id === 'small_screening' ? 2 : 1) * (t.id === 'street_thugs' ? 1 + TROUBLE.thugTaxStep * (state.flags.thugTax || 0) : 1) * (t.id === 'chengguan_sweep' && sweep && sweep.day === state.day && sweep.district === district ? 3 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rng(state.seed, `pickev:${state.turn}:${district}`) * total;
    let chosen = cands[cands.length - 1];
    for (let i = 0; i < cands.length; i++) { x -= weights[i]; if (x < 0) { chosen = cands[i]; break; } }
    state.seenTemplates[chosen.id] = (state.seenTemplates[chosen.id] || 0) + 1;
    spawnOne(state, chosen.id, district, events);
  }
}

// 玩家预约或即时处理一个选项。
export function chooseEvent(state, uid, choiceId, actorId) {
  if (combatPending(state)) return { error: '先处理眼前的战斗。' };
  const ev = state.events.find((e) => e.uid === uid);
  if (!ev || (ev.status !== 'open' && ev.status !== 'reserved')) return { error: '这个机会已经不在了' };
  const pack = PACKS[ev.templateId];
  const choice = pack.choices.find((c) => c.id === choiceId);
  if (!choice) return { error: '没有这个选项' };
  const p = state.actors[actorId];
  if (!p || p.life !== 'active') return { error: '需要一名可行动的人' };
  if (ev.cast && !ev.cast.includes(actorId)) return { error: '这件事只能由' + ev.cast.map((x) => state.names[x]).join('/') + '处理' };
  if (choice.requires) { const err = choice.requires(state, actorId); if (err) return { error: err }; }
  if (choice.kind === 'combat') {
    const r = beginCombat(state, { actorId, kind: choice.combatKind, eventUid: uid });
    if (r.error) return { error: r.error };
    Object.assign(state, r.state);
    return { ok: true, events: r.events, combat: r.combat };
  }
  if (choice.kind === 'instant') {
    const events = [];
    if (choice.effect) choice.effect(state, ev, actorId, events);
    ev.status = 'resolved';
    ev.reserved = null;
    return { ok: true, events, resolved: true };
  }
  ev.status = 'reserved';
  ev.reserved = { actorId, choiceId, kind: choice.kind, action: choice.action || null, pay: choice.pay || null, cost: choice.cost || null, costOverride: choice.costOverride ?? null, zone: choice.zoneOverride || ev.district };
  return { ok: true, reserved: ev.reserved, book: choice.kind === 'book' ? { action: choice.action, zone: ev.reserved.zone } : null };
}

export function releaseEvent(state, uid) {
  const ev = state.events.find((e) => e.uid === uid);
  if (ev && ev.status === 'reserved') { ev.status = 'open'; ev.reserved = null; }
}

// 结算时执行 present 类预约：执行者本格必须在事件街区。
export function settleReserved(state, actorZones, events) {
  for (const ev of state.events) {
    if (ev.status !== 'reserved' || !ev.reserved) continue;
    const { actorId, choiceId, kind } = ev.reserved;
    const pack = PACKS[ev.templateId];
    const choice = pack.choices.find((c) => c.id === choiceId);
    if (kind === 'present') {
      if (actorZones[actorId] !== ev.district || state.actors[actorId].life !== 'active') {
        events.push(`「${ev.title}」没有处理：${state.names[actorId]}本格不在${districtLabel(ev.district)}。`);
        ev.status = 'open'; ev.reserved = null;
        continue;
      }
      if (choice.effect) choice.effect(state, ev, actorId, events);
    }
    ev.status = 'resolved';
    ev.reserved = null;
  }
}

export function misfortuneLine(state, key) {
  return pick(rng(state.seed, key), Object.values(MISFORTUNE_TEXT));
}
