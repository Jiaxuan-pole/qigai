import { mkdir, writeFile } from 'node:fs/promises';
import { loadData } from '../public/game/data.js';
import { buildSeeds, runStrategy, STRATEGY_IDS } from './autoplay/runner.js';
import { renderReport, summarizeRuns } from './autoplay/statistics.js';

const runs = Number.parseInt(process.env.SIM_RUNS || '200', 10);
const days = Number.parseInt(process.env.SIM_DAYS || '100', 10);
if (!Number.isInteger(runs) || runs < 1) throw new Error('SIM_RUNS 必须是正整数');
if (!Number.isInteger(days) || days < 1 || days > 100) throw new Error('SIM_DAYS 必须是 1 到 100 的整数');

await loadData();
const started = performance.now();
const seeds = buildSeeds(runs);
const entries = [];
const rawStrategies = [];
for (const strategyId of STRATEGY_IDS) {
  const result = await runStrategy(strategyId, seeds, days);
  entries.push({ id: result.id, label: result.label, summary: summarizeRuns(result.runs) });
  rawStrategies.push(result);
  process.stdout.write(`${result.label}策略完成：${result.runs.length} 局\n`);
}
const elapsedMs = performance.now() - started;
const command = runs === 200 && days === 100 ? 'npm run sim' : `SIM_RUNS=${runs} SIM_DAYS=${days} node scripts/autoplay.js`;
const report = renderReport(entries, { runs, days, elapsedMs, node: process.version, command });
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/平衡模拟报告.md', import.meta.url), report, 'utf8');
await mkdir(new URL('../docs/交办单2证据/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/交办单2证据/autoplay-runs.json', import.meta.url), JSON.stringify({
  meta: { runs, days, seeds, elapsedMs, node: process.version, command },
  strategies: rawStrategies,
}, null, 2), 'utf8');
process.stdout.write(`报告已生成：docs/平衡模拟报告.md；耗时 ${(elapsedMs / 1000).toFixed(2)} 秒\n`);
