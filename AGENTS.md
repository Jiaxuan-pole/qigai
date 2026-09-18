# AGENTS.md — 《今晚睡哪儿》工作约定（Codex 与 Claude 共读）

三人街头 100 日生存排程游戏。策划为 `01_100日版完整游戏策划与UI_v3.md`，数据为 `03_开发数据_商店物品愿望事件100日.json`，AI 接入契约为 `04_AI对话与随机事件接入约定.md`。这三份是规则真相；代码实现它们，不改写它们。

## 结构

- `server/server.js`：`node:http` 静态服务 + `/api/*` 模型代理，监听 `0.0.0.0:8787`，无框架、无构建步。
- `server/ai.js`：pi-ai 接 BigModel glm-5.2（anthropic-messages 形状，thinking 显式 disabled），密钥只在服务端。
- `public/`：浏览器端。`public/game/*.js` 是纯 ES module 引擎（浏览器与 `node --test` 共用），`public/ui/*.js` 只做渲染与事件绑定。
- `public/game/rules.js`：无状态纯函数（愿望压力、精神危机、疾病、卫生风险、赔率、救援期限、AI 输出校验）。
- `tests/*.test.js`：`node --test`，`node:assert/strict`。
- `scripts/`：跑批与自动对局脚本（平衡模拟等）。

## 命令

```bash
npm test          # node --test tests/*.test.js，必须全绿
npm start         # node server/server.js，打印局域网地址
```

## 铁律

1. **TDD**：先写失败测试看它红，再实现转绿。规则数值以三份策划文件为准；拿不准写「不确定」，不要猜。
2. **代码里不用 emoji**（源码、注释、日志、字符串）。注释只解释 WHY。
3. **不擅自 git 操作**：本目录不是 git 仓库，不要 `git init`、不要 commit。改动只落工作区。
4. **不碰派活单文件范围以外的文件**；工作区里可能有别人的进行中改动，范围外问题只在回执里报告。
5. **引擎纯函数**：`(state, input) -> { state, events }`，不用全局可变状态，不在引擎里访问 DOM、`localStorage`、`fetch`、`Date.now()`。随机全部走 `rng(seed, key)` 可复现哈希。
6. **UI 不直接改生命、钱、愿望**；所有状态变化只经引擎函数。AI 输出只能是文本与白名单选项标签，经校验才显示。
7. **数值全部是虚构游戏参数**：不写现实药名剂量、不写现实赌博策略。
8. **一个文件一种职责**，超过约 400 行就拆。不引第三方压缩 JS。运行时依赖只允许 `@earendil-works/pi-ai`。
9. 改动前后各跑一次 `npm test`；回执里贴命令输出末尾几行，逐文件一句改了什么、为什么。
