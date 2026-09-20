// 主行动表。zone 是执行地点（街区 id），一格只能在一个地方。
// 数值来自 v2 原型与策划 01 §11/§16；work=计入岗位与声望，dirty=脏污暴露，indoor=不受天气。

const act = (id, name, zone, energy, extra = {}) => ({ id, name, zone, energy, hours: 1, who: 'any', ...extra });

export const ACTIONS = {
  // 工作
  scavenge: act('scavenge', '分类回收', 'recycle', 14, { cash: 5, gain: { parts: 1, wood: 1 }, hygiene: -8, mind: -1, work: true, dirty: true, limit: 2, skill: 'scav', note: '收入5，零件+1、木料+1，卫生-8、精神-1。每天最多2个岗位。' }),
  kitchen: act('kitchen', '早餐帮厨', 'market', 16, { cash: 6, foodGain: 1, mind: -1, work: true, allowed: [0], limit: 1, note: '收入6、得1份正餐（进营地箱）。仅清晨，全队每天1个岗位。' }),
  beg: act('beg', '路边乞讨', 'pick', 8, { begging: true, limit: 3, skill: 'beg', note: '选一个街区，最多向3位路人求助。同一路人全队每天只问一次。' }),
  bottles: act('bottles', '捡瓶罐', 'pick', 8, { bottles: true, hygiene: -4, limit: 3, skill: 'scav', note: '沿街捡饮料瓶和易拉罐（2—5个），到老周回收铺按1元/个卖。卫生-4，不占岗位。' }),
  fish: act('fish', '河岸钓鱼', 'river', 20, { fishing: true, limit: 4, note: '河岸一小时，消耗1份鱼饵与20体力；当前操控角色咬钩后完成收线 QTE，队友自动收线，熟练度、鱼竿和天气影响咬钩。' }),
  cook: act('cook', '篝火加工', 'camp', 20, { cooking: true, note: '在营地用1份木炭加工1份生鱼或加热1份食物；从自己包或营地箱选原料。' }),
  soup: act('soup', '服务站免费餐', 'service', 4, { freeMeal: true, allowed: [0, 3], limit: 2, mind: -1, indoor: true, note: '排队领一份免费餐进自己包（全队每天2份），排队有点磨人：精神-1。' }),
  bins: act('bins', '翻垃圾桶', 'pick', 12, { bins: true, hygiene: -10, work: true, dirty: true, limit: 2, skill: 'scav', note: '市场/站前/回收巷可翻。可能翻到食物（不洁）、零件、布料，也可能空手。卫生-10。' }),
  repair: act('repair', '基础维修', 'recycle', 18, { who: 'xuan', cash: 13, cost: { parts: 1 }, mind: -1, work: true, indoor: true, limit: 2, note: '收入13，零件-1、精神-1；店里提供工具。每天2单。' }),
  table: act('table', '整理商户数据', 'recycle', 16, { who: 'xuan', cash: 14, mind: -2, work: true, complex: true, equip: ['computer'], indoor: true, limit: 1, note: '收入14、精神-2，使用唯一电脑；精神低于20不可接。每天1单。' }),
  shoot: act('shoot', '商户宣传拍摄', 'market', 16, { who: 'fan', cash: 15, cost: { battery: 1 }, mind: -1, work: true, equip: ['camera'], limit: 1, note: '收入15，电量-1，使用相机。每天1单。' }),
  interview: act('interview', '许可采访', 'cinema', 12, { who: 'fan', mind: 4, footage: 1, equip: ['camera'], cost: { battery: 1 }, limit: 1, note: '精神+4、许可素材+1，不直接挣钱。' }),
  edit: act('edit', '剪辑小委托', 'cinema', 16, { who: 'fan', cash: 13, mind: -2, complex: true, work: true, equip: ['computer'], indoor: true, limit: 1, note: '收入13、精神-2；占唯一电脑。' }),
  run: act('run', '街头跑腿', 'station', 18, { who: 'ma', cash: 9, mind: -1, work: true, limit: 2, skill: 'run', note: '收入9、精神-1。稳定劳动也能养活马哥。每天最多2次。' }),
  carry: act('carry', '搬运短工', 'market', 24, { cash: 11, mind: -2, work: true, dirty: true, limit: 2, note: '收入11、精神-2；所有常规行动统一消耗20体力。每天2个岗位。' }),
  coop: act('coop', '轩凡联合商户单', 'market', 20, { fixed: ['xuan', 'fan'], cash: 33, mind: -1, cost: { parts: 1, battery: 1 }, equip: ['computer', 'camera'], work: true, limit: 1, note: '轩哥+凡哥；团队收入33只算一次，零件1、电量1。' }),
  trio: act('trio', '三人布场委托', 'cinema', 16, { min: 3, cash: 44, mind: -1, cost: { cash: 4 }, work: true, limit: 1, note: '三人同槽，返还收入44、支出4。' }),
  danger: act('danger', '危棚翻找【危险】', 'recycle', 20, { cash: 12, mind: -2, gain: { wood: 2 }, risky: true, work: true, dirty: true, injury: [16, 32], wound: true, limit: 1, note: '确定受到16—32事故伤害并留下伤口，可能濒死！马哥事故减伤25%。' }),
  // 生活维护
  rest: act('rest', '回营休息', 'camp', 0, { energyGain: 20, mind: 3, warm: 6, heal: 4, rest: true, note: '体力+20、精神+3、保暖+6、健康+4；不是濒死抢救。' }),
  sleep: act('sleep', '睡眠', 'camp', 0, { energyGain: 20, rest: true, note: '睡眠1小时，体力+20。' }),
  warm: act('warm', '服务站休整', 'service', 0, { energyGain: 20, mind: 3, warm: 30, hygiene: 15, rest: true, indoor: true, battery: 1, note: '免费：体力+20、精神+3、保暖+30、卫生+15，顺便充一格电。' }),
  wash: act('wash', '公共水点洗漱', 'service', 4, { hygiene: 15, mind: 2, warm: 10, wash: true, indoor: true, note: '免费：卫生+15、精神+2。带肥皂变+25，带毛巾再+5。' }),
  bath: act('bath', '澡堂洗澡洗衣', 'service', 4, { cost: { cash: 10 }, hygiene: 55, mind: 6, warm: 12, laundry: true, shop: 'bathhouse', indoor: true, note: '花10：卫生+55，衣物洗净（晾一晚才干）。' }),
  laundry: act('laundry', '营地洗衣', 'camp', 6, { laundry: true, needs: 'detergent', hygiene: 5, note: '消耗1格洗衣粉；衣物洗净但当天是湿的。' }),
  campclean: act('campclean', '营地整理', 'camp', 8, { campClean: 40, mind: 3, note: '公共空间清洁-40脏污；有垃圾袋再-20。' }),
  shop: act('shop', '到店采买', 'pick', 6, { shopping: true, note: '前往店铺所在街区并按清单购买，可顺带同街区第二家店。' }),
  clinic: act('clinic', '诊所评估', 'service', 6, { cost: { cash: 18 }, clinic: true, indoor: true, shop: 'clinic', note: '花18：确定病种并建立治疗计划，之后计划用品才能生效。' }),
  talk: act('talk', '同伴长谈', 'camp', 0, { min: 2, mind: 8, talk: true, limit: 1, rest: true, note: '两人同槽在营地长谈：各精神+8，能解开危机，回应“想被认真听”。每天1次。' }),
  joke: act('joke', '整理设备与烂梗', 'camp', 0, { who: 'xuan', mind: 8, battery: 1, rest: true, note: '免费：精神+8，顺手充一格电；不恢复体力。' }),
  sketch: act('sketch', '纸板速写', 'camp', 0, { who: 'fan', mind: 8, rest: true, wishPartial: 'fan_paint', note: '免费：精神+8；颜料愿望部分缓解，不恢复体力。' }),
  freecards: act('freecards', '无赌注纸牌', 'camp', 0, { mind: 8, rest: true, wishPartial: 'ma_cards', note: '免费：精神+8；马哥牌桌愿望部分缓解，不产生赌资，也不恢复体力。' }),
  graffiti: act('graffiti', '许可墙面涂鸦', 'cinema', 8, { who: 'fan', needs: 'paint', mind: 14, art: 1, limit: 1, wishExact: 'fan_paint', note: '消耗1格颜料：精神+14、作品+1，颜料愿望完全满足。' }),
  social: act('social', '夜市友好搭话', 'market', 8, { cost: { cash: 4 }, mind: 8, leisure: true, allowed: [2, 3], wishPartial: 'adult_connection', note: '与成年NPC聊天，精神+8。消费不是亲密关系的兑换券。' }),
  tavern: act('tavern', '小酒馆坐坐', 'station', 6, { cost: { cash: 6 }, mind: 6, intox: 1, leisure: true, allowed: [2, 3], shop: 'tavern', wishExact: 'evening_drink', wishPartial: 'adult_connection', note: '花6喝一杯：精神+6、醉意+1。熟客有时会给委托。' }),
  casino: act('casino', '去棋牌馆', 'cardhall', 20, { casinoVisit: true, leisure: true, indoor: true, allowed: [2, 3], latestStartHour: 20, cost: { cash: 0 }, note: '营业14—22点；最晚20点入馆，独自入馆不收费，可选二十一点、炸金花或德州扑克后再决定是否买入。' }),
  roof: act('roof', '两人共同修棚', 'camp', 12, { min: 2, cost: { cash: 12, wood: 2, cloth: 2 }, camp: 1, note: '任选两人；共同成本12、木2、布2，防雨+1，最多3级。' }),
  helper: act('helper', '雇工帮助修棚', 'camp', 14, { cost: { cash: 36, wood: 2, cloth: 2 }, camp: 1, note: '一个人也能施工；共同成本36、木2、布2。' }),
  rescue: act('rescue', '陪同送援', 'service', 10, { rescue: true, min: 2, cost: { cash: 12 }, note: '选择一名濒死者，双方占同槽。支出12，目标恢复健康25。' }),
  aid: act('aid', '联系救助', 'service', 0, { downedOnly: true, aid: true, note: '濒死者可自行预约：首张救助券免费，之后每次20。' }),
  wait: act('wait', '濒死等待', 'camp', 0, { downedOnly: true, note: '不施救会继续消耗救援窗口；到期永久死亡。' }),
  // 卖艺与手艺（各有冷却，防刷）
  phonestall: act('phonestall', '摆摊修手机', 'market', 12, { who: 'xuan', busking: 'phone', mind: 1, limit: 1, cooldownDays: 2, note: '市场口支个小摊帮人清后台、换贴膜：收入4—7随机，隔天一次。' }),
  shellgame: act('shellgame', '猜球小摊', 'station', 10, { who: 'ma', busking: 'shell', limit: 1, cooldownDays: 2, note: '站口摆三只杯子猜球：收入3—10随机，20%被城管赶走（精神-3，当次白干）。隔天一次。' }),
  repair_item: act('repair_item', '修旧电器', 'pick', 10, { who: 'xuan', repairing: true, mind: 2, note: '修一件坏手机/坏收音机/坏耳机（各1零件），坏电视要营地修理桌+2零件。修好后决定卖、留、送。' }),
  facility: act('facility', '营地施工', 'camp', 10, { building: true, note: '给营地装一个功能位（修理桌/作品展架/晾晒架），占一格；材料见营地面板。' }),
  // 事件专用（由热点预约，不出现在普通列表）
  cards: act('cards', '付费牌局', 'station', 8, { cost: { cash: 10 }, gamble: true, leisure: true, eventOnly: true, wishExact: 'ma_cards', note: '入场10；马哥55%胜、15%平、30%负；返还20/10/0（含本金）。全队每日付费博彩2次。' }),
  observe: act('observe', '围观牌局', 'station', 4, { mind: 3, eventOnly: true, wishPartial: 'ma_cards', note: '不下注，看两把、聊两句。' }),
  oddjob: act('oddjob', '临时短工', 'pick', 16, { cash: 13, mind: -1, work: true, eventOnly: true, note: '路人或告示给的一次性活。' }),
};

