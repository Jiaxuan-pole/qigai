# 自动对局代码审查（最终复核）

审查范围：`scripts/autoplay.js`、`scripts/autoplay/*.js`、`tests/autoplay.test.js`、`docs/平衡模拟报告.md`、`docs/交办单2证据/autoplay-runs.json`，以及交办补充的 `docs/交办单2证据/autoplay/compliance-{red,green}.log`。

结论：**WATCH / APPROVE**。没有阻断项。

## CRITICAL

无。

## HIGH

无。

## MEDIUM

1. **预检恢复的回归测试是间接断言。**
   - [tests/autoplay.test.js:81](../../tests/autoplay.test.js#L81) 只验证固定 seed 在预检失败后可推进至天数阈值，未直接锁定“同一 slot 仅重排并重新结算一次”。当前行为已由真实对局覆盖，故不阻断；将来重构恢复流程时应加入受控前置状态的精确断言。

2. **`runner.js` 为 271 纯代码行，超过 `remove-ai-slops` 的 250 行建议上限。**
   - [scripts/autoplay/runner.js](../../scripts/autoplay/runner.js) 混合命令执行、失败恢复、票券处理、统计采样和主循环。当前没有可见功能回归，故记录为维护性观察项。

## LOW

无。

## 已核实项

- [docs/平衡模拟报告.md:45](../../docs/平衡模拟报告.md#L45)、`:93`、`:141` 已包含三个策略的 sparkline 表；[docs/平衡模拟报告.md:166](../../docs/平衡模拟报告.md#L166) 已包含 `foodPrice`/`items.meal.price` 核对与 `foodPerLivingActorPerDay` 仅影响预留的修正建议；[同文件:170](../../docs/平衡模拟报告.md#L170) 已含均衡策略普通日偏高的参数建议。报告与当前生成器的输出结构一致。
- `forecast(seed, day)` 是交办单允许的玩家公开预报来源，[observe.js:78](../../scripts/autoplay/observe.js#L78) 合规；`events.reserved` 也是允许的可见投影字段。
- [observe.js:41](../../scripts/autoplay/observe.js#L41)-[observe.js:47](../../scripts/autoplay/observe.js#L47) 不导出彩票 `payout`、`face`；[observe.js:82](../../scripts/autoplay/observe.js#L82) 过滤隐藏事件。
- `node --test tests/autoplay.test.js` 当前 8/8 通过；所有自动对局脚本通过 `node --check`。补充的博彩额度与 checkpoint `null` 过滤 RED/GREEN 证据存在，且现实现与测试一致。
- 三策略意图使用投影与公开引擎接口。赌徒“先牌局、后留第二额度购票”的逻辑位于 [policies.js:58](../../scripts/autoplay/policies.js#L58)-[policies.js:65](../../scripts/autoplay/policies.js#L65)，专项测试覆盖该分支。
- 成功 `settle` 后才统计计划与转换（[runner.js:240](../../scripts/autoplay/runner.js#L240)-[runner.js:255](../../scripts/autoplay/runner.js#L255)）；疾病按 `actorId:diseaseUid`、断供按夜间自然日去重（[runner.js:21](../../scripts/autoplay/runner.js#L21)-[runner.js:35](../../scripts/autoplay/runner.js#L35)）。
- 原始证据为每策略 200 局、种子 1000–1199、600 局共 64.90 秒；所有局满足 `completedDay100 === (completedDays >= 100)`。引擎专项确认的 3 个 `npm test` 失败不属于 autoplay 范围，未作为本审查阻断。
- `programming` 与 `remove-ai-slops` 视角检查已运行。前者未发现无类型逃逸、与目标无关的生产解析/规范化或脆弱的提示词测试；后者未发现删除式测试、仅镜像实现常量的测试或与目标无关的生产复杂度。`runner.js` 的模块长度是唯一的 `remove-ai-slops` 维护性观察项。

## Blockers

无。

