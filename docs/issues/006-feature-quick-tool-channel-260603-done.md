# 新增入口快速工具调用通道

| 字段 | 内容 |
| --- | --- |
| 编号 | 006 |
| 类型 | 功能 |
| 状态 | 已完成 |
| 时间 | 2026-06-03 |

## 背景

部分用户请求不需要进入完整 Pi Agent 模型任务，例如聚焦到某个文件、关闭右侧解释框或图形框。入口需要在意图识别前增加快速工具通道，命中后直接执行结构化前端动作。

## 目标

- 在服务端入口增加快速工具识别和执行通道。
- 快速工具集中放在独立目录，便于后续增量扩展。
- 支持聚焦当前文件或指定文件。
- 支持关闭右侧文本框和图形框浮层。
- 前端能消费快速工具返回的结构化动作。

## 实现内容

- 新增 `server/quickTools/` 目录管理快速工具。
- 新增 `focus_file` 快速工具，支持聚焦当前文件和按路径或文件名匹配工作区文件。
- 新增 `close_floating_widgets` 快速工具，支持关闭右侧 AI 解释和 Markdown 图形浮层。
- `PiAgentBridgeRuntime` 入口先执行快速工具识别，命中后直接返回结果，不再进入完整意图理解和任务模型。
- 将 `focus_file` 和 `close_floating_widgets` 同时注册为 Pi Agent 可调用工具；入口快速规则没命中时，模型仍可通过工具调用产出相同的前端动作。
- 任务执行阶段按意图启用自定义工具，`local_file_task` 默认不挂载相关文件和图工具；只有模块任务或明确需要图时才传对应工具。
- 精简任务执行基础提示词，把解释和图形的详细输出约束保留在工具参数描述中，避免基础提示词和工具 schema 重复。
- `AgentEditorResult` 新增 `quickActions` 字段，前端根据动作聚焦文件或关闭浮层。
- 前端发送新问题时先关闭右侧浮层，同时保留左侧相关文件状态；纯快速动作保留当前相关文件，模型返回展示结果时以模型结果为准。

## 修改文件清单

- `server/types.ts`
- `server/piAgentBridge.ts`
- `server/quickTools/*`
- `src/domain/agent.ts`
- `src/features/editor/useEditorWorkspace.ts`
- `docs/issues/006-feature-quick-tool-channel-260603-done.md`

## 验证结果

- `./build.sh` 通过
- 裁剪后任务执行基础提示词字符串从约 2348 字降到约 591 字
- 普通 `local_file_task` 默认启用 `show_explanation`、`focus_file`、`close_floating_widgets`
- `module_task` 默认启用 `show_explanation`、`show_related_files`、`show_markdown_diagram`、`focus_file`、`close_floating_widgets`
- 本地接口验证“关闭当前文本框和图形框”返回 `close_floating_widgets`
- 本地接口验证“聚焦到 README.md”返回 `focus_file` 和 `codeFocus`
- 构建存在 Vite 大体积产物警告，和本次快速工具通道改动无关
