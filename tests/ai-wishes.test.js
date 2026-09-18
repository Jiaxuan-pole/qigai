import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, buyNow, useItem, transferItem } from '../public/game/engine.js';
import { generateMorningWishes, activeWishes, makeWishContext, applyWishSuggestions, templateOf } from '../public/game/wishes.js';
import { makeItem } from '../public/game/items.js';
import { localWishSuggestions } from '../public/game/item-wishes.js';
import { validateSave } from '../public/game/save.js';
import { wishPressure } from '../public/game/rules.js';
import { getData } from '../public/game/data.js';
import { maybeGenerateItemWishes } from '../public/ui/wishes-ai.js';
import { checkWishContext, validateWishPayload } from '../server/wishes-ai.js';

await loadData();

test('基础烟酒同在，关闭后有冷却，死者不生成', () => {
  const s = fresh(33); const ev = [];
  generateMorningWishes(s, ev);
  assert.deepEqual(activeWishes(s, 'xuan').map(w => w.templateId).sort(), ['evening_drink', 'quiet_smoke']);
  const smoke = activeWishes(s, 'xuan').find(w => w.templateId === 'quiet_smoke');
  smoke.status = 'fulfilled'; smoke.closedDay = s.day;
  generateMorningWishes(s, ev);
  assert.equal(activeWishes(s, 'xuan').filter(w => w.templateId === 'quiet_smoke').length, 0);
  s.day += 2; generateMorningWishes(s, ev);
  assert.equal(activeWishes(s, 'xuan').filter(w => w.templateId === 'quiet_smoke').length, 1);
  s.actors.fan.life = 'dead'; s.wishes = s.wishes.filter(w => w.actor !== 'fan');
  generateMorningWishes(s, ev);
  assert.equal(activeWishes(s, 'fan').length, 0);
});

test('AI 物品白名单校验、单格、存档与可达设备交接', () => {
  let s = fresh(34); generateMorningWishes(s, []);
  const c = makeWishContext(s);
  assert.equal(c.actors.length, 2);
  assert.equal(c.actors[0].candidates.some(x => x.itemId === 'not_real'), false);
  const badPayload=localWishSuggestions(c,s.seed); badPayload.suggestions[0]={actorId:'xuan',itemId:'not_real',reason:'想要',indirectLine:'给我吧'};
  const bad = applyWishSuggestions(s, c, badPayload);
  assert.equal(bad, null);
  const itemId = c.actors.find(x => x.actorId === 'xuan').candidates.find(x => x.itemId === 'keyboard').itemId;
  const payload=localWishSuggestions(c,s.seed); payload.suggestions[0]={actorId:'xuan',itemId,reason:'修设备时敲键更顺手',indirectLine:'那键盘让我摸摸。'};
  s = applyWishSuggestions(s, c, payload);
  assert.ok(s);
  const w = activeWishes(s,'xuan').find(x => x.targetItem === itemId);
  assert.equal(templateOf(w).targetItemIds[0], itemId);
  assert.equal(validateSave(s).ok, true);
  const item = makeItem(s,itemId,'camp'); s.actors.xuan.location='market';
  let t = transferItem(s,'fan',item.uid,'xuan');
  assert.ok(t.error);
  s.actors.fan.location='camp'; s.actors.xuan.location='camp';
  t = transferItem(s,'fan',item.uid,'xuan');
  assert.equal(t.state.wishes.find(x=>x.uid===w.uid).status,'fulfilled');
});

test('AI 消耗品须实际使用，且同日不重复提案', () => {
  let s=fresh(35); generateMorningWishes(s,[]);
  const c=makeWishContext(s);
  const payload=localWishSuggestions(c,s.seed); payload.suggestions[1]={actorId:'fan',itemId:'tea',reason:'想在画画后喝热的',indirectLine:'有茶就好了。'};
  s=applyWishSuggestions(s,c,payload);
  assert.ok(s);
  assert.equal(makeWishContext(s).actors.some(x=>x.actorId==='fan'),false);
  const item=makeItem(s,'tea','fan');
  assert.equal(activeWishes(s,'fan').some(x=>x.targetItem==='tea'),true);
  s=useItem(s,'fan',item.uid).state;
  assert.equal(activeWishes(s,'fan').some(x=>x.targetItem==='tea'),false);
});

test('实际店铺购买设备回应愿望，消费品购买不回应', () => {
  let s=fresh(36); generateMorningWishes(s,[]);
  const c=makeWishContext(s);
  const payload=localWishSuggestions(c,s.seed); payload.suggestions[0]={actorId:'xuan',itemId:'keyboard',reason:'维修时需要完整键盘',indirectLine:'这几颗键该歇了。'};
  s=applyWishSuggestions(s,c,payload);
  s.actors.xuan.location='recycle'; s.slot=1; s.pendingMorning=null;
  const bought=buyNow(s,'xuan',[{shopId:'recycle_shop',itemId:'keyboard',qty:1}]);
  assert.equal(bought.error,undefined);
  assert.equal(bought.state.wishes.find(w=>w.targetItem==='keyboard').status,'fulfilled');
  assert.equal(bought.state.cash,s.cash-40);
});

test('丢弃旧请求、额外字段和死人；压力仍受总上限', () => {
  let s=fresh(37); generateMorningWishes(s,[]);
  const c=makeWishContext(s);
  const suggestion={actorId:'xuan',itemId:'coffee',reason:'修理后喝口热的',indirectLine:'想喝杯咖啡。'};
  assert.equal(applyWishSuggestions(s,c,{requestId:c.requestId,suggestions:[{...suggestion,cash:999}]}),null);
  assert.equal(applyWishSuggestions({...s,day:2},c,{requestId:c.requestId,suggestions:[suggestion]}),null);
  assert.equal(applyWishSuggestions({...s,actors:{...s.actors,xuan:{...s.actors.xuan,life:'dead'}}},c,{requestId:c.requestId,suggestions:[suggestion]}),null);
  assert.equal(wishPressure([100,100,100],getData().rules),getData().rules.desire.mindLossCapPerActorPerTurn);
});

test('服务端拒绝候选商品注入和多余结果字段', async () => {
  const s=fresh(38); generateMorningWishes(s,[]);
  const c=makeWishContext(s);
  assert.equal(await checkWishContext(c),null);
  const injected=structuredClone(c); injected.actors[0].candidates[0].price=0;
  assert.notEqual(await checkWishContext(injected),null);
  const suggestions=c.actors.map(a=>({actorId:a.actorId,itemId:a.candidates[0].itemId,reason:'想用',indirectLine:'有就好了。'}));
  assert.equal(validateWishPayload({requestId:c.requestId,suggestions},c),true);
  assert.equal(validateWishPayload({requestId:c.requestId,suggestions:[{...suggestions[0],cash:900},...suggestions.slice(1)]},c),false);
});

test('离线继续生成明确 local 来源；取消与过期响应丢弃', async () => {
  const s=fresh(39); generateMorningWishes(s,[]);
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('offline')};
  try {
    const r=await maybeGenerateItemWishes(s,{stillCurrent:()=>true});
    assert.equal(r.source,'local');
    assert.equal(r.summary.length,2);
    assert.equal(r.state.wishes.filter(w=>w.source==='local').length,2);
    assert.equal(await maybeGenerateItemWishes(s,{stillCurrent:()=>false}),null);
  } finally { globalThis.fetch=oldFetch; }
});
