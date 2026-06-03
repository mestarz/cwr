import { createAgentSession, defineTool, SessionManager, type AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { Type, type Model } from "@earendil-works/pi-ai";
import { resolve } from "node:path";
import type {
  AgentBridgeInput,
  AgentEditorResult,
  AgentFloatingWidget,
  AgentQuickAction,
  AgentStatusListener,
  AgentStatusUpdate,
  AgentTaskIntent,
  CodeFocus,
  RelatedFile
} from "./types.js";
import { understandTaskIntent } from "./intent/understandTaskIntent.js";
import { resolvePiAgentModel } from "./piAgentModels.js";
import { runQuickTool } from "./quickTools/index.js";
import { closeFloatingWidgetsTool } from "./quickTools/closeFloatingWidgetsTool.js";
import { focusFileTool } from "./quickTools/focusFileTool.js";
import { showExplanationSkill, showMarkdownDiagramSkill, showRelatedFilesSkill } from "./skills/index.js";

const builtinWorkspaceTools = ["read", "grep", "find", "ls"] as const;
const diagramRequestPattern = /图|流程|结构|链路|架构|mermaid|markdown|diagram|flow|chart/i;

const explanationParameters = Type.Object({
  title: Type.String({ description: "悬浮框标题" }),
  content: Type.String({
    maxLength: 300,
    description:
      "需要展示给用户的解释文本，必须控制在 300 字以内。除非用户明确询问实现细节，否则不要堆叠变量名、函数名、类型名等代码专有名词；优先把代码符号转换成它代表的职责、数据含义或业务动作。必须像人一样断句和分段，重点前置，避免把多个判断堆在一个长句里。"
  })
});

const markdownDiagramParameters = Type.Object({
  title: Type.String({ description: "悬浮框标题" }),
  diagramType: Type.Optional(
    Type.Union([Type.Literal("overview"), Type.Literal("module_detail")], {
      description:
        "图类型。overview 表示高层抽象图，只展示模块、阶段、职责和边界；module_detail 表示具体模块细节图，可以展示文件名、函数名、变量名、调用点等具体信息。"
    })
  ),
  markdown: Type.String({
    description:
      "纯 Markdown 内容，只能包含可直接渲染的 Markdown 或 mermaid 代码块，不要加入图外说明、前言、结论或解释文字；如果包含图，节点数量必须控制在 10 个以内。Mermaid 必须优先使用 flowchart TD/TB 的纵向布局，避免生成一条很长的 LR 横向链路；图的深度不能超过 4 层，任一层横向节点不能超过 4 个。overview 图必须高层抽象，不能展示变量名、函数名或文件细节；module_detail 图可以展示具体文件名、函数名、变量名、调用点，但仍要把细节归入模块或职责边界中。需要强调的节点必须在 Mermaid 内用 classDef/class 或 style 设置特殊颜色。"
  })
});

const relatedFilesParameters = Type.Object({
  files: Type.Array(
    Type.Object({
      path: Type.String({ description: "文件路径，必须来自用户提供的工作区上下文" }),
      reason: Type.String({ description: "该文件在该功能中的职责、使用范围、关键关系或为什么相关，面向用户展示" }),
      relevance: Type.Number({ description: "0 到 1 之间的相关度" })
    })
  )
});

const focusFileParameters = Type.Object({
  file: Type.String({ description: "需要聚焦的工作区文件路径，必须使用相对工程目录的路径" }),
  startLine: Type.Optional(Type.Number({ description: "可选，聚焦起始行号" })),
  endLine: Type.Optional(Type.Number({ description: "可选，聚焦结束行号" }))
});

const closeFloatingWidgetsParameters = Type.Object({});

export interface PiAgentBridge {
  run(input: AgentBridgeInput, onStatus?: AgentStatusListener): Promise<AgentEditorResult>;
}

export class PiAgentBridgeRuntime implements PiAgentBridge {
  async run(input: AgentBridgeInput, onStatus?: AgentStatusListener): Promise<AgentEditorResult> {
    const quickResult = await runQuickTool(input, onStatus);
    if (quickResult) {
      return quickResult;
    }

    onStatus?.({ message: "理解用户意图" });
    const intent = await understandTaskIntent(input, onStatus);
    onStatus?.({ message: "调用任务模型", detail: formatModelName(intent.modelProfile) });
    const floatingWidgets: AgentFloatingWidget[] = [];
    const relatedFiles: RelatedFile[] = [];
    const quickActions: AgentQuickAction[] = [];
    const workspaceRoot = resolve(input.workspaceRoot);
    const piModel = resolvePiAgentModel(intent.modelProfile);
    const enabledTools = getEnabledTools(input, intent);
    const { session } = await createAgentSession({
      cwd: workspaceRoot,
      ...piModel,
      customTools: createTools(floatingWidgets, relatedFiles, quickActions, enabledTools.customToolNames),
      sessionManager: SessionManager.inMemory(workspaceRoot),
      tools: enabledTools.toolNames
    });
    const selectedModelName = formatSelectedModelName(session.model) ?? formatModelName(intent.modelProfile);
    onStatus?.({ message: "已选择任务模型", detail: selectedModelName });

    const unsubscribe = session.subscribe((event) => {
      const status = toStatusUpdate(event, formatSelectedModelName(session.model) ?? selectedModelName);
      if (status) {
        onStatus?.(status);
      }
    });

    try {
      await session.prompt(createUserPrompt(input, intent, enabledTools.customToolNames));
    } finally {
      unsubscribe();
      session.dispose();
    }

    onStatus?.({ message: "整理执行结果" });

    return {
      intent,
      floatingWidgets,
      relatedFiles,
      codeFocus: getCodeFocus(quickActions, relatedFiles),
      quickActions
    };
  }
}

function createTools(
  floatingWidgets: AgentFloatingWidget[],
  relatedFiles: RelatedFile[],
  quickActions: AgentQuickAction[],
  enabledToolNames: string[]
) {
  const explanationTool = defineTool<typeof explanationParameters, AgentFloatingWidget>({
    name: showExplanationSkill.name,
    label: "展示 AI 解释",
    description: showExplanationSkill.description,
    parameters: explanationParameters,
    async execute(_toolCallId, params) {
      const widget = showExplanationSkill.call(params);
      floatingWidgets.push(widget);

      return {
        content: [{ type: "text", text: "AI 解释已展示给用户。" }],
        details: widget
      };
    }
  });

  const markdownDiagramTool = defineTool<typeof markdownDiagramParameters, AgentFloatingWidget>({
    name: showMarkdownDiagramSkill.name,
    label: "展示 Markdown 图",
    description: showMarkdownDiagramSkill.description,
    parameters: markdownDiagramParameters,
    async execute(_toolCallId, params) {
      const widget = showMarkdownDiagramSkill.call(params);
      floatingWidgets.push(widget);

      return {
        content: [{ type: "text", text: "Markdown 或图已展示给用户。" }],
        details: widget
      };
    }
  });

  const relatedFilesTool = defineTool<typeof relatedFilesParameters, RelatedFile[]>({
    name: showRelatedFilesSkill.name,
    label: "展示相关文件",
    description: showRelatedFilesSkill.description,
    parameters: relatedFilesParameters,
    async execute(_toolCallId, params) {
      const files = showRelatedFilesSkill.call(params);
      relatedFiles.push(...files);

      return {
        content: [{ type: "text", text: "相关文件已展示给用户。" }],
        details: files
      };
    }
  });

  const focusFileQuickTool = defineTool<typeof focusFileParameters, AgentQuickAction>({
    name: focusFileTool.name,
    label: "聚焦文件",
    description: `${focusFileTool.description} 当用户要求聚焦、定位、打开、切换到某个文件，但入口快速规则没有命中时调用。`,
    parameters: focusFileParameters,
    async execute(_toolCallId, params) {
      const action: AgentQuickAction = {
        type: "focus_file",
        file: params.file,
        startLine: params.startLine,
        endLine: params.endLine
      };
      quickActions.push(action);

      return {
        content: [{ type: "text", text: `已请求前端聚焦文件：${params.file}` }],
        details: action
      };
    }
  });

  const closeFloatingWidgetsQuickTool = defineTool<typeof closeFloatingWidgetsParameters, AgentQuickAction>({
    name: closeFloatingWidgetsTool.name,
    label: "关闭右侧浮层",
    description: `${closeFloatingWidgetsTool.description} 当用户要求关闭、隐藏、收起右侧解释框、文本框、Markdown 图或图形框，但入口快速规则没有命中时调用。`,
    parameters: closeFloatingWidgetsParameters,
    async execute() {
      const action: AgentQuickAction = {
        type: "close_floating_widgets"
      };
      quickActions.push(action);

      return {
        content: [{ type: "text", text: "已请求前端关闭右侧浮层。" }],
        details: action
      };
    }
  });

  const allTools = [
    explanationTool,
    markdownDiagramTool,
    relatedFilesTool,
    focusFileQuickTool,
    closeFloatingWidgetsQuickTool
  ];

  return allTools.filter((tool) => enabledToolNames.includes(tool.name));
}

function toStatusUpdate(event: AgentSessionEvent, selectedModelName?: string): AgentStatusUpdate | undefined {
  if (event.type === "agent_start") {
    return { message: "请求模型执行", detail: selectedModelName };
  }

  if (event.type === "tool_execution_start") {
    return {
      message: `调用工具：${getToolLabel(event.toolName)}`,
      detail: formatToolArgs(event.toolName, event.args)
    };
  }

  if (event.type === "tool_execution_end") {
    return {
      message: event.isError ? `工具失败：${getToolLabel(event.toolName)}` : `完成工具：${getToolLabel(event.toolName)}`
    };
  }

  if (event.type === "message_update") {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent.type === "text_delta") {
      return { message: "整理文字输出" };
    }
  }

  return undefined;
}

