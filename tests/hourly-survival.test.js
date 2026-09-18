import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, assign } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';

before(loadData);
function scenario(day=2) { const s=fresh(622); s.day=day; s.hour=6; s.slot=0; s.hourTick=(day-1)*16; s.turn=(day-1)*4; s.pendingMorning=null; s.metMa=true; s.actors.ma.life='active'; s.plan={xuan:Array(16).fill(null),fan:Array(16).fill(null),ma:Array(16).fill(null)}; return s; }
function step(s) { const r=settle(s); assert.equal(r.error,undefined,r.error); return r; }

test('16小时只发生四次生存扣除、两餐和一次夜结算', () => {
  let s=scenario(); const before=s.items.filter(x=>x.itemId==='meal').length; let nights=0;
  for(let i=0;i<16;i++){ const r=step(s); s=r.state; if(r.night)nights++; if(i<15)assert.equal(s.day,2); }
  assert.equal(nights,1); assert.equal(s.turn,8); assert.equal(s.day,3); assert.equal(s.hour,6); assert.equal(s.hourTick,32);
  assert.ok(before-s.items.filter(x=>x.itemId==='meal').length>=2);
  const bytes=JSON.stringify(s); assert.equal(JSON.stringify(s),bytes);
});

test('醉意二格导致次晨最多80体力，其他人100', () => {
  let s=scenario(); s.actors.xuan.intox=2; s.actors.xuan.energy=0; s.actors.fan.energy=0;
  s.actors.xuan.coffeeCredit=20; s.actors.fan.coffeeCredit=40;
  s.daily.coffeeCups.xuan=2; s.daily.coffeeUnits={xuan:4,fan:0,ma:0};
  for(let i=0;i<16;i++)s=step(s).state;
  assert.equal(s.actors.xuan.energy,80); assert.equal(s.actors.fan.energy,100); assert.equal(s.actors.xuan.hangoverDay,3);
  assert.equal(s.actors.xuan.coffeeCredit,0); assert.equal(s.actors.fan.coffeeCredit,0);
  assert.equal(s.daily.coffeeCups.xuan,0); assert.equal(s.daily.coffeeUnits?.xuan ?? 0,0);
});

test('日内睡眠只补体力，不重置咖啡杯数与当日额度', () => {
  let s=scenario(); s.actors.xuan.energy=0; s.actors.xuan.coffeeCredit=20;
  s.daily.coffeeCups.xuan=2; s.daily.coffeeUnits={xuan:4,fan:0,ma:0};
  const arranged=assign(s,'xuan',s.hour,'sleep'); assert.equal(arranged.error,undefined,arranged.error);
  s=step(arranged.state).state;
  assert.equal(s.actors.xuan.energy,20); assert.equal(s.actors.xuan.coffeeCredit,20);
  assert.equal(s.daily.coffeeCups.xuan,2); assert.equal(s.daily.coffeeUnits.xuan,4);
});

test('宿醉只影响一个清晨，次晚恢复100', () => {
  let s=scenario(); s.actors.xuan.intox=2; s.actors.xuan.energy=0;
  for(let i=0;i<16;i++)s=step(s).state;
  assert.equal(s.actors.xuan.energy,80);
  s.pendingMorning=null; s.plan={xuan:Array(16).fill(null),fan:Array(16).fill(null),ma:Array(16).fill(null)};
  s.actors.xuan.energy=0;
  for(let i=0;i<16;i++)s=step(s).state;
  assert.equal(s.day,4); assert.equal(s.hour,6); assert.equal(s.actors.xuan.energy,100);
});

test('第100天22点进入最多两小时救援尾声', () => {
  let s=scenario(100); s.hour=21; s.slot=3; s.hourTick=1599; s.turn=399;
  s.actors.xuan.life='downed'; s.actors.xuan.health=0; s.actors.xuan.deadline=402;
  let r=step(s); s=r.state; assert.equal(s.phase,'tail'); assert.equal(s.hour,22); assert.equal(s.turn,400); assert.ok(r.night);
  r=assign(s,'xuan',22,'aid'); assert.equal(r.error,undefined,r.error); s=step(r.state).state;
  assert.equal(s.phase,'ending'); assert.equal(s.turn,401); assert.equal(s.hour,23); assert.equal(s.slot,3);
});

test('第45天连续两个真实维修小时才解锁试工', () => {
  let s=scenario(45); s.hour=10; s.slot=1; s.hourTick=44*16+4; s.turn=44*4+1;
  s.parts=3;
  let r=assign(s,'xuan',10,'repair'); assert.equal(r.error,undefined,r.error); s=step(r.state).state;
  assert.equal(s.flags.trialPassed,undefined);
  r=assign(s,'xuan',11,'repair'); assert.equal(r.error,undefined,r.error); s=step(r.state).state;
  assert.equal(s.flags.trialPassed,true);
});

test('存读后同一小时可重复确定性结算，夜结果只在21点产生一次', () => {
  let s=scenario(); s.hour=21; s.slot=3; s.hourTick=31; s.turn=7;
  const restored=JSON.parse(JSON.stringify(s));
  const first=step(s), second=step(restored);
  assert.deepEqual(first,second); assert.equal(first.state.hour,6); assert.equal(first.state.day,3);
  const next=step({ ...first.state, pendingMorning:null });
  assert.equal(next.night,null); assert.notEqual(next.txId,first.txId);
});
