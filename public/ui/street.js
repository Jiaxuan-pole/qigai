export const neighbors = Object.freeze({
  camp: ['market', 'recycle', 'river'], market: ['camp', 'station', 'cinema', 'river', 'cafe'],
  recycle: ['camp', 'service', 'furniture'], station: ['market', 'service', 'cardhall'],
  cinema: ['market', 'service', 'cafe', 'cardhall'], service: ['recycle', 'station', 'cinema', 'furniture'], river: ['camp', 'market'], cafe: ['market', 'cinema'],
  cardhall: ['station', 'cinema'],
  furniture: ['service', 'recycle'],
});

export function walkStep(x, direction, amount, width = 960, margin = 80) {
  const next = x + direction * amount;
  const right = width - margin;
  const clamped = Math.max(margin, Math.min(right, next));
  return { x: clamped, edge: next <= margin ? 'left' : next >= right ? 'right' : null };
}

export class StreetJourney {
  transitionName = null;
  constructor(handlers = {}, timers = {}) {
    this.handlers = handlers;
    this.setTimer = timers.setTimer || ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = timers.clearTimer || ((id) => clearTimeout(id));
  }
  setState(state, actorId) { this.state = state; this.actorId = actorId; }
  async travel(district) {
    const actor = this.state?.actors?.[this.actorId];
    if (actor?.life !== 'active' || !neighbors[actor.location]?.includes(district) || !this.handlers.onTravel) return false;
    const result = await this.handlers.onTravel(this.actorId, district);
    return Boolean(result);
  }
  transition(district, instant = false) {
    if (this.pending) {
      this.clearTimer(this.pending.timer);
      this.pending.resolve(false);
    }
    this.transitionName = instant ? null : district;
    if (instant) { this.pending = null; return Promise.resolve(true); }
    return new Promise((resolve) => {
      const pending = { resolve, timer: null };
      pending.timer = this.setTimer(() => {
        if (this.pending !== pending) return;
        this.pending = null;
        this.transitionName = null;
        resolve(true);
      }, 860);
      this.pending = pending;
    });
  }
  cancel() {
    if (!this.pending) return;
    this.clearTimer(this.pending.timer);
    this.pending.resolve(false);
    this.pending = null;
    this.transitionName = null;
  }
}
