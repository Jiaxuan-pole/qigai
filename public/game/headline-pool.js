// 今日事的池子：每天从这里抽一件只属于今天的事。每件事是一个清晨节点，选项有的当场生效，
// 有的在街上开一个有时限的热点（spawn），窗口关了还没去就执行 miss。数值都是虚构参数，策划文件未定。
// 定时热点的模板与效果包也放在这里，events.js 会把它们并进 PACKS，但导演永远不会自己刷出它们。
import { rng } from './rng.js';
import { clamp } from './rules.js';
import { relation } from './npcs.js';
import { makeItem } from './items.js';
import { fulfillWish } from './wishes.js';
import { PAID_EVENT_COST as P } from './costs.js';

const alive = (s) => Object.keys(s.actors).filter((id) => s.actors[id].life === 'active');
const needCash = (n) => (s) => (s.cash >= n ? null : '现金不足，需' + n);
const trustUp = (s, npcId, n = 1) => { const rel = relation(s, npcId); rel.trust = clamp(rel.trust + n, 0, 5); };
const mindAll = (s, n) => { for (const id of alive(s)) s.actors[id].mind = clamp(s.actors[id].mind + n); };
// 状态最差的那个人：精神低于 35 或病情不轻的，取精神最低者。
const sickOne = (s) => alive(s).filter((id) => s.actors[id].mind < 35 || s.actors[id].diseases.some((d) => d.severity >= 30)).sort((a, b) => s.actors[a].mind - s.actors[b].mind)[0] || null;

// 占地费再来的间隔：交了十天后来，不交五天就来，熟人说通了半个月清净。
export const LAND_FEE_RETURN = { paid: 10, refused: 5, talked: 15 };
const FORK_PAY = 24;
const HANDS_PAY = 22;
const WALLET = 30;
// 今日事里的书面短工给 20—26：比普通短工（11—18）高，才值得专门跑一趟并让出一个小时。
const TRUCK_PAY = 24;
const GRIDDLE_PAY = 22;
const WATCH_PAY = 20;
const CIG_BUY = 30;
const CIG_SELL = 50;
const COBBLER = 35;
const CAMERA_IDS = ['camera', 'old_camera'];
const cameraOf = (s) => s.items.find((x) => CAMERA_IDS.includes(x.itemId) && !x.container.startsWith('relic:'));
const campFood = (x) => x.container === 'camp' && ['bread', 'meal', 'hot_soup'].includes(x.itemId);
const needParts = (s) => (s.parts >= 1 ? null : '需要1块零件');
const wet = (s) => ['rain', 'storm'].includes(s.weatherKind);
// 用掉一件物品的一格用量，用完即删；胶带、颜料这类多次用品走这里。
const spend = (s, match) => { const it = s.items.find(match); if (!it) return false; it.uses -= 1; if (it.uses <= 0) s.items = s.items.filter((x) => x.uid !== it.uid); return true; };

