import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, assign, copy } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';

before(loadData);
function start() { const s = fresh(443); s.pendingMorning = null; s.plan = { xuan: Array(16).fill(null), fan: Array(16).fill(null), ma: Array(16).fill(null) }; return s; }
function schedule(s,id,action,opts={}) { const r=assign(s,id,s.hour,action,opts); assert.equal(r.error,undefined,r.error); return r.state; }
function step(s) { const r=settle(s); assert.equal(r.error,undefined,r.error); return r.state; }

test('五工耗尽后睡两小时再工作，同时另一角色独立劳动', () => {
  let s=start();
  for(let i=0;i<5;i++){ s=schedule(s,'xuan','shop',{zone:'market'}); s=step(s); }
  assert.equal(s.actors.xuan.energy,0);
  const input=schedule(s,'xuan','shop',{zone:'market'}), bytes=JSON.stringify(input), failure=settle(input);
  assert.match(failure.error,/体力不足/); assert.equal(JSON.stringify(input),bytes); assert.equal(failure.state,input);
  for(let i=0;i<2;i++){ s=schedule(s,'xuan','sleep'); s=schedule(s,'fan','shop',{zone:'market'}); s=step(s); }
  assert.equal(s.actors.xuan.energy,40); assert.equal(s.actors.fan.energy,60);
  for(let i=0;i<2;i++){ s=schedule(s,'xuan','shop',{zone:'market'}); s=step(s); }
  assert.equal(s.actors.xuan.energy,0); assert.equal(s.hour,15); assert.equal(s.hourTick,9);
});

test('合作原子失败保持输入字节不变', () => {
  let s=start(); s.actors.fan.energy=0; s=schedule(s,'xuan','coop');
  const bytes=JSON.stringify(s), r=settle(s); assert.match(r.error,/体力不足/); assert.equal(JSON.stringify(r.state),bytes); assert.equal(JSON.stringify(s),bytes);
});

test('长任务只扣一次并在第三小时完成', () => {
  let s=start(); s=copy(s); s.plan.xuan[0]={id:'shop',hours:3,participants:['xuan'],zone:'market',cart:null,group:null,target:null};
  s=step(s); assert.equal(s.actors.xuan.energy,80); assert.equal(s.actors.xuan.location,'camp');
  assert.equal(s.busy.xuan.remainingHours,2);
  assert.match(assign(s,'xuan',s.hour,'shop',{zone:'market'}).error,/正在执行/);
  s=step(s); assert.equal(s.busy.xuan.remainingHours,1); assert.equal(s.actionCount,0);
  s=step(s); assert.equal(s.busy.xuan,null); assert.equal(s.actors.xuan.location,'market'); assert.equal(s.actionCount,1);
});

test('合作完成只计一次收入与材料、两人各耗20', () => {
  let s=start(); const cash=s.cash, parts=s.parts, battery=s.battery;
  s=schedule(s,'xuan','coop'); s=step(s);
  assert.equal(s.cash,cash+66); assert.equal(s.parts,parts-1); assert.equal(s.battery,battery-1);
  assert.equal(s.actors.xuan.energy,80); assert.equal(s.actors.fan.energy,80);
  assert.equal(s.actionCount,2); assert.equal(s.hourTick,1);
});

test('旧槽位参数拒绝且预订超夜任务拒绝', () => {
  const s=start(); assert.match(assign(s,'xuan',0,'sleep').error,/无效/);
  s.hour=21; s.slot=3; assert.equal(assign(s,'xuan',21,'sleep').error,undefined);
  s.plan.xuan[15]={...s.plan.xuan[0],id:'shop',hours:3,participants:['xuan'],zone:'market'};
  assert.match(settle(s).error,/时长超过/);
});

test('合作不能占用仍在长任务中的角色', () => {
  let s=start(); s.plan.fan[0]={id:'shop',hours:3,participants:['fan'],zone:'market',cart:null,group:null,target:null};
  s=step(s);
  const bytes=JSON.stringify(s), r=assign(s,'xuan',s.hour,'coop');
  assert.match(r.error,/正在执行/); assert.equal(JSON.stringify(s),bytes);
});