function getToolLabel(toolName: string) {
  const labels: Record<string, string> = {
    read: "读取文件",
    grep: "搜索内容",
    find: "查找文件",
    ls: "列目录",
    [showExplanationSkill.name]: "展示解释",
    [showMarkdownDiagramSkill.name]: "展示图",
    [showRelatedFilesSkill.name]: "展示相关文件",
    [focusFileTool.name]: "聚焦文件",
    [closeFloatingWidgetsTool.name]: "关闭右侧浮层"
  };

  return labels[toolName] ?? toolName;
}

function formatToolArgs(toolName: string, args: unknown) {
  if (!args || typeof args !== "object") {
    return undefined;
  }

  const input = args as Record<string, unknown>;

  if (toolName === "read") {
    return stringifyArgs(input, ["file", "path"]);
  }

  if (toolName === "grep") {
    return stringifyArgs(input, ["pattern", "path", "include"]);
  }

  if (toolName === "find") {
    return stringifyArgs(input, ["pattern", "path", "type"]);
  }

  if (toolName === "ls") {
    return stringifyArgs(input, ["path"]);
  }

  if (toolName === showRelatedFilesSkill.name && Array.isArray(input.files)) {
    return `${input.files.length} 个文件`;
  }

  if (toolName === showExplanationSkill.name || toolName === showMarkdownDiagramSkill.name) {
    return typeof input.title === "string" ? trimStatusText(input.title) : undefined;
  }

  if (toolName === focusFileTool.name) {
    return stringifyArgs(input, ["file", "startLine", "endLine"]);
  }

  if (toolName === closeFloatingWidgetsTool.name) {
    return "右侧解释和图形浮层";
  }

  return trimStatusText(JSON.stringify(input));
}

