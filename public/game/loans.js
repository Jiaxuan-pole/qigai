import { clamp } from './rules.js';
import { findItem, makeItem, removeItem } from './items.js';

export const LOANS = {
  reg_lu: { district: 'recycle', thingId: 'toolkit', days: 3, name: '鲁叔' },
  reg_chen: { district: 'station', thingId: 'cart', days: 2, name: '老陈' },
  reg_xu: { district: 'cinema', thingId: 'studio_pass', days: 3, name: '许姐' },
  reg_liu: { district: 'market', thingId: 'thermos', days: 2, name: '刘姐' },
};

function offerFor(npcId) {
  return LOANS[npcId] || null;
}

function relationFor(state, npcId) {
  state.relations ??= {};
  state.relations[npcId] ??= { trust: 0 };
  state.relations[npcId].trust ??= 0;
  return state.relations[npcId];
}

function loansFor(state) {
  state.loans ??= [];
  return state.loans;
}

function flagsFor(state) {
  state.flags ??= {};
  state.flags.loanBroken ??= {};
  return state.flags;
}

function removeLoan(state, uid) {
  state.loans = loansFor(state).filter((loan) => loan.uid !== uid);
}

export function canBorrow(state, npcId, actorId) {
  const offer = offerFor(npcId);
  if (!offer) return { ok: false, reason: '这位熟人不能借物' };
  const actor = state.actors?.[actorId];
  if (!actor || actor.location !== offer.district) return { ok: false, reason: '需要本人在熟人所在街区' };
  if ((state.relations?.[npcId]?.trust || 0) < 2) return { ok: false, reason: '熟人信任不足2' };
  if (loansFor(state).some((loan) => loan.from === npcId)) return { ok: false, reason: '这位熟人的借物尚未归还' };
  const brokenDay = state.flags?.loanBroken?.[npcId];
  if (Number.isInteger(brokenDay) && state.day - brokenDay < 30) return { ok: false, reason: '失约后30天内不能再借' };
  return { ok: true };
}

export function borrow(state, npcId, actorId) {
  const allowed = canBorrow(state, npcId, actorId);
  if (!allowed.ok) return allowed;
  const offer = offerFor(npcId);
  const due = state.day + offer.days;
  const item = makeItem(state, offer.thingId, actorId);
  item.loan = { from: npcId, due, extended: false };
  loansFor(state).push({ uid: item.uid, from: npcId, due, actorId, extended: false });
  return { ok: true, item, text: `${offer.name}把${item.itemId}借给了你，到第${due}天归还。` };
}

export function returnLoan(state, uid, actorId) {
  const loan = loansFor(state).find((entry) => entry.uid === uid);
  if (!loan) return { ok: false, reason: '没有这笔借物' };
  const offer = offerFor(loan.from);
  const actor = state.actors?.[actorId];
  if (!offer || !actor || actor.location !== offer.district) return { ok: false, reason: '需要在熟人所在街区归还' };
  const item = findItem(state, uid);
  if (!item || item.container !== actorId) return { ok: false, reason: '借物必须在本人包里' };
  removeItem(state, uid);
  removeLoan(state, uid);
  const onTime = state.day <= loan.due;
  if (onTime) relationFor(state, loan.from).trust = clamp(relationFor(state, loan.from).trust + 1, 0, 5);
  return { ok: true, onTime, text: onTime ? `按时归还给${offer.name}，信任+1。` : `归还给${offer.name}。` };
}

export function extendLoan(state, uid) {
  const loan = loansFor(state).find((entry) => entry.uid === uid);
  if (!loan) return { ok: false, reason: '没有这笔借物' };
  const item = findItem(state, uid);
  if (!item?.loan) return { ok: false, reason: '借物记录不完整' };
  if (loan.extended || item.loan.extended) return { ok: false, reason: '这件借物已经延期过一次' };
  loan.due += 2;
  loan.extended = true;
  item.loan.due = loan.due;
  item.loan.extended = true;
  return { ok: true, due: loan.due, text: `借物延期到第${loan.due}天。` };
}

export function tickLoans(state, events = []) {
  const notices = [];
  for (const loan of [...loansFor(state)]) {
    if (loan.lastTickDay === state.day || state.day <= loan.due) continue;
    loan.lastTickDay = state.day;
    const offer = offerFor(loan.from);
    if (!offer) continue;
    const overdueDays = state.day - loan.due;
    const relation = relationFor(state, loan.from);
    relation.trust = clamp(relation.trust - 1, 0, 5);
    let text = `${offer.name}的借物逾期第${overdueDays}天，信任-1。`;
    if (overdueDays >= 3) {
      removeItem(state, loan.uid);
      removeLoan(state, loan.uid);
      relation.trust = clamp(relation.trust - 2, 0, 5);
      flagsFor(state).loanBroken[loan.from] = state.day;
      text += ` ${offer.name}收回借物，信任-2。`;
    }
    notices.push(text);
    if (Array.isArray(events)) events.push(text);
  }
  return notices;
}
