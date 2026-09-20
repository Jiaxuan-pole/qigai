// 开场动画「被城市登出」：按文案分拍，画面随文案变化；点击加速、可跳过。画面由 intro-art.js 的像素场景负责。
import { px, glow, departureScene, cityScene, bridge, campProps, carPass, dust, clouds, bike, stallFar, ding, cardboardDrawing, phoneGlow, person, personAnchors, tossCig, smokeCurl, drag, dustPuff } from './intro-art.js';
import { createIntroClock, nextIntroSpeed } from './intro-clock.js';

const S = (text) => ({ type: 'stage', text });
const N = (text) => ({ type: 'narr', text });
const L = (who, text) => ({ type: 'line', who, text });

export const INTRO_LAYOUT = { seatedFanX: 350, seatedFanFootprint: 36, rightPillarX: 388 };

function stopIntroSpeech() {
  window.jwsnAudio?.stopSpeech?.();
}

export function announceIntroLine(line) {
  if (line.type !== 'line') return;
  stopIntroSpeech();
  window.jwsnAudio?.speak?.(line.who, line.text);
}

export function shouldAdvanceIntroForKey(targetId, key) {
  return targetId !== 'introSpeed' && (key === ' ' || key === 'Enter');
}

// 每拍：lines 文案；fx 场景指令；hold 自动推进等待（毫秒，打字完成后计）
export const BEATS = [
  { scene: 'black', lines: [S('暗里先传来行李箱轮子拖过地面的声音。画面亮出一点：轩哥和凡哥并肩往前走，两个箱子轮子都磕得响。')], fx: { wheel: true }, hold: 2600 },
  { scene: 'city', lines: [N('早上六点，雾城照常醒来。')], fx: { dawn: 0.3 }, hold: 1800 },
  { scene: 'city', lines: [N('早餐摊掀开蒸笼，公交车靠站，写字楼外的保安把昨晚吹倒的广告牌扶起来。')], fx: { dawn: 0.6, bus: true, steam: true }, hold: 2400 },
  { scene: 'city', lines: [N('没有什么大事发生。')], fx: { dawn: 0.8 }, hold: 1600 },
  { scene: 'city', lines: [N('只是轩哥和凡哥，没地方住了。')], fx: { dawn: 1 }, hold: 2200 },
  { scene: 'bridge', lines: [S('画面亮起。桥下，两个人，几个袋子，一只合不严的行李箱。')], fx: { xuan: 'crouch', fan: 'stand', bags: true }, hold: 2200 },
  { scene: 'bridge', lines: [N('凡哥把相机包放在纸箱上，又拿起来，垫了件衣服，才重新放下。')], fx: { fan: 'bend', camBag: true }, hold: 2400 },
  { scene: 'bridge', lines: [N('轩哥蹲在旁边，盯着手机。'), N('上一条消息是甲方昨天发的：'), N('“结款的事，我再帮你催一下。”'), N('再往上翻，前天也是这句。')], fx: { phone: 'xuan' }, hold: 3200 },
  { scene: 'bridge', lines: [L('凡哥', '还看呢？'), L('轩哥', '学习一下。'), L('凡哥', '学什么？'), L('轩哥', '怎么用一句话，让一个人每天都觉得明天有希望。')], fx: { phone: 'xuan' }, hold: 3000 },
  { scene: 'bridge', lines: [N('凡哥没接。他掏出烟盒，倒了倒，只剩两根。'), N('一人一根。'), N('打火机按了三下，才着。')], fx: { lighter: true }, hold: 4400 },
  { scene: 'bridge', lines: [S('远处的早餐摊传来收款提示音。凡哥朝那边看了一眼。')], fx: { smoke: true, fanLook: true, ding: true }, hold: 2200 },
  { scene: 'bridge', lines: [L('凡哥', '你还剩多少？'), N('轩哥报了个数。'), L('凡哥', '现金呢？'), L('轩哥', '刚才报的就是全部。')], fx: { smoke: true }, hold: 3000 },
  { scene: 'bridge', lines: [N('凡哥把烟从嘴边拿下来，看了看，像突然觉得这一口抽得有点贵。'), N('两个人沉默了一会儿。')], fx: { smoke: true }, hold: 2800 },
  { scene: 'bridge', lines: [N('桥上有车经过，接缝震得头顶落下一点灰。凡哥伸手护住相机包。')], fx: { car: true, dust: true, fan: 'bend' }, hold: 2800 },
  { scene: 'bridge', lines: [L('轩哥', '你先护一下自己行不行。'), L('凡哥', '相机贵。'), L('轩哥', '你这话说得，我都不知道该反驳哪儿。')], fx: {}, hold: 2800 },
  { scene: 'bridge', lines: [S('凡哥靠着桥柱坐下。他的手机亮了。'), N('有人在旧剧组群里发了一张片场照片。'), N('不是他们那部。'), N('他看了几秒，把通知关掉，手机扣在腿上。')], fx: { fan: 'sit', phone: 'fan' }, hold: 3400 },
  { scene: 'bridge', lines: [L('凡哥', '我那片子，其实还差三个镜头。'), N('轩哥没说话。'), L('凡哥', '补完就能剪。'), L('轩哥', '嗯。'), L('凡哥', '就是现在……'), N('凡哥没往下说。'), N('轩哥也没替他说完。')], fx: { fan: 'sit' }, hold: 3600 },
  { scene: 'bridge', lines: [N('过了一会儿，轩哥从电脑包里掏出充电器，绕好线，又放了回去。附近没有插座，他刚才已经找过一遍了。')], fx: { fan: 'sit', charger: true }, hold: 2800 },
  { scene: 'bridge', lines: [L('轩哥', '我现在倒是彻底实现云办公了。'), N('凡哥抬头。'), N('轩哥指了指桥外的天。'), L('轩哥', '云挺多的。'), L('凡哥', '烂。'), L('轩哥', '免费的，你还挑。'), N('这次凡哥笑了一下，很短。')], fx: { fan: 'sit', clouds: true, point: true }, hold: 3600 },
  { scene: 'bridge', lines: [S('风吹动纸箱上翘起的封口。凡哥从包里摸出一支马克笔。'), N('他把纸箱翻了个面，画了一个方框。'), N('框里两个人，一个穿黑衬衫，一个背相机。'), N('然后在他们头顶，加了一个屋顶。')], fx: { fan: 'crouch', draw: 3 }, hold: 3600 },
  { scene: 'bridge', lines: [N('轩哥凑过去看。'), L('轩哥', '画大点。'), L('凡哥', '干吗？'), L('轩哥', '我电脑没地方放。'), N('凡哥把方框往外扩了一点。'), L('凡哥', '现在呢？'), L('轩哥', '厕所呢？'), L('凡哥', '你他妈自己画。')], fx: { fan: 'crouch', xuan: 'crouchNear', draw: 4 }, hold: 3600 },
  { scene: 'bridge', lines: [S('轩哥接过笔，却没动。他看了一会儿那两个小人，把笔帽扣了回去。'), N('桥外，有人骑车经过，顺手把一只空饮料瓶放在路边。'), N('再远一点，早餐摊的老板正一个人搬桌子。桌腿卡在门槛上，她试了两次，没抬过去。')], fx: { draw: 4, bike: true, stall: true }, hold: 3800 },
  { scene: 'bridge', lines: [N('凡哥站起来，拍掉裤子上的灰。'), L('凡哥', '去问问，帮忙管不管饭。'), N('轩哥收起手机，拎了拎那个瘪下去的电脑包。'), L('轩哥', '你去问。我看着东西。')], fx: { draw: 4, fan: 'stand', stall: true }, hold: 3200 },
  { scene: 'bridge', lines: [N('凡哥走出两步，又回过头。'), L('凡哥', '那晚上呢？'), L('轩哥', '什么晚上？'), L('凡哥', '今晚睡哪儿？'), N('轩哥看了看桥顶，又看了看纸箱上那个刚画好的屋顶。'), L('轩哥', '先问饭。')], fx: { draw: 4, fan: 'step', stall: true }, hold: 3600 },
  { scene: 'bridge', lines: [S('凡哥朝早餐摊走去。轩哥把行李往干燥的地方挪了挪，用那块画着两个人的纸板，垫住漏底的袋子。')], fx: { draw: 4, fan: 'walkOut', xuan: 'move', stall: true }, hold: 3400 },
  { scene: 'bridge', lines: [S('画面缓缓拉远。城市的声音变大。他们没有再说话。')], fx: { zoomOut: true, fan: 'gone', stall: true }, hold: 3200 },
  { scene: 'title', lines: [], fx: {}, hold: 999999 },
];