export const OUT_ZONES = ['market', 'recycle', 'station', 'cinema', 'service', 'cafe', 'furniture'];
export const REPAIR_ZONES = ['camp', 'recycle'];
export const BEG_ZONES = ['market', 'station', 'cinema', 'service'];
export const BINS_ZONES = ['market', 'station', 'recycle'];

export function actionList() {
  return Object.values(ACTIONS).filter((a) => !a.eventOnly);
}

const REPEATABLE = new Set(['scavenge', 'beg', 'bottles', 'fish', 'soup', 'bins', 'repair', 'run', 'carry', 'rest', 'sleep', 'warm', 'wash', 'joke', 'sketch', 'freecards']);
const DEFAULT_DURATION = { scavenge: 2, bottles: 2, fish: 2, repair: 2, run: 2, carry: 2, rest: 2, sleep: 2, warm: 2 };

export function actionDuration(actionId) {
  const action = Object.hasOwn(ACTIONS, actionId) ? ACTIONS[actionId] : null;
  if (!action) return null;
  const max = REPEATABLE.has(actionId) ? Math.min(action.limit || Infinity, actionId === 'sleep' ? 8 : 4) : 1;
  const defaultHours = DEFAULT_DURATION[actionId] || 1;
  return { defaultHours, default: defaultHours, options: Array.from({ length: max }, (_, i) => i + 1) };
}
