# 统一项目文档和可见提示为中文

| 字段 | 内容 |
| --- | --- |
| 编号 | 005 |
| 类型 | 文档 |
| 状态 | 已完成 |
| 时间 | 2026-06-03 |

## 背景

项目需要统一中文表达，文档、注释和面向用户的提示不应混用英文说明。代码标识符、包名、命令、路径和协议字段需要保留原文，避免破坏运行逻辑。

## 目标

- 将 README 改为中文说明。
- 将任务文档中的状态、类型和描述性英文改为中文。
- 将 AGENTS 规范中的描述性英文改为中文。
- 将启动脚本、服务日志和前端请求错误中的可见英文改为中文。

## 实现内容

- 重写 `README.md`，保留必要的命令、路径、包名和枚举值。
- 更新历史任务文档中的类型、状态和描述用语。
- 更新 `AGENTS.md` 中的文档规范、提交规范和核心接口说明。
- 更新 `run.sh` 的启动、停止、重启和错误输出文案。
- 更新后端 404 和服务启动日志。
- 更新前端 Agent 请求失败、流式响应异常和工作区文件请求失败提示。

## 修改文件清单

- `README.md`
- `AGENTS.md`
- `docs/issues/001-feature-emma-editor-pi-agent-260603-done.md`
- `docs/issues/002-refactor-floating-agent-skills-260603-done.md`
- `docs/issues/003-refactor-real-pi-agent-bridge-260603-done.md`
- `docs/issues/004-feature-configurable-intent-routing-260603-done.md`
- `docs/issues/005-docs-chinese-text-normalization-260603-done.md`
- `run.sh`
- `server/index.ts`
- `server/intent/understandTaskIntent.ts`
- `server/piAgentModels.ts`
- `src/services/agentClient.ts`

## 验证结果

- `./build.sh` 通过
- 构建存在 Vite 大体积产物警告，和本次中文化改动无关
