# 新增可配置意图识别和运行脚本

| 字段 | 内容 |
| --- | --- |
| 编号 | 004 |
| 类型 | 功能 |
| 状态 | 已完成 |
| 时间 | 2026-06-03 |

## 背景

Emma 编辑器需要在用户请求进入 Pi Agent 前先做意图理解，为后续 Codex 模型路由提供依据。同时项目需要稳定的本地构建、启动、重启和停止入口。

## 目标

- 增加配置驱动的意图理解阶段。
- 支持配置意图识别模型、轻任务模型和重任务模型。
- 将任务分类收敛为本地文件任务和模块级任务。
- 新增项目构建脚本和运行脚本。

## 实现内容

- 新增 `config/intent.config.json`，配置 `intent`、`local-file`、`module-work` 三个模型配置。
- 将意图理解切换为 `model` 模式，当前使用 `openai-codex/gpt-5.3-codex-spark`。
- 将轻任务配置为 `openai-codex/gpt-5.3-codex-spark`，重任务配置为 `openai-codex/gpt-5.5`。
- 将任务类型收敛为 `local_file_task` 和 `module_task`。
- Pi Agent Bridge 在运行前先执行意图理解，并将意图结果写入 prompt 和 API 返回。
- 新增 `build.sh` 和 `run.sh`，`run.sh` 支持默认启动、`-R` 重启、`-S` 停止。
- 后端根路径返回服务状态和前端地址，避免误打开后端端口时只看到“未找到”。

## 修改文件清单

- `config/intent.config.json`
- `server/intent/*`
- `server/types.ts`
- `server/piAgentBridge.ts`
- `server/index.ts`
- `src/domain/agent.ts`
- `build.sh`
- `run.sh`
- `.gitignore`

## 验证结果

- `npm run check` 通过
- `npm run build` 通过
- `npm run server:build` 通过
- `./build.sh` 通过
- `./run.sh -R` 通过
- 本地前端启动到 `http://127.0.0.1:5173`
- 本地后端启动到 `http://127.0.0.1:4174`
