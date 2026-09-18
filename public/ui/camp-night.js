const NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };
const ACTIVITIES = [
  { id: 'fire', label: '围火坐会儿' },
  { id: 'inventory', label: '整理背包' },
  { id: 'talk', label: '聊两句' },
  { id: 'cards', label: '打两手' },
  { id: 'tv', label: '看电视' },
  { id: 'end', label: '结束这一晚' },
];

export function availableCampNightActivities(state, night, cardsUsed = false) {
  return {
    actors: ['xuan', 'fan', 'ma'].filter((id) => state?.actors?.[id]?.life === 'active').map((id) => ({ id, name: NAMES[id] })),
    activities: ACTIVITIES.filter((item) => item.id !== 'tv' || Boolean(night?.screening)).map((item) => ({ ...item, disabled: item.id === 'cards' && (cardsUsed || (state?.flags?.cardNightDay != null && state.flags.cardNightDay === state.day)) })),
  };
}

export function createCampNightSession({ state, getState, night, onCards, onInventory, onTalk, onScreening, onActorChange, onSit, onEnd, onChange } = {}) {
  let busy = false;
  let stopped = false;
  let cardsUsed = false;
  const liveState = () => getState?.() ?? state;
  let actorId = availableCampNightActivities(liveState(), night).actors[0]?.id ?? null;
  const callbacks = { fire: onSit, inventory: onInventory, talk: onTalk, cards: onCards, tv: onScreening, end: onEnd };
  const session = {
    get busy() { return busy; },
    get stopped() { return stopped; },
    get actorId() { return actorId; },
    get cardsUsed() { return cardsUsed; },
    get options() { return availableCampNightActivities(liveState(), night, cardsUsed); },
    selectActor(id) {
      if (busy || stopped || !session.options.actors.some((actor) => actor.id === id)) return false;
      actorId = id;
      onActorChange?.(id);
      onChange?.();
      return true;
    },
    async run(id) {
      if (busy || stopped || !session.options.activities.some((item) => item.id === id && !item.disabled)) return false;
      busy = true;
      onChange?.();
      try {
        const result = await callbacks[id]?.(actorId, night?.screening);
        if (id === 'cards' && result === true) cardsUsed = true;
        return true;
      } finally {
        busy = false;
        onChange?.();
      }
    },
    stop() { stopped = true; },
  };
  return session;
}

let current = null;

// Hotspots from the map and toolbar buttons enter the same one-at-a-time session.
export function triggerCampNightActivity(id) {
  if (!current) return Promise.resolve(false);
  const action = { bed: 'end', fire: 'fire', storage: 'inventory', tv: 'tv', workbench: 'inventory' }[id] || id;
  return current.session.run(action);
}

export function exploreCampNight(options) {
  if (current) current.close();
  const { night } = options;
  const mount = options.mount || document.getElementById('mapWrap')?.parentElement;
  if (!mount) throw new Error('营地活动需要地图容器');
  const panel = document.createElement('section');
  panel.className = 'camp-night-bar';
  panel.setAttribute('aria-label', '营地夜间活动');
  panel.innerHTML = '<div class="camp-night-heading"><strong></strong><span>左右键或触屏走动，走到物件旁也能操作。</span></div><div class="camp-night-actors" role="group" aria-label="当前角色"></div><div class="camp-night-actions" role="group" aria-label="夜间活动"></div>';
  mount.append(panel);
  const actors = panel.querySelector('.camp-night-actors');
  const actions = panel.querySelector('.camp-night-actions');
  panel.querySelector('strong').textContent = `第${night.day}夜 · 桥下营地`;
  let resolve;
  let closed = false;
  const done = new Promise((res) => { resolve = res; });
  const close = () => {
    if (closed) return;
    closed = true;
    session.stop();
    panel.removeEventListener('click', onClick);
    panel.remove();
    if (current?.panel === panel) current = null;
    resolve();
  };
  const render = () => {
    if (closed) return;
    actors.replaceChildren();
    actions.replaceChildren();
    for (const actor of session.options.actors) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.actor = actor.id; button.textContent = actor.name;
      button.setAttribute('aria-pressed', String(session.actorId === actor.id));
      button.disabled = session.busy;
      actors.append(button);
    }
    for (const activity of session.options.activities) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.activity = activity.id;
      button.textContent = activity.id === 'tv' ? `看电视 · ${night.screening.title}` : activity.label;
      button.disabled = session.busy || activity.disabled;
      if (activity.id === 'end') button.className = 'primary';
      actions.append(button);
    }
  };
  const session = createCampNightSession({ ...options, onChange: render, onEnd: async () => { await options.onEnd?.(); close(); } });
  const onClick = (event) => {
    const actor = event.target.closest('button[data-actor]');
    if (actor) { session.selectActor(actor.dataset.actor); return; }
    const activity = event.target.closest('button[data-activity]');
    if (activity) void session.run(activity.dataset.activity);
  };
  panel.addEventListener('click', onClick);
  current = { panel, session, close };
  render();
  return done;
}
