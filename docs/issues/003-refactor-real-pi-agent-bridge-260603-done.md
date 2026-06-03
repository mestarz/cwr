# 移除模拟逻辑并接入真实 Pi Agent Bridge

| 字段 | 内容 |
| --- | --- |
| 编号 | 003 |
| 类型 | 重构 |
| 状态 | 已完成 |
| 时间 | 2026-06-03 |

## 背景

项目后端必须直接使用 Pi Agent TypeScript 包，不能保留模拟 Agent 返回，否则后续真实集成会被假接口污染。

## 目标

- 删除前端示例工作区数据。
- 删除后端模拟 Agent Bridge。
- 使用 `@earendil-works/pi-coding-agent` 的 SDK 运行真实 Coding Agent，不在 Emma 后端单独解析模型。
- 将展示能力注册成 Pi Agent 工具。

## 实现内容

- `PiAgentBridgeRuntime` 通过 `createAgentSession()` 创建真实 Pi Coding Agent 会话。
- Emma 后端不传服务提供方、不传模型，默认模型和 A 键认证由 Pi 自己的设置、AuthStorage、ModelRegistry 处理。
- `show_explanation`、`show_markdown_diagram`、`show_related_files` 均以 Pi 自定义工具注册。
- 前端不再加载示例文件，文件列表来自 `/api/files`。
- API 错误会返回给前端并显示请求失败浮层。

## 修改文件清单

- `src/domain/agent.ts`
- `src/services/agentClient.ts`
- `src/features/editor/WorkspaceShell.tsx`
- `src/features/editor/useEditorWorkspace.ts`
- `server/index.ts`
- `server/piAgentBridge.ts`
- `server/skills/*`
- `server/workspaceFiles.ts`
- `docs/issues/001-feature-emma-editor-pi-agent-260603-done.md`
- `docs/issues/002-refactor-floating-agent-skills-260603-done.md`

## 验证结果

- `npm run check` 通过
- `npm run build` 通过
- `npm run server:build` 通过
- 真实 Pi Agent Bridge 后端启动通过
- `/api/files` 验证通过
- Emma 后端已移除服务提供方和模型选择逻辑，`/api/chat` 由 Pi Coding Agent 自己的默认模型和 A 键配置处理
