import { rng } from './rng.js';

export const COFFEE_IDS = Object.freeze(['espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew']);

export function coffeeQuote({ count, units, strengthUnits, seed, day, actorId, confirmRisk, coffeeRules }) {
  if (!Number.isInteger(count) || count < 0 || count >= coffeeRules.cupsMax) return { error: '咖啡杯数无效' };
  if (!Number.isInteger(units) || units < 0 || !Number.isInteger(strengthUnits) || strengthUnits < 1) return { error: '咖啡单位无效' };
  const nextCups = count + 1;
  const nextUnits = units + strengthUnits;
  const risk = nextCups <= coffeeRules.safeCups ? 0 : Math.min(1, coffeeRules.riskPerCupAfterSafe * (nextCups - coffeeRules.safeCups));
  const creditGain = (Math.floor(nextUnits / coffeeRules.unitsPerCredit) - Math.floor(units / coffeeRules.unitsPerCredit)) * coffeeRules.creditPerThreshold;
  const riskKey = `${coffeeRules.riskKeyPrefix}:${day}:${actorId}:${nextCups}`;
  const requiresConfirmation = risk > 0 && !confirmRisk;
  if (requiresConfirmation) return { requiresConfirmation, nextCups, nextUnits, creditGain, fatal: false, risk, riskKey };
  return { requiresConfirmation, nextCups, nextUnits, creditGain, fatal: risk > 0 && rng(seed, riskKey) < risk, risk, riskKey };
}
