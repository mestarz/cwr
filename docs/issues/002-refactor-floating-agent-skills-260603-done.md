# 将 Agent 展示内容改为按需浮层和展示能力调用

| 字段 | 内容 |
| --- | --- |
| 编号 | 002 |
| 类型 | 重构 |
| 状态 | 已完成 |
| 时间 | 2026-06-03 |

## 背景

AI 解释和 Markdown 图不应作为左侧常驻面板存在。它们只应在 Agent 调用对应展示能力后出现，并且以前端右侧悬浮框呈现。

## 目标

- 移除 AI 解释和 Markdown 图的常驻面板。
- 将展示结果改为按需渲染的右侧浮层。
- 在服务端建立独立 `server/skills/` 目录存放展示型能力。
- Pi Agent Bridge 通过真实工具调用产出结构化前端浮层数据。

## 实现内容

- 将 `AgentEditorResult` 的 `explanation`、`markdown` 固定字段改为 `floatingWidgets`。
- 新增 `AgentFloatingStack` 右侧浮层组件。
- 左侧区域只保留相关文件列表。
- 新增 `show_explanation` 和 `show_markdown_diagram` 两个服务端展示能力。
- Pi Agent 工具调用展示能力生成浮层组件数据。

## 修改文件清单

- `AGENTS.md`
- `src/domain/agent.ts`
- `src/features/editor/WorkspaceShell.tsx`
- `src/features/editor/components/AgentFloatingStack.tsx`
- `src/features/editor/useEditorWorkspace.ts`
- `src/styles/global.css`
- `server/types.ts`
- `server/piAgentBridge.ts`
- `server/workspaceFiles.ts`
- `server/skills/*`

## 验证结果

- `npm run check` 通过
- `npm run build` 通过
- `npm run server:build` 通过
- `/api/chat` 返回 `floatingWidgets` 结构验证通过
