# Emma 网页端编辑器

Emma 网页端编辑器是一个面向代码阅读和编辑的浏览器工作台。项目使用 React、TypeScript、Vite、Monaco Editor 和本地 Node.js 后端，并通过 Pi Agent TypeScript SDK 提供智能分析能力。

当前编辑器的核心流程：

- 在初始页面选择本地工程目录。
- 在中间编辑器查看源码文件。
- 通过底部文本框向 Pi Agent 发送任务。
- 在顶部状态栏流式展示 Agent 当前执行步骤、工具调用和实际选中的模型。
- 在左侧展示和用户问题相关的文件，并为每个文件附带职责说明。
- 只有在 Agent 调用展示工具时，才在右侧悬浮显示 AI 解释或 Markdown/Mermaid 图。

## 功能

- **Pi Agent 集成**
  - 后端直接使用 `@earendil-works/pi-coding-agent` 的 TypeScript 能力。
  - 不调用本地 Pi 命令行进程。
  - 模型解析和认证走 Pi Agent / Pi AI 自带的注册表与认证存储。

- **可配置意图路由**
  - 用户请求先经过意图理解，再决定后续任务模型。
  - 任务路由分为两类：
    - `local_file_task`：函数级、文件级、选区级理解，或明确范围的单文件简单修改。
    - `module_task`：跨文件功能理解、相关文件定位、模块重构或大范围改造。
  - 模型配置位于 `config/intent.config.json`。

- **流式执行反馈**
  - 后端提供 `/api/chat/stream`，以 NDJSON 形式流式返回状态。
  - 前端状态栏展示 Agent 正在执行的动作。
  - 文件读取、内容搜索、文件查找、目录列表、解释展示、图展示、相关文件展示等工具调用都会反馈到界面。
  - 每次模型任务开始时会展示 Pi Agent 实际选中的模型。

- **相关文件工作流**
  - 相关文件展示在左侧文件栏，不混入解释文本。
  - 每个相关文件都会说明它在当前功能或模块中的职责。
  - 工作区扫描会尽量遵守 Git 忽略规则，避免把依赖和构建产物加入上下文。

- **Agent 悬浮展示组件**
  - AI 解释要求简短、自然，限制在 300 个中文字符以内。
  - Markdown/Mermaid 图以右侧悬浮框展示。
  - 图分为两种类型：
    - `overview`：高层抽象图，用于展示架构、模块职责、边界或流程。
    - `module_detail`：具体模块细节图，可以包含文件名、函数名、变量名和调用点。
  - Mermaid 图需要适配悬浮框：
    - 最多 10 个节点。
    - 深度最多 4 层。
    - 单层宽度最多 4 个节点。
    - 重点节点可以通过 Mermaid 的 `classDef` / `class` 或 `style` 高亮。

## 环境要求

- 建议使用 Node.js 20 或更新版本。
- npm。
- Pi Agent / Pi AI 所需凭据需要配置在环境变量或 `@earendil-works/pi-ai` 使用的认证存储中。

默认模型配置：

- 意图理解和轻任务：`openai-codex/gpt-5.3-codex-spark`
- 模块级任务：`openai-codex/gpt-5.5`

如果本地 Pi Agent 模型注册表中的名称不同，请修改 `config/intent.config.json`。

## 安装

```bash
npm install
```

## 构建

使用项目脚本：

```bash
./build.sh
```

该脚本会执行前端 TypeScript/Vite 构建和后端 TypeScript 构建。

## 运行

启动后端和前端：

```bash
./run.sh
```

重启两个服务：

```bash
./run.sh -R
```

停止两个服务：

```bash
./run.sh -S
```

默认本地地址：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:4174`

运行日志和进程号文件写入 `.runtime/`。

## 项目结构

```text
config/
  intent.config.json              意图路由和模型配置
server/
  index.ts                        本地接口服务
  piAgentBridge.ts                Pi Agent 主桥接和自定义展示工具
  piAgentModels.ts                Pi Agent 模型注册表和认证解析
  intent/                         意图理解逻辑
  skills/                         前端展示型能力
  workspaceFiles.ts               工作区文件发现和忽略规则处理
src/
  features/start/                 工程选择初始页面
  features/editor/                编辑器工作区界面
  services/agentClient.ts         接口请求和 NDJSON 流式客户端
  styles/global.css               全局样式
docs/issues/                      实现记录和已完成任务文档
```

## 配置

主配置文件是 `config/intent.config.json`。

关键字段：

- `modelProfiles`：路由使用的命名模型配置。
- `intentUnderstanding.mode`：意图理解模式，当前支持 `model` 和 `rules`。
- `intentUnderstanding.modelProfile`：意图理解使用的模型配置。
- `tasks`：任务定义和路由目标。
- `defaultTaskKind`：兜底任务类型。

当前路由示例：

- 本地文件任务使用 `local-file` 模型配置。
- 模块级任务使用 `module-work` 模型配置。

## 远程仓库

项目远程仓库：

```bash
git@github.com:mestarz/cwr.git
```