export const POOL = [
  // 收占地费的人是这游戏里最稳定的钱的去处：只要到了日子就一定来，不进随机池。
  { id: 'land_fee', force: true, cooldownDays: 0, cond: (s) => Boolean(s.flags.landFeeDue) && s.flags.landFeeDue <= s.day,
    title: '收占地费的又来了',
    text: (s) => `那个揣着手的男人又蹲到了桥墩上，身后还是那两个：“到日子了，${P.land}。”现金${s.cash}。`,
    choices: [
      { id: 'pay', label: `交${P.land}元占地费`, requires: needCash(P.land), effect: (s, ev) => { s.cash -= P.land; s.ledger.expense += P.land; s.flags.landFeeDue = s.day + LAND_FEE_RETURN.paid; ev.push(`又交了${P.land}块占地费。他把钱数了两遍：“${LAND_FEE_RETURN.paid}天后见。”`); } },
      { id: 'talk', label: '让老陈或王叔出面说话', requires: (s) => (relation(s, 'reg_chen').trust >= 3 || relation(s, 'reg_wang').trust >= 3 ? null : '老陈或王叔的信任要到3'), effect: (s, ev) => {
        if (rng(s.seed, 'landfee:talk:' + s.day) < 0.5) { s.flags.landFeeDue = s.day + LAND_FEE_RETURN.talked; mindAll(s, 2); ev.push(`话说到了人：他们嘟囔了两句走了，这${LAND_FEE_RETURN.talked}天不会再来。全员精神+2。`); }
        else { s.flags.landFeeDue = s.day + LAND_FEE_RETURN.refused; mindAll(s, -2); ev.push(`对方不买账：“谁的面子也不好使。”说${LAND_FEE_RETURN.refused}天后再来。全员精神-2。`); }
      } },
      { id: 'refuse', label: '不交，看他们能怎么样', effect: (s, ev) => { s.camp.rain = clamp(s.camp.rain - 1, 0, 3); mindAll(s, -4); s.flags.landFeeDue = s.day + LAND_FEE_RETURN.refused; ev.push(`没交。棚子又被踹塌一角：防雨降到${s.camp.rain}/3，全员精神-4。他们说${LAND_FEE_RETURN.refused}天后再来。`); } },
    ] },
  { id: 'zhou_double', minDay: 5, cooldownDays: 6, weight: 1.2,
    title: '老周今天收双价', text: '老周的回收铺门口挂了块纸牌：今天上午瓶罐两块一个，过了十二点恢复一块。',
    choices: [
      { id: 'go', label: '记下了，十二点前派人去回收巷', spawn: () => ({ templateId: 'zhou_double_spot', district: 'recycle', window: { from: 9, to: 12 } }) },
      { id: 'skip', label: '今天顾不上' },
    ] },
  { id: 'liu_short', minDay: 5, cooldownDays: 7, cond: (s) => s.flags.liuClosedDay !== s.day,
    title: '刘姐早班缺人', text: '刘姐让人捎话：今天早市缺人手，九点前来一个，多给一份饭。她记性好，谁答应了没来她也记得。',
    choices: [
      { id: 'go', label: '答应了，九点前到老街', spawn: () => ({ templateId: 'liu_short_spot', district: 'market', window: { from: 6, to: 9 } }) },
      { id: 'decline', label: '回话说去不了', effect: (s, ev) => { trustUp(s, 'reg_liu', -1); ev.push('刘姐没说什么，只是“哦”了一声。刘姐信任-1。'); } },
    ] },
  { id: 'fan_fork', minDay: 12, cooldownDays: 9, cond: (s) => s.actors.fan.life === 'active',
    title: '凡哥的下午只有一个', text: `老街的鞋店想让凡哥下午两点到五点拍一段短视频，给${FORK_PAY}；许姐同一时段在工作间放片，想让凡哥来讲两句。两头都在等回话。`,
    choices: [
      { id: 'both', label: '两边都记下，到时候看人在哪', spawn: () => [
        { templateId: 'fork_shoot_spot', district: 'market', window: { from: 14, to: 17 } },
        { templateId: 'fork_screening_spot', district: 'cinema', window: { from: 14, to: 17 } },
      ] },
      { id: 'skip', label: '都推了，今天凡哥有别的事', effect: (s, ev) => { trustUp(s, 'reg_xu', -1); ev.push('两头都推了。许姐那边有点失望：信任-1。'); } },
    ] },
  { id: 'sick_mate', minDay: 5, cooldownDays: 5, cond: (s) => Boolean(sickOne(s)) && alive(s).length >= 2,
    title: '有人今天状态不对', text: (s) => { const id = sickOne(s); return `${s.names[id]}早上没起来，翻了个身面对墙。精神${s.actors[id].mind}。`; },
    choices: [
      { id: 'stay', label: (s) => `今天留个人陪${s.names[sickOne(s)]}坐一小时（营地，全天）`, spawn: (s) => { const t = sickOne(s); return { templateId: 'sick_mate_spot', district: 'camp', window: { from: 6, to: 22 }, cast: alive(s).filter((id) => id !== t), target: t }; } },
      { id: 'ignore', label: '让他自己缓缓', effect: (s, ev) => { const id = sickOne(s); s.actors[id].mind = clamp(s.actors[id].mind - 4); ev.push(`${s.names[id]}一个人躺到中午。精神-4。`); } },
    ] },
  { id: 'station_hands', minDay: 5, cooldownDays: 4, weight: 1.3,
    title: '站前有人招临时工', text: `站前街的货车十点到，卸完就走，现结${HANDS_PAY}，只要一个人，一点前得到。`,
    choices: [
      { id: 'go', label: '让一个人十点到一点之间去站前街', spawn: () => ({ templateId: 'station_hands_spot', district: 'station', window: { from: 10, to: 13 } }) },
      { id: 'skip', label: '不去' },
    ] },
  { id: 'wallet_found', minDay: 6, cooldownDays: 14, weight: 0.8,
    title: '路边捡到一个钱包', text: `${WALLET}块现金，一张公交卡，一张写着电话的纸条。`,
    choices: [
      { id: 'keep', label: `钱留下，卡和纸条扔了（现金+${WALLET}）`, effect: (s, ev) => { s.cash += WALLET; s.ledger.income += WALLET; mindAll(s, -2); ev.push('钱进了饭钱。没人说话，全员精神-2。'); } },
      { id: 'return', label: '照纸条上的电话还回去', effect: (s, ev) => {
        trustUp(s, 'reg_chen', 1); mindAll(s, 3);
        if (rng(s.seed, 'wallet:' + s.day) < 0.4) { s.cash += 10; s.ledger.income += 10; ev.push('失主是站前送水的，塞了10块茶水钱，说以后有活找你们。老陈也听说了：信任+1，全员精神+3。'); }
        else ev.push('失主接过钱包，说了三声谢谢。老陈在旁边看着：信任+1，全员精神+3。');
      } },
    ] },
  // 下面十二件的共同点：每件都有真代价。同一窗口两个热点只认一个人时，去了一边另一边必然错过。
  { id: 'ma_two_bosses', minDay: 8, cooldownDays: 8, cond: (s) => s.actors.ma.life === 'active',
    title: '两头都在找马哥', text: `老陈说站前两点有车要卸，现结${TRUCK_PAY}，只要马哥；鲁叔也让人捎话，仓库下午要人码货，不给钱，给料。都是两点到五点。`,
    choices: [
      { id: 'both', label: '都记下，到时候看马哥去哪', spawn: () => [
        { templateId: 'chen_truck_spot', district: 'station', window: { from: 14, to: 17 }, cast: ['ma'] },
        { templateId: 'lu_stack_spot', district: 'recycle', window: { from: 14, to: 17 }, cast: ['ma'] },
      ] },
      { id: 'skip', label: '两头都回了，马哥今天有别的事', effect: (s, ev) => { trustUp(s, 'reg_lu', -1); ev.push('老陈找了别人。鲁叔记着这事：信任-1。'); } },
    ] },
  { id: 'station_cigs', minDay: 7, cooldownDays: 12, weight: 0.8, cond: (s) => s.actors.ma.life === 'active',
    title: '站前有人卸烟', text: `站前有人从面包车上往下搬整箱的烟，一条只要${CIG_BUY}，小酒馆收${CIG_SELL}。老陈路过，冲马哥摇了摇头。`,
    choices: [
      { id: 'listen', label: '听老陈的，不碰', effect: (s, ev) => { trustUp(s, 'reg_chen', 1); ev.push('马哥盯着那辆车看了半天，没动。老陈信任+1。'); } },
      { id: 'buy', label: `让马哥拿一条去小酒馆转手（现金-${CIG_BUY}）`, requires: needCash(CIG_BUY), effect: (s, ev) => {
        s.cash -= CIG_BUY; s.ledger.expense += CIG_BUY;
        if (rng(s.seed, 'cigs:' + s.day) < 0.6) { s.cash += CIG_SELL; s.ledger.income += CIG_SELL; s.actors.ma.mind = clamp(s.actors.ma.mind + 4); ev.push(`酒馆老板数了数，给了${CIG_SELL}。净赚${CIG_SELL - CIG_BUY}，马哥精神+4。`); }
        else { s.actors.ma.mind = clamp(s.actors.ma.mind - 6); trustUp(s, 'reg_chen', -1); ev.push(`酒馆老板一闻就扔了回来：假的。${CIG_BUY}块打了水漂，马哥精神-6，老陈信任-1。`); }
      } },
    ] },
  { id: 'xuan_two_repairs', minDay: 8, cooldownDays: 8, cond: (s) => s.actors.xuan.life === 'active',
    title: '两家都等轩哥修', text: (s) => `刘姐的电饼铛不热了，修好给${GRIDDLE_PAY}；许姐工作间的投影仪也罢工了，她没提钱。两边都要一块零件，都得十点到一点之间过去。零件${s.parts}。`,
    choices: [
      { id: 'both', label: '都记下，看轩哥去哪', spawn: () => [
        { templateId: 'liu_griddle_spot', district: 'market', window: { from: 10, to: 13 }, cast: ['xuan'] },
        { templateId: 'xu_projector_spot', district: 'cinema', window: { from: 10, to: 13 }, cast: ['xuan'] },
      ] },
      { id: 'skip', label: '今天不修，让她们找别人', effect: (s, ev) => { trustUp(s, 'reg_xu', -1); ev.push('刘姐找了修电器的。许姐那边没人回话：信任-1。'); } },
    ] },
  { id: 'xuan_shoes', minDay: 6, cooldownDays: 15, weight: 0.8, cond: (s) => s.actors.xuan.life === 'active',
    title: '轩哥的皮鞋开胶了', text: '轩哥那双黑皮鞋左脚的底张了嘴，走一步吧嗒一下。他说没事，然后一脚踩进了水洼。',
    choices: [
      { id: 'tape', label: '用胶带缠上（用1格胶带）', requires: (s) => (s.items.some((x) => x.itemId === 'tape') ? null : '没有胶带'), effect: (s, ev) => { spend(s, (x) => x.itemId === 'tape'); s.actors.xuan.mind = clamp(s.actors.xuan.mind - 1); ev.push('鞋缠了两圈胶带，走路不响了，就是难看。轩哥精神-1。'); } },
      { id: 'shop', label: `去老街修鞋摊粘一下（现金-${COBBLER}）`, requires: needCash(COBBLER), effect: (s, ev) => { s.cash -= COBBLER; s.ledger.expense += COBBLER; s.actors.xuan.mind = clamp(s.actors.xuan.mind + 2); ev.push(`修鞋摊上了胶又钉了两颗钉，${COBBLER}块。轩哥说这双鞋还能穿到明年：精神+2。`); } },
      { id: 'endure', label: '先这么趿拉着', effect: (s, ev) => { s.actors.xuan.mind = clamp(s.actors.xuan.mind - 5); s.actors.xuan.health = clamp(s.actors.xuan.health - 4); ev.push('轩哥趿拉着开胶的鞋走了一天，脚泡得发白。精神-5，健康-4。'); } },
    ] },
  { id: 'fan_camera_lend', minDay: 7, cooldownDays: 12, cond: (s) => s.actors.fan.life === 'active' && Boolean(cameraOf(s)) && !s.flags.lentCamera,
    title: '小赵想借相机', text: '小赵一早跑到桥下：学校要交短片作业，想借凡哥的相机用一天，晚上六点到九点在旧影院还。他攥着书包带等你们说话。',
    choices: [
      { id: 'lend', label: '借他，晚上让凡哥去旧影院取（今天没相机用）', requires: (s) => (cameraOf(s) ? null : '没有相机可借'),
        effect: (s, ev) => { const cam = cameraOf(s); s.flags.lentCamera = cam.itemId; s.items = s.items.filter((x) => x.uid !== cam.uid); trustUp(s, 'reg_zhao', 1); ev.push('相机进了小赵的书包。今天拍摄和采访都干不了。小赵信任+1。'); },
        spawn: () => ({ templateId: 'camera_back_spot', district: 'cinema', window: { from: 18, to: 21 }, cast: ['fan'] }) },
      { id: 'refuse', label: '不借，那是吃饭的家伙', effect: (s, ev) => { trustUp(s, 'reg_zhao', -1); s.actors.fan.mind = clamp(s.actors.fan.mind - 2); ev.push('小赵“哦”了一声走了。小赵信任-1，凡哥精神-2。'); } },
    ] },
  { id: 'fan_wall_erased', minDay: 8, cooldownDays: 10, cond: (s) => s.actors.fan.life === 'active' && s.art > 0,
    title: '墙被刷白了', text: '凡哥画的那面墙昨夜被物业刷成了白的。小赵发来一张照片，一个字都没配。',
    choices: [
      { id: 'repaint', label: '下午两点到五点带颜料去重画', spawn: () => ({ templateId: 'repaint_spot', district: 'cinema', window: { from: 14, to: 17 }, cast: ['fan'] }) },
      { id: 'let_go', label: '算了，墙本来也不是我们的', effect: (s, ev) => { s.art = Math.max(0, s.art - 1); s.actors.fan.mind = clamp(s.actors.fan.mind - 6); ev.push('少了一件作品。凡哥一上午没说话：精神-6。'); } },
    ] },
  { id: 'lu_flood', minDay: 5, cooldownDays: 6, weight: 1.2, cond: wet,
    title: '鲁叔的仓库进水了', text: '雨下了一夜，鲁叔的仓库进了水。他让人捎话：十点前来把地上的货搬上架，不给钱，泡了的木板布头随便拿。',
    choices: [
      { id: 'go', label: '答应了，十点前派人去回收巷', spawn: () => ({ templateId: 'lu_flood_spot', district: 'recycle', window: { from: 6, to: 10 } }) },
      { id: 'skip', label: '雨太大，不去' },
    ] },
  { id: 'storm_camp', minDay: 5, cooldownDays: 7, cond: (s) => wet(s) && s.camp.rain < 3,
    title: '棚子撑不住了', text: (s) => `雨还在下。棚顶东边塌了一块，水顺着柱子往下流。防雨${s.camp.rain}/3，木料${s.wood}、布料${s.cloth}。`,
    choices: [
      { id: 'patch', label: '现在就补（木料-2、布料-2，防雨+1，全员体力-12）', requires: (s) => (s.wood >= 2 && s.cloth >= 2 ? null : '木料和布料各要2'), effect: (s, ev) => { s.wood -= 2; s.cloth -= 2; s.camp.rain = clamp(s.camp.rain + 1, 0, 3); for (const id of alive(s)) s.actors[id].energy = clamp(s.actors[id].energy - 12); ev.push(`淋着雨把顶补上了：防雨${s.camp.rain}/3，全员体力-12。`); } },
      { id: 'wang', label: '去求王叔开一晚过夜区（王叔信任要到1）', requires: (s) => (relation(s, 'reg_wang').trust >= 1 ? null : '王叔的信任要到1'), effect: (s, ev) => { s.flags.shelterDay = s.day; ev.push('王叔答应了：今晚全员去服务站过夜。挤，但干。'); } },
      { id: 'ignore', label: '让它漏', effect: (s, ev) => { s.camp.rain = clamp(s.camp.rain - 1, 0, 3); for (const id of alive(s)) s.actors[id].warmth = clamp(s.actors[id].warmth - 10); mindAll(s, -2); ev.push(`顶又塌了一块。防雨降到${s.camp.rain}/3，全员保暖-10、精神-2。`); } },
    ] },
  { id: 'chen_coworker', minDay: 7, cooldownDays: 14, weight: 0.9,
    title: '老陈的工友摔了', text: (s) => `老陈的工友从货车上摔下来了，站口在凑住院钱。老陈没开口，只把那个装钱的纸箱往你们这边推了推。现金${s.cash}。`,
    choices: [
      { id: 'give20', label: '放进去20', requires: needCash(20), effect: (s, ev) => { s.cash -= 20; s.ledger.expense += 20; trustUp(s, 'reg_chen', 2); mindAll(s, 2); ev.push('老陈没说谢，点了点头。老陈信任+2，全员精神+2。'); } },
      { id: 'give5', label: '放进去5，不好意思多了', requires: needCash(5), effect: (s, ev) => { s.cash -= 5; s.ledger.expense += 5; trustUp(s, 'reg_chen', 1); ev.push('五块也进了纸箱。老陈信任+1。'); } },
      { id: 'none', label: '手头真紧，什么也没放', effect: (s, ev) => { trustUp(s, 'reg_chen', -1); mindAll(s, -2); ev.push('纸箱从面前推了过去。老陈信任-1，全员精神-2。'); } },
    ] },
  { id: 'liu_restock', minDay: 6, cooldownDays: 8, cond: (s) => s.flags.liuClosedDay !== s.day,
    title: '刘姐要人看摊', text: `刘姐今天去批发市场进货，摊子想交给你们看着，十点到一点，回来给${WATCH_PAY}。她说：“摊子要是没人，明天也不用来了。”`,
    choices: [
      { id: 'go', label: '答应了，十点到一点之间去老街', spawn: () => ({ templateId: 'liu_watch_spot', district: 'market', window: { from: 10, to: 13 } }) },
      { id: 'decline', label: '回话说看不了', effect: (s, ev) => { trustUp(s, 'reg_liu', -1); ev.push('刘姐哼了一声：“行。”刘姐信任-1。'); } },
    ] },
  { id: 'newcomer', minDay: 6, cooldownDays: 12, weight: 0.9,
    title: '桥下多了个人', text: '桥墩另一边蜷着个年轻人，二十出头，鞋是湿的。他说就住一晚，明天走。他看了一眼你们的箱子。',
    choices: [
      { id: 'feed', label: '给他一份饭，让他挤一晚', requires: (s) => (s.items.some(campFood) ? null : '营地箱里没吃的'), effect: (s, ev) => {
        const food = s.items.find((x) => campFood(x) && x.itemId === 'bread') || s.items.find(campFood);
        s.items = s.items.filter((x) => x.uid !== food.uid); s.camp.dirt = clamp(s.camp.dirt + 10); mindAll(s, 3);
        if (rng(s.seed, 'newcomer:' + s.day) < 0.5) { s.bottles = (s.bottles || 0) + 6; ev.push('他吃完就睡，天亮前走了，留下半袋瓶罐（+6）。全员精神+3，营地脏污+10。'); }
        else ev.push('他吃完就睡，天亮前走了，什么也没留。全员精神+3，营地脏污+10。');
      } },
      { id: 'chase', label: '让他走，这里不是收容所', effect: (s, ev) => { mindAll(s, -3); ev.push('他没争，拎着袋子走了。全员精神-3。'); } },
    ] },
  { id: 'wang_host', minDay: 9, cooldownDays: 12, cond: (s) => s.actors.xuan.life === 'active',
    title: '王叔想让轩哥上台', text: '服务站今晚给老人们办联欢，王叔说缺个能说话的，问轩哥敢不敢六点到九点上去讲两段。末了补了一句：“收拾干净点来。”',
    choices: [
      { id: 'go', label: '答应了，晚上让轩哥去服务站（卫生要到40）', spawn: () => ({ templateId: 'wang_host_spot', district: 'service', window: { from: 18, to: 21 }, cast: ['xuan'] }) },
      { id: 'decline', label: '轩哥说他不行', effect: (s, ev) => { s.actors.xuan.mind = clamp(s.actors.xuan.mind - 2); ev.push('轩哥说“我不行”，然后一上午都在心里过那两段。精神-2。'); } },
    ] },
];

