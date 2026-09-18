// 真机探针：向模型发一次最小对话请求，验证关思考配置与 JSON 契约。不改任何存档。
import { complete, extractJson, aiInfo } from '../server/ai.js';
import { DIALOGUE_SYSTEM } from '../server/prompts.js';
import { loadData } from '../public/game/data.js';
import { validateDialogue } from '../public/game/rules.js';

await loadData();
console.log('ai info', aiInfo());
const ctx = { requestId: 'smoke_1', sceneId: 'camp_evening', stateRevision: 7, sceneTone: '疲惫但可以商量', allowedCast: ['xuan', 'fan', 'ma'], allowedWishIds: ['fan_paint'], requiredChoiceIds: ['buy_paint', 'use_paper', 'promise_tomorrow'], factsForThisScene: ['三人此刻都在营地且还活着', '凡哥的颜料愿望尚未满足', '营地有可用废纸和铅笔', '尚未承诺明天买颜料'], wishCues: [{ wishId: 'fan_paint', stage: '积压', substitutes: ['纸板速写', '借颜料'] }], actorKnowledge: { xuan: ['知道共同账目'], fan: ['知道画没完成'], ma: ['知道便利店的位置'] } };
const { text, ms } = await complete(DIALOGUE_SYSTEM, JSON.stringify(ctx));
console.log('ms', ms);
console.log('raw', text.slice(0, 800));
const payload = extractJson(text);
console.log('validate', validateDialogue(payload, ctx));