function stringifyArgs(input: Record<string, unknown>, keys: string[]) {
  const parts = keys.flatMap((key) => {
    const value = input[key];

    if (typeof value === "string" && value.length > 0) {
      return [`${key}=${value}`];
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return [`${key}=${String(value)}`];
    }

    return [];
  });

  return parts.length > 0 ? trimStatusText(parts.join(" ")) : undefined;
}

function trimStatusText(text: string) {
  return text.length > 96 ? `${text.slice(0, 96)}...` : text;
}

function formatModelName(profile: AgentTaskIntent["modelProfile"]) {
  return `${profile.provider}/${profile.name}`;
}

function formatSelectedModelName(model: Model<any> | undefined) {
  return model ? `${model.provider}/${model.id}` : undefined;
}

function getCodeFocus(quickActions: AgentQuickAction[], relatedFiles: RelatedFile[]): CodeFocus | undefined {
  const focusAction = getLastFocusAction(quickActions);

  if (focusAction) {
    return {
      file: focusAction.file,
      startLine: focusAction.startLine ?? 1,
      endLine: focusAction.endLine
    };
  }

  return relatedFiles[0]
    ? {
        file: relatedFiles[0].path,
        startLine: 1
      }
    : undefined;
}

function getLastFocusAction(quickActions: AgentQuickAction[]) {
  for (let index = quickActions.length - 1; index >= 0; index -= 1) {
    const action = quickActions[index];

    if (action.type === "focus_file") {
      return action;
    }
  }

  return undefined;
}

