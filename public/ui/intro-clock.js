export const INTRO_SPEEDS = [1, 1.5, 2, 3];

export function normalizeIntroSpeed(speed) {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) return 1;
  return INTRO_SPEEDS.reduce((nearest, option) => Math.abs(option - speed) < Math.abs(nearest - speed) ? option : nearest, INTRO_SPEEDS[0]);
}

export function nextIntroSpeed(speed) {
  const index = INTRO_SPEEDS.indexOf(normalizeIntroSpeed(speed));
  return INTRO_SPEEDS[(index + 1) % INTRO_SPEEDS.length];
}

export function createIntroClock(initialSpeed = 1) {
  let elapsed = 0;
  let speed = normalizeIntroSpeed(initialSpeed);
  let lastReal = null;
  return {
    advance(realNow) {
      if (lastReal !== null) elapsed += Math.max(0, realNow - lastReal) * speed;
      lastReal = realNow;
      return elapsed;
    },
    now() { return elapsed; },
    speed() { return speed; },
    setSpeed(nextSpeed) { speed = normalizeIntroSpeed(nextSpeed); return speed; },
  };
}