// 定时热点的效果包。kind 与普通热点相同：present=结算时执行者须在该街区，book=占用本小时，instant=选即生效。
// miss(state, ev, events) 在窗口关了还没处理时执行一次。
export const TIMED_PACKS = {
  zhou_double_spot: { timed: true, title: '老周的双价牌子', setup: '老周敲着秤盘：“趁上午，两块一个，过点就不认。”', choices: [
    { id: 'sell', label: '把手里的瓶罐全卖了（两块一个）', kind: 'present', requires: (s) => ((s.bottles || 0) > 0 ? null : '手里没有瓶罐'), effect: (s, ev, a, ev2) => { const n = s.bottles || 0; const cash = n * 2; s.bottles = 0; s.cash += cash; s.ledger.income += cash; ev2.push(`${s.names[a]}把${n}个瓶罐卖给老周，双价收了${cash}块。`); } },
    { id: 'pass', label: '不卖了', kind: 'instant' },
  ] },
  liu_short_spot: { timed: true, title: '刘姐的早市摊', setup: '刘姐围裙都没系好：“来了就行，先把碗洗了。”', choices: [
    { id: 'help', label: '搭把手（得两份饭，刘姐信任+1）', kind: 'present', effect: (s, ev, a, ev2) => { makeItem(s, 'meal', a); makeItem(s, 'meal', 'camp'); trustUp(s, 'reg_liu', 1); ev2.push(`${s.names[a]}在早市帮了一阵：一份饭带着，一份送回营地箱，刘姐信任+1。`); } },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_liu', -1); s.flags.liuClosedDay = s.day + 1; events.push('答应了刘姐却没去。她明天不让你们帮厨了，刘姐信任-1。'); } },
  fork_shoot_spot: { timed: true, cast: ['fan'], title: '鞋店的短视频', setup: '店主把两双新鞋摆到门口：“拍好看点，发到网上去。”', choices: [
    { id: 'take', label: `接下（收入${FORK_PAY}，占本小时）`, kind: 'book', action: 'oddjob', pay: FORK_PAY },
    { id: 'pass', label: '不拍了', kind: 'instant' },
  ] },
  fork_screening_spot: { timed: true, cast: ['fan'], title: '许姐的放片场', setup: '工作间拉了窗帘，七八个人坐着等。许姐朝门口抬了抬下巴。', choices: [
    { id: 'talk', label: '到场讲两句（精神+6，许姐信任+1）', kind: 'present', effect: (s, ev, a, ev2) => { s.actors.fan.mind = clamp(s.actors.fan.mind + 6); trustUp(s, 'reg_xu', 1); fulfillWish(s, 'fan', 'fan_seen', 'partial', ev2); ev2.push('凡哥在放片场讲了两句，有人认真在听：精神+6，许姐信任+1。'); } },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_xu', -1); events.push('许姐等到散场也没见到凡哥。许姐信任-1。'); } },
  sick_mate_spot: { timed: true, title: '桥下有人没起来', setup: '火堆边只剩一个人影。', choices: [
    { id: 'sit', label: '坐过去说说话（两人精神+6）', kind: 'present', effect: (s, ev, a, ev2) => { const t = ev.target; for (const id of [a, t]) if (s.actors[id]?.life === 'active') s.actors[id].mind = clamp(s.actors[id].mind + 6); if (t) fulfillWish(s, t, 'xuan_understood', 'partial', ev2); ev2.push(`${s.names[a]}陪${s.names[t] || '他'}坐了一小时：两人精神+6。`); } },
  ], miss: (s, ev, events) => { const t = ev.target; if (t && s.actors[t]?.life === 'active') { s.actors[t].mind = clamp(s.actors[t].mind - 6); events.push(`${s.names[t]}一整天没人搭理。精神-6。`); } } },
  station_hands_spot: { timed: true, title: '站前的货车', setup: '司机把车厢门一拉：“一个人，卸完给钱。”', choices: [
    { id: 'take', label: `卸货（收入${HANDS_PAY}，占本小时）`, kind: 'book', action: 'oddjob', pay: HANDS_PAY },
    { id: 'pass', label: '不接', kind: 'instant' },
  ] },
  // 下面这些是答应了人的事，所以不给「不去了」的即时选项：要么去，要么等窗口关了吃 miss。
  chen_truck_spot: { timed: true, cast: ['ma'], title: '老陈的卸货车', setup: '老陈把手套扔过来：“一个人的活，卸完给钱。”', choices: [
    { id: 'take', label: `卸车（收入${TRUCK_PAY}，占本小时）`, kind: 'book', action: 'oddjob', pay: TRUCK_PAY },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_chen', -1); events.push('老陈自己把车卸完了。老陈信任-1。'); } },
  lu_stack_spot: { timed: true, cast: ['ma'], title: '鲁叔的仓库', setup: '鲁叔指了指一排空货架：“码整齐。木板布头你自己挑。”', choices: [
    { id: 'stack', label: '码货（木料+3、布料+2，鲁叔信任+1）', kind: 'present', effect: (s, ev, a, ev2) => { s.wood += 3; s.cloth += 2; trustUp(s, 'reg_lu', 1); fulfillWish(s, a, 'ma_reliable', 'partial', ev2); ev2.push('马哥在仓库码了一小时货：木料+3、布料+2，鲁叔信任+1。'); } },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_lu', -1); events.push('鲁叔等到五点没见人。鲁叔信任-1。'); } },
  liu_griddle_spot: { timed: true, cast: ['xuan'], title: '刘姐的电饼铛', setup: '刘姐把插头拔了又插：“你看看，就是不热。”', choices: [
    { id: 'fix', label: `修（零件-1，收入${GRIDDLE_PAY}，占本小时）`, kind: 'book', action: 'oddjob', pay: GRIDDLE_PAY, cost: { parts: 1 }, requires: needParts },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_liu', -1); events.push('刘姐等到中午，找了修电器的。刘姐信任-1。'); } },
  xu_projector_spot: { timed: true, cast: ['xuan'], title: '许姐的投影仪', setup: '许姐没提钱，只把工具箱推了过来。', choices: [
    { id: 'fix', label: '修好它（零件-1，许姐信任+2，凡哥的东西有机会被放）', kind: 'present', requires: needParts, effect: (s, ev, a, ev2) => { s.parts -= 1; trustUp(s, 'reg_xu', 2); s.actors.xuan.mind = clamp(s.actors.xuan.mind + 3); if (s.actors.fan.life === 'active') fulfillWish(s, 'fan', 'fan_seen', 'partial', ev2); ev2.push('投影仪亮了。许姐说下回放片先放凡哥的：许姐信任+2，轩哥精神+3。'); } },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_xu', -1); events.push('许姐等到一点，把投影仪搬去了修理店。许姐信任-1。'); } },
  camera_back_spot: { timed: true, cast: ['fan'], title: '小赵还相机', setup: '小赵在旧影院门口等着，相机挂在脖子上，屏幕里是他剪好的片子。', choices: [
    { id: 'take', label: '取回相机，看看他拍了什么（电量-1，凡哥精神+6，小赵信任+1）', kind: 'present', effect: (s, ev, a, ev2) => { makeItem(s, s.flags.lentCamera || 'old_camera', 'fan'); s.flags.lentCamera = null; s.battery = Math.max(0, s.battery - 1); s.actors.fan.mind = clamp(s.actors.fan.mind + 6); trustUp(s, 'reg_zhao', 1); fulfillWish(s, 'fan', 'fan_seen', 'partial', ev2); ev2.push('片子结尾是凡哥的那面墙。相机回来了，电量-1；凡哥精神+6，小赵信任+1。'); } },
  ], miss: (s, ev, events) => { makeItem(s, s.flags.lentCamera || 'old_camera', 'camp'); s.flags.lentCamera = null; s.battery = 0; trustUp(s, 'reg_zhao', -1); s.actors.fan.mind = clamp(s.actors.fan.mind - 3); events.push('小赵等到九点没人来，把相机送到桥下塞进了箱子。电用光了（电量归零），小赵信任-1，凡哥精神-3。'); } },
  repaint_spot: { timed: true, cast: ['fan'], title: '白墙', setup: '墙白得发亮。小赵蹲在边上，把颜料盖一个个拧开。', choices: [
    { id: 'paint', label: '重画（用1格颜料，凡哥精神+8，小赵信任+1）', kind: 'present', requires: (s, a) => (s.items.some((x) => x.itemId === 'paint' && x.container === a) ? null : '凡哥身上没有颜料'), effect: (s, ev, a, ev2) => { spend(s, (x) => x.itemId === 'paint' && x.container === a); s.actors.fan.mind = clamp(s.actors.fan.mind + 8); trustUp(s, 'reg_zhao', 1); fulfillWish(s, 'fan', 'fan_paint', 'partial', ev2); ev2.push('新画的比原来那幅大。凡哥精神+8，小赵信任+1。'); } },
  ], miss: (s, ev, events) => { s.art = Math.max(0, s.art - 1); s.actors.fan.mind = clamp(s.actors.fan.mind - 4); events.push('白墙晾了一天，物业又贴了张“禁止涂鸦”。作品-1，凡哥精神-4。'); } },
  lu_flood_spot: { timed: true, title: '进水的仓库', setup: '鲁叔卷着裤腿在水里趟：“先搬那边的。”', choices: [
    { id: 'haul', label: '搬货上架（木料+3、布料+2，鲁叔信任+1，卫生-8）', kind: 'present', effect: (s, ev, a, ev2) => { s.wood += 3; s.cloth += 2; trustUp(s, 'reg_lu', 1); s.actors[a].hygiene = clamp(s.actors[a].hygiene - 8); ev2.push(`${s.names[a]}趟着水搬了一小时：木料+3、布料+2，鲁叔信任+1，卫生-8。`); } },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_lu', -1); events.push('答应了鲁叔却没去。他一个人搬到中午：信任-1。'); } },
  liu_watch_spot: { timed: true, title: '刘姐的摊子', setup: '刘姐把围裙塞过来：“价钱都在牌子上，别多收。”', choices: [
    { id: 'watch', label: `看摊（收入${WATCH_PAY}，占本小时）`, kind: 'book', action: 'oddjob', pay: WATCH_PAY },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_liu', -1); s.flags.liuClosedDay = s.day + 1; events.push('刘姐回来摊子空着，少了一筐鸡蛋。明天不让你们帮厨了，刘姐信任-1。'); } },
  wang_host_spot: { timed: true, cast: ['xuan'], title: '服务站的联欢', setup: '折叠椅摆了三排。王叔在门口看表。', choices: [
    { id: 'host', label: '上台讲两段（轩哥精神+8，王叔信任+2，全员精神+2）', kind: 'present', requires: (s) => (s.actors.xuan.hygiene >= 40 ? null : '王叔拦在门口：先洗干净（卫生到40）'), effect: (s, ev, a, ev2) => { s.actors.xuan.mind = clamp(s.actors.xuan.mind + 8); trustUp(s, 'reg_wang', 2); mindAll(s, 2); fulfillWish(s, 'xuan', 'xuan_understood', 'partial', ev2); ev2.push('第二段冷了场，第三段有人笑了。轩哥精神+8，王叔信任+2，全员精神+2。'); } },
  ], miss: (s, ev, events) => { trustUp(s, 'reg_wang', -1); s.actors.xuan.mind = clamp(s.actors.xuan.mind - 3); events.push('王叔等到开场，找了个志愿者顶上。王叔信任-1，轩哥精神-3。'); } },
};

const template = (id, name, district) => ({ id, name, category: 'headline', districtIds: [district], openSlots: [0, 1, 2, 3], effectPolicy: '今日事的定时热点', constraint: '只由今日事生成，导演不刷', defaultExpiresAfterTurns: 8, requiresActivePresentActor: true, aiMode: 'text_or_bounded_assembly', forbiddenAiFields: [], repeatCooldownDays: 0, timed: true });
export const TIMED_TEMPLATES = [
  template('zhou_double_spot', '老周的双价牌子', 'recycle'),
  template('liu_short_spot', '刘姐的早市摊', 'market'),
  template('fork_shoot_spot', '鞋店的短视频', 'market'),
  template('fork_screening_spot', '许姐的放片场', 'cinema'),
  template('sick_mate_spot', '桥下有人没起来', 'camp'),
  template('station_hands_spot', '站前的货车', 'station'),
  template('chen_truck_spot', '老陈的卸货车', 'station'),
  template('lu_stack_spot', '鲁叔的仓库', 'recycle'),
  template('liu_griddle_spot', '刘姐的电饼铛', 'market'),
  template('xu_projector_spot', '许姐的投影仪', 'cinema'),
  template('camera_back_spot', '小赵还相机', 'cinema'),
  template('repaint_spot', '白墙', 'cinema'),
  template('lu_flood_spot', '进水的仓库', 'recycle'),
  template('liu_watch_spot', '刘姐的摊子', 'market'),
  template('wang_host_spot', '服务站的联欢', 'service'),
];