// 分镜表：每一拍里手上的动作按拍内毫秒推进。返回两个人的绘制参数和几样特效开关。
export function choreo(beat, age, tick, world) {
  const fan = { arm: 'none' }, xuan = { arm: 'none' }, fxp = {};
  const d1 = drag(tick, 0), d2 = drag(tick, 31);
  const bothSmoke = () => { fan.cig = true; xuan.cig = true; fan.ember = d1.ember; xuan.ember = d2.ember; fxp.smoke = true; };
  switch (beat) {
    case 6: fan.arm = age < 1500 ? 'protect' : 'none'; break;
    case 7: case 8: xuan.arm = 'phone'; xuan.headDown = true; break;
    case 9: {
      if (age < 700) fan.arm = 'pocket';
      else if (age < 2100) { fan.arm = 'hold'; fan.pack = true; fan.packCigs = age > 1000; fan.packShake = age > 1000 && age < 1500 ? (Math.floor(age / 90) % 2 ? 1 : -1) : 0; }
      if (age >= 1800) fan.cig = true;
      if (age >= 2100 && age < 2600) { fxp.toss = (age - 2100) / 500; xuan.arm = 'reach'; }
      if (age >= 2600) xuan.cig = true;
      if (age >= 2100 && age < 2700) fan.arm = 'hold';
      if (age >= 2700 && age < 4700) fan.arm = 'cup';
      fxp.sparks = (age > 2900 && age < 3100) || (age > 3400 && age < 3600) || (age > 3900 && age < 4100);
      fxp.flame = (age >= 4200 && age < 4700) || (age >= 5300 && age < 5900);
      fan.ember = age >= 4300 ? 1 : 0;
      // 点完自己的，把打火机扔给轩哥，轩哥自己点。
      if (age >= 4700 && age < 5200) { fan.arm = 'throw'; fxp.tossLighter = (age - 4700) / 500; xuan.arm = 'reach'; }
      if (age >= 5200 && age < 5900) { xuan.arm = 'cup'; fxp.lighterXuan = true; }
      xuan.ember = age >= 5500 ? 1 : 0;
      if (age >= 5900) { fan.ember = d1.ember; xuan.ember = d2.ember; fxp.smoke = true; }
      break;
    }
    case 10: bothSmoke(); fxp.fanFlip = age > 600; fan.look = age > 600 ? 1 : 0; if (age > 600) fxp.fanFlip = false; break;
    case 11: bothSmoke(); break;
    case 12: xuan.cig = true; xuan.ember = d2.ember; fxp.smoke = true; fan.arm = 'hold'; fan.cigHand = true; fan.ember = 0.3; fan.headDown = age > 500; break;
    case 13: fan.arm = 'protect'; break;
    case 15: fan.arm = age > 600 && age < 3200 ? 'phone' : 'none'; fxp.fanPhone = age > 600 && age < 3200; fxp.phoneLap = age >= 3200; fan.headDown = age > 600 && age < 3200; break;
    case 17: {
      if (age < 900) xuan.arm = 'pocket';
      else if (age < 2600) { xuan.arm = 'hold'; xuan.charger = true; xuan.chargerLoops = Math.min(3, Math.floor((age - 900) / 450)); }
      else if (age < 3200) xuan.arm = 'pocket';
      break;
    }
    case 18: xuan.arm = age > 1200 ? 'point' : 'none'; xuan.headUp = age > 1200; fan.headUp = age > 900; break;
    case 19: fan.arm = 'marker'; fan.handY = 22 + (Math.floor(age / 260) % 4) * 3; break;
    case 20: if (age < 2400) { fan.arm = 'marker'; fan.handY = 22 + (Math.floor(age / 260) % 4) * 3; } xuan.look = 1; break;
    case 21: if (age < 2500) xuan.arm = 'hold'; break;
    case 22: {
      if (age > 600 && age < 1900) { fan.arm = 'pat'; fan.patDown = Math.floor(age / 220) % 2 === 0; if (fan.patDown) fxp.patDust = (age % 220) / 220; }
      if (age > 2000) xuan.arm = 'pickup';
      break;
    }
    case 23: if (age > 1600 && !(Math.abs(world.fanX - world.fanTarget) > 1.5)) { fxp.fanFlip = true; fan.look = 1; } break;
    case 24: if (age > 2400 && Math.abs(world.xuanX - world.xuanTarget) <= 1.5) xuan.arm = age < 3400 ? 'pickup' : 'none'; break;
    default: break;
  }
  return { fan, xuan, fxp };
}

