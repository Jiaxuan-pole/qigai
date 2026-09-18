// 模型调用：pi-ai 接 BigModel glm-5.2，思考显式关闭。密钥只在服务端。
// 读取顺序：进程环境变量 > 项目 .env > AI_ENV_FILE（默认回退到 kaelis-engine/.env，用户指定的配置位置）。
import { createModels, createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KAELIS_ENV = '/Users/Admin/Desktop/polev3/kaelis-engine/.env';

function loadEnv() {
  for (const file of [join(ROOT, '.env'), process.env.AI_ENV_FILE || KAELIS_ENV]) {
    if (!existsSync(file)) continue;
    try { process.loadEnvFile(file); } catch { /* 已有的变量不覆盖 */ }
  }
}

const GATEWAYS = {
  bigmodel: { name: 'BigModel', baseUrl: 'https://open.bigmodel.cn/api/anthropic', api: 'anthropic-messages', envKeys: ['BIGMODEL_API_KEY'], model: 'glm-5.2' },
  'bigmodel-v4': { name: 'BigModel V4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', api: 'openai-completions', envKeys: ['BIGMODEL_API_KEY'], model: 'glm-5.2', compat: { maxTokensField: 'max_tokens', supportsReasoningEffort: true } },
};

let sdk = null;

export function aiInfo() {
  loadEnv();
  const gw = GATEWAYS[process.env.AI_GATEWAY || 'bigmodel'];
  const hasKey = gw && gw.envKeys.some((k) => Boolean(process.env[k]));
  return { available: Boolean(hasKey) && process.env.AI_DISABLED !== '1', model: (process.env.AI_MODEL || gw?.model || '') + ' (' + (gw?.name || '?') + ')' };
}

function getSdk() {
  if (sdk) return sdk;
  loadEnv();
  const gwId = process.env.AI_GATEWAY || 'bigmodel';
  const gw = GATEWAYS[gwId];
  if (!gw) throw new Error('未知网关 AI_GATEWAY=' + gwId);
  const modelId = process.env.AI_MODEL || gw.model;
  const model = {
    api: gw.api,
    provider: gwId,
    baseUrl: gw.baseUrl,
    // anthropic 形状：model.reasoning=true 时适配器才往 body 写 thinking 字段；不请求档位即落成 thinking:{type:"disabled"}。
    // openai 形状必须保持 false，关思考走 samplingParams。
    reasoning: gw.api === 'anthropic-messages',
    ...(gw.compat ? { compat: { ...gw.compat } } : {}),
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 2048,
    id: modelId,
    name: modelId + ' (' + gw.name + ')',
  };
  const models = createModels();
  const provider = createProvider({
    id: gwId,
    name: gw.name,
    baseUrl: gw.baseUrl,
    auth: { apiKey: envApiKeyAuth(gw.name + ' API key', [...gw.envKeys]) },
    models: [model],
    api: gw.api === 'anthropic-messages' ? anthropicMessagesApi() : openAICompletionsApi(),
  });
  models.setProvider(provider);
  const m = models.getModel(gwId, modelId);
  if (!m) throw new Error('网关没有模型 ' + modelId);
  sdk = { models, model: m };
  return sdk;
}

// 一次调用：返回 {text, ms} 或抛错。思考显式关闭；温度 0.9 让台词有变化。
export async function complete(system, user, { timeoutMs = 20000 } = {}) {
  const { models, model } = getSdk();
  const t0 = Date.now();
  const context = { systemPrompt: system, messages: [{ role: 'user', content: user, timestamp: t0 }] };
  const options = { temperature: 0.9, maxTokens: 1024, samplingParams: { thinking: { type: 'disabled' } } };
  const run = async () => {
    if (typeof models.completeSimple === 'function') return models.completeSimple(model, context, options);
    const stream = models.streamSimple(model, context, options);
    return stream.result();
  };
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('模型超时')), timeoutMs));
  const msg = await Promise.race([run(), timeout]);
  if (msg.stopReason === 'error' || msg.stopReason === 'aborted') throw new Error(msg.errorMessage || msg.stopReason);
  const text = (msg.content || []).flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return { text, ms: Date.now() - t0 };
}

// 模型常把 JSON 包在围栏里；只取第一个大括号到最后一个大括号。
export function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}
