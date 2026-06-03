# 新增 Emma Web 编辑器基础骨架

| 字段 | 内容 |
| --- | --- |
| 编号 | 001 |
| 类型 | 功能 |
| 状态 | 已完成 |
| 时间 | 2026-06-03 |

## 背景

项目需要开发 Web 端 Emma 编辑器，一期通过文本框向 Pi Agent 发送信息，并在前端展示代码、AI 解释、Markdown/图和相关文件。

## 目标

- 建立 React + TypeScript + Vite 项目骨架。
- 拆分前端展示层、状态层、API 调用层。
- 建立 TypeScript 后端 Pi Agent Bridge 边界。
- 后端通过 Pi Agent TypeScript 包承接 Agent 调用。

## 实现内容

- 新增 Vite、TypeScript、React 基础配置。
- 新增 Emma 编辑器主界面：左侧文件列表、中间代码展示、底部文本输入。
- 新增 Markdown 预览组件，并支持 Mermaid 图渲染。
- 新增前端 Agent 接口客户端和共享数据类型。
- 新增后端 `/api/files` 和 `/api/chat` 接口。
- 新增 `PiAgentBridge` 接口与真实 Pi Agent Bridge 实现。

## 修改文件清单

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `index.html`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/domain/agent.ts`
- `src/services/agentClient.ts`
- `src/features/editor/*`
- `src/styles/global.css`
- `server/*`
- `AGENTS.md`

## 验证结果

- `npm run check` 通过
- `npm run build` 通过
- `npm run server:dev` 启动成功
- 后端 `/api/files` 和 `/api/chat` 验证通过
- Vite 代理 `/api/files` 验证通过
- 构建存在 Monaco/Mermaid 引起的大体积产物警告，最小可用阶段暂不拆包