function getEnabledTools(input: AgentBridgeInput, intent: AgentTaskIntent) {
  const customToolNames = new Set<string>();

  if (intent.requiresExplanation) {
    customToolNames.add(showExplanationSkill.name);
  }

  if (intent.requiresWorkspaceSearch || intent.taskKind === "module_task") {
    customToolNames.add(showRelatedFilesSkill.name);
  }

  if (intent.requiresDiagram || diagramRequestPattern.test(input.message)) {
    customToolNames.add(showMarkdownDiagramSkill.name);
  }

  customToolNames.add(focusFileTool.name);
  customToolNames.add(closeFloatingWidgetsTool.name);

  return {
    customToolNames: [...customToolNames],
    toolNames: [...builtinWorkspaceTools, ...customToolNames]
  };
}

function createUserPrompt(input: AgentBridgeInput, intent: AgentTaskIntent, enabledToolNames: string[]) {
  const lines = [
    "你是 Emma Web 编辑器的代码阅读 Agent。",
    "必须通过可用工具向前端展示信息，不要依赖普通助手文本作为 UI 输出。",
    "面向用户的解释、图和相关文件必须使用对应工具；每个工具的参数说明就是输出格式约束。",
    "用户请求已经先经过意图理解，下面的意图结果是后续工具选择和模型路由的依据。",
    `意图理解结果：${JSON.stringify(intent)}`,
    `用户问题：${input.message}`,
    `工程目录：${input.workspaceRoot}`,
    `当前文件：${input.activeFile}`,
    input.selectedText ? `选中文本：\n${input.selectedText}` : "选中文本：无"
  ];

  if (enabledToolNames.includes(showExplanationSkill.name)) {
    lines.push(`需要解释代码或上下文时，调用 ${showExplanationSkill.name}。`);
  }

  if (enabledToolNames.includes(showMarkdownDiagramSkill.name)) {
    lines.push(`需要展示 Markdown、Mermaid 图、结构图或流程图时，调用 ${showMarkdownDiagramSkill.name}。`);
  }

  if (enabledToolNames.includes(showRelatedFilesSkill.name)) {
    lines.push(
      `需要列出相关文件时，先用 read/grep/find/ls 确认存在和关系，再调用 ${showRelatedFilesSkill.name}。不要把文件清单写进解释或图。`
    );
  }

  if (enabledToolNames.includes(focusFileTool.name)) {
    lines.push(`需要聚焦、定位、打开或切换文件时，调用 ${focusFileTool.name}。`);
  }

  if (enabledToolNames.includes(closeFloatingWidgetsTool.name)) {
    lines.push(`需要关闭、隐藏或收起右侧浮层时，调用 ${closeFloatingWidgetsTool.name}。`);
  }

  return lines.join("\n\n");
}