export function playIntro(onDone) {
  const root = document.createElement('div');
  root.className = 'intro';
  // 画面是像素 canvas；上面压一层很薄的 SVG 只做暗角和两团慢慢飘的雾，不画任何实物。
  root.innerHTML = `<div class="intro-stage"><canvas id="introCanvas" width="480" height="270"></canvas><svg class="intro-fx" viewBox="0 0 480 270" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="introVig" cx="50%" cy="48%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient><filter id="introBlur" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="9"/></filter></defs><g class="intro-fog"><ellipse cx="120" cy="150" rx="150" ry="22" fill="#b8c6c8" filter="url(#introBlur)"/><ellipse cx="400" cy="120" rx="130" ry="18" fill="#b8c6c8" filter="url(#introBlur)"/></g><rect width="480" height="270" fill="url(#introVig)"/></svg><div class="intro-title hidden" id="introTitle"><div class="eyebrow">DAY 1 / MORNING</div><h1>今晚睡哪儿</h1><p>第 1 日 · 清晨</p><p class="intro-prompt">先给两个人，安排一点今天能做的事。</p><button class="primary big" id="introStart">开始安排</button></div></div><div class="intro-text" id="introText"></div><div class="intro-btns"><button id="introSpeed" type="button" aria-label="开场速度 1×">速度 1×</button><button id="introNext">继续 ▸</button><button id="introSkip" class="linkbtn">跳过开场</button></div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('#introCanvas');
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const textEl = root.querySelector('#introText');
  const speedButton = root.querySelector('#introSpeed');
  const clock = createIntroClock();
  let beat = 0, lineIdx = 0, charIdx = 0, typing = true, holdUntil = null, nextTypeAt = 55, raf = 0;
  let beatStart = 0, lastFrame = 0;
  // 世界状态：人物位置与镜头都是目标值，帧里按时间缓动过去，快慢不随帧率变。
  const world = { dawn: 0, xuanPose: 'crouch', fanPose: 'stand', fanX: 300, xuanX: 200, fanTarget: 300, xuanTarget: 200, bagX: 160, bagTarget: 160, camBag: false, jacketPad: false, cat: false, flap: false, draw: 0, dust: [], zoom: 1.18, zoomTarget: 1.18, fx: 250, fy: 158, fxTarget: 250, fyTarget: 158, car: null, xuanFlip: false, fanFlip: true };
  let carStart = 0, bikeStart = 0, drawStart = 0;
  // 声音层是可选的：有 audio 模块就配轮子磕地声和街道底噪，没有就静默。
  const sfx = (name) => window.jwsnAudio?.play?.(name);
  let lastBump = -1;

  function startBeat(i) {
    stopIntroSpeech();
    beat = i;
    if (beat >= BEATS.length) return finish();
    const b = BEATS[beat];
    lineIdx = 0; charIdx = 0; typing = true;
    textEl.innerHTML = '';
    holdUntil = null;
    beatStart = clock.now();
    nextTypeAt = beatStart + 55;
    const fx = b.fx;
    root.dataset.scene = b.scene;
    root.dataset.beat = String(beat);
    if (beat === 1) window.jwsnAudio?.ambient?.('street');
    if (b.scene === 'title') window.jwsnAudio?.ambient?.(null);
    if (fx.dawn !== undefined) world.dawn = fx.dawn;
    if (b.scene === 'bridge' && world.dawn < 1) world.dawn = 1;
    if (fx.xuan === 'crouch') { world.xuanPose = 'crouch'; world.xuanTarget = 200; world.xuanFlip = false; }
    if (fx.xuan === 'crouchNear') { world.xuanPose = 'crouch'; world.xuanTarget = 214; world.xuanFlip = false; }
    if (fx.xuan === 'move') { world.xuanPose = 'walk'; world.xuanTarget = 150; world.bagTarget = 140; world.xuanFlip = true; }
    if (fx.fan === 'stand') { world.fanPose = 'stand'; world.fanTarget = 300; world.fanFlip = true; }
    if (fx.fan === 'bend') { world.fanPose = 'bend'; world.fanTarget = 276; world.fanFlip = true; }
    if (fx.fan === 'sit') { world.fanPose = 'sit'; world.fanTarget = INTRO_LAYOUT.seatedFanX; world.fanFlip = false; }
    if (fx.fan === 'crouch') { world.fanPose = 'crouch'; world.fanTarget = 282; world.fanFlip = true; }
    if (fx.fan === 'step') { world.fanPose = 'walk'; world.fanTarget = 330; world.fanFlip = false; }
    if (fx.fan === 'walkOut') { world.fanPose = 'walk'; world.fanTarget = 520; world.fanFlip = false; }
    if (fx.fan === 'gone') { world.fanTarget = 560; }
    if (fx.camBag) { world.camBag = true; }
    if (b.scene === 'bridge') world.cat = true;
    if (fx.car) { carStart = clock.now(); world.dust = []; }
    if (fx.bike) bikeStart = clock.now();
    if (fx.draw !== undefined) { if (fx.draw !== world.draw) drawStart = clock.now(); world.draw = fx.draw; }
    world.flap = beat === 19;
    // 镜头：对白拍轻推，收尾拉远。
    if (fx.zoomOut) { world.zoomTarget = 1; world.fxTarget = 240; world.fyTarget = 135; }
    else if (b.scene === 'bridge') { const talk = b.lines.some((l) => l.type === 'line'); world.zoomTarget = talk ? 1.3 : 1.18; world.fxTarget = fx.fan === 'sit' ? 276 : 250; world.fyTarget = talk ? 166 : 158; }
    if (b.scene === 'title') {
      root.querySelector('#introTitle').classList.remove('hidden');
      root.querySelector('#introNext').classList.add('hidden');
      root.querySelector('#introSkip').classList.add('hidden');
      textEl.classList.add('hidden');
    }
  }

  function typeStep() {
    const b = BEATS[beat];
    if (!b || !typing) return;
    const line = b.lines[lineIdx];
    if (!line) { typing = false; holdUntil = clock.now() + b.hold; return; }
    let el = textEl.children[lineIdx];
    if (!el) {
      el = document.createElement('div');
      el.className = 'il ' + line.type;
      if (line.type === 'line') {
        el.innerHTML = `<b>${line.who}</b><span></span>`;
        announceIntroLine(line);
      } else el.innerHTML = '<span></span>';
      textEl.appendChild(el);
    }
    charIdx += 1;
    el.querySelector('span').textContent = line.text.slice(0, charIdx);
    if (charIdx >= line.text.length) { lineIdx += 1; charIdx = 0; }
  }
  function hurry() {
    const b = BEATS[beat];
    if (!b) return;
    if (typing && b.lines.length) {
      textEl.innerHTML = b.lines.map((l) => `<div class="il ${l.type}">${l.type === 'line' ? '<b>' + l.who + '</b>' : ''}<span>${l.text}</span></div>`).join('');
      lineIdx = b.lines.length; charIdx = 0; typing = false;
      holdUntil = clock.now() + Math.min(b.hold, 1800);
    } else startBeat(beat + 1);
  }

  const ease = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

  function frame(realNow) {
    const now = clock.advance(realNow);
    if (holdUntil !== null && now >= holdUntil) startBeat(beat + 1);
    const b = BEATS[beat];
    if (!b) return;
    const dt = Math.min(100, now - lastFrame);
    lastFrame = now;
    while (typing && now >= nextTypeAt) { typeStep(); nextTypeAt += 55; }
    const tick = Math.floor(now / 40);
    const sceneAge = now - beatStart;
    c.setTransform(1, 0, 0, 1, 0, 0);
    px(c, 0, 0, 480, 270, '#05080b');
    if (b.scene === 'black') {
      departureScene(c, { tick, sceneAge });
      const bumpIdx = Math.floor(sceneAge / 700);
      if (bumpIdx % 3 === 0 && bumpIdx !== lastBump && sceneAge < 6500) { lastBump = bumpIdx; sfx('wheel'); }
    } else if (b.scene === 'city') {
      cityScene(c, { tick, dawn: world.dawn, fx: b.fx, sceneAge });
    } else {
      world.zoom = ease(world.zoom, world.zoomTarget, dt, 900);
      world.fx = ease(world.fx, world.fxTarget, dt, 900);
      world.fy = ease(world.fy, world.fyTarget, dt, 900);
      world.fanX = ease(world.fanX, world.fanTarget, dt, world.fanPose === 'walk' ? 900 : 380);
      world.xuanX = ease(world.xuanX, world.xuanTarget, dt, world.xuanPose === 'walk' ? 900 : 380);
      world.bagX = ease(world.bagX, world.bagTarget, dt, 700);
      const z = world.zoom;
      c.setTransform(z, 0, 0, z, Math.round(240 - z * world.fx), Math.round(135 - z * world.fy));
      world.car = carStart && now - carStart < 2600 ? (now - carStart) / 2600 : null;
      if (world.car !== null && world.car > 0.3 && world.dust.length < 26 && tick % 2 === 0) world.dust.push({ x: 232 + Math.random() * 16, y: 50, vy: 0.8 + Math.random() * 1.2, s: Math.random() < 0.3 ? 2 : 1 });
      for (const d of world.dust) d.y += d.vy;
      world.dust = world.dust.filter((d) => d.y < 200);
      bridge(c, { tick, dawn: world.dawn });
      if (b.fx.clouds) clouds(c, tick);
      carPass(c, { car: world.car });
      stallFar(c, tick, Boolean(b.fx.stall));
      if (b.fx.ding) ding(c, tick);
      if (b.fx.camBag && sceneAge > 1500) world.jacketPad = true;
      campProps(c, { tick, world });
      if (world.draw > 0) { if (beat >= 24 && sceneAge > 2600 || beat >= 25) { px(c, world.bagX - 2, 230, 46, 5, '#c9b389'); px(c, world.bagX, 231, 42, 1, '#5a4633'); } else cardboardDrawing(c, 232, 198, world.draw, (now - drawStart) / 1400); }
      // 人物：位置到了就站住，别在原地踏步；具体手上的动作由分镜表按拍内时间决定。
      const wf = Math.floor(tick / 2) % 4;
      const fanMoving = Math.abs(world.fanX - world.fanTarget) > 1.5;
      const xuanMoving = Math.abs(world.xuanX - world.xuanTarget) > 1.5;
      const fanPose = world.fanPose === 'walk' ? (fanMoving ? 'walk' + wf : 'stand') : world.fanPose;
      const xuanPose = world.xuanPose === 'walk' ? (xuanMoving ? 'walk' + wf : 'stand') : world.xuanPose;
      const ch = choreo(beat, sceneAge, tick, world);
      const fanY = 186, xuanY = 186;
      const fanFlip = ch.fxp.fanFlip ?? world.fanFlip;
      const xuanX = world.xuanX + (ch.fxp.xuanLean || 0);
      const fanAnchors = personAnchors(world.fanX, fanY, fanPose, wf, { flip: fanFlip, ...ch.fan });
      const xuanAnchors = personAnchors(xuanX, xuanY, xuanPose, wf, { flip: world.xuanFlip, ...ch.xuan });
      if (world.fanX < 520) person(c, world.fanX, fanY, 'fan', fanPose, wf, { flip: fanFlip, ...ch.fan });
      person(c, xuanX, xuanY, 'xuan', xuanPose, wf, { flip: world.xuanFlip, ...ch.xuan });
      if (ch.xuan.arm === 'phone') phoneGlow(c, xuanX + 13, xuanY + 19);
      if (ch.fxp.fanPhone) { phoneGlow(c, fanFlip ? world.fanX + 10 : world.fanX + 13, fanY + 27); }
      if (ch.fxp.phoneLap) px(c, world.fanX + 12, fanY + 36, 6, 3, '#1b2228');
      if (ch.fxp.toss !== undefined) tossCig(c, world.fanX + 17, fanY + 22, xuanX + 30, xuanY + 17, ch.fxp.toss);
      const lighterAt = ch.fxp.lighterXuan ? xuanAnchors : fanAnchors;
      const ignitionAt = lighterAt.cigarette;
      if (ch.fxp.sparks) { px(c, ignitionAt[0] - 1, ignitionAt[1] - 1, 2, 2, '#ffd27a'); px(c, ignitionAt[0] + 2, ignitionAt[1] - 2, 1, 1, '#ffd27a'); px(c, ignitionAt[0] + 1, ignitionAt[1] + 1, 1, 1, '#fff1c2'); }
      if (ch.fxp.flame) { px(c, ignitionAt[0] - 1, ignitionAt[1] - 1, 3, 2, '#ffb347'); px(c, ignitionAt[0], ignitionAt[1] - 3, 1, 2, '#ffd27a'); glow(c, ignitionAt[0], ignitionAt[1] - 1, 12, 'rgba(255,179,71,1)', 0.35); }
      if (ch.fxp.tossLighter !== undefined) tossCig(c, fanAnchors.lighter[0], fanAnchors.lighter[1], xuanAnchors.lighter[0], xuanAnchors.lighter[1], ch.fxp.tossLighter, '#8a9aa6', 2, 4);
      if (ch.fxp.smoke) {
        const d1 = drag(tick, 0), d2 = drag(tick, 31);
        if (ch.fan.cig) smokeCurl(c, fanAnchors.cigarette[0], fanAnchors.cigarette[1] - 1, tick, 0, 0.7 + d1.exhale);
        if (ch.fan.cigHand) smokeCurl(c, fanFlip ? world.fanX + 17 : world.fanX + 6, fanY + 18, tick, 7, 0.5);
        if (ch.xuan.cig) smokeCurl(c, xuanAnchors.cigarette[0], xuanAnchors.cigarette[1] - 1, tick, 31, 0.7 + d2.exhale);
      }
      if (ch.fxp.patDust !== undefined) dustPuff(c, fanFlip ? world.fanX + 4 : world.fanX + 20, fanY + 38, ch.fxp.patDust);
      if (b.fx.charger && !ch.xuan.charger) { px(c, xuanX + 26, xuanY + 34, 10, 3, '#1d2126'); }
      if (bikeStart && now - bikeStart < 3800) bike(c, (now - bikeStart) / 3800);
      dust(c, world.dust);
    }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    stopIntroSpeech();
    cancelAnimationFrame(raf);
    root.remove();
    onDone();
  }

  root.querySelector('#introNext').onclick = hurry;
  root.querySelector('#introSkip').onclick = () => startBeat(BEATS.length - 1);
  root.querySelector('#introStart').onclick = finish;
  speedButton.onclick = (event) => {
    event.stopPropagation();
    clock.advance(performance.now());
    speedButton.textContent = `速度 ${clock.setSpeed(nextIntroSpeed(clock.speed()))}×`;
    speedButton.setAttribute('aria-label', `开场速度 ${clock.speed()}×`);
  };
  canvas.onclick = hurry;
  textEl.onclick = hurry;
  root.onkeydown = (e) => { if (shouldAdvanceIntroForKey(e.target?.id, e.key)) { e.preventDefault(); if (BEATS[beat]?.scene === 'title') finish(); else hurry(); } };
  root.tabIndex = -1;
  root.focus();
  startBeat(0);
  raf = requestAnimationFrame(frame);
}
