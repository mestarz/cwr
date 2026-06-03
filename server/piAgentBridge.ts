import { createAgentSession, defineTool, SessionManager, type AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { Type, type Model } from "@earendil-works/pi-ai";
import { resolve } from "node:path";
import type { AgentBridgeInput, AgentEditorResult, AgentFloatingWidget, AgentStatusListener, AgentStatusUpdate, AgentTaskIntent, RelatedFile } from "./types.js";
import { understandTaskIntent } from "./intent/understandTaskIntent.js";
import { resolvePiAgentModel } from "./piAgentModels.js";
import { showExplanationSkill, showMarkdownDiagramSkill, showRelatedFilesSkill } from "./skills/index.js";

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

export interface PiAgentBridge {
  run(input: AgentBridgeInput, onStatus?: AgentStatusListener): Promise<AgentEditorResult>;
}

export class PiAgentBridgeRuntime implements PiAgentBridge {
  async run(input: AgentBridgeInput, onStatus?: AgentStatusListener): Promise<AgentEditorResult> {
    onStatus?.({ message: "理解用户意图" });
    const intent = await understandTaskIntent(input, onStatus);
    onStatus?.({ message: "调用任务模型", detail: formatModelName(intent.modelProfile) });
    const floatingWidgets: AgentFloatingWidget[] = [];
    const relatedFiles: RelatedFile[] = [];
    const workspaceRoot = resolve(input.workspaceRoot);
    const piModel = resolvePiAgentModel(intent.modelProfile);
    const { session } = await createAgentSession({
      cwd: workspaceRoot,
      ...piModel,
      customTools: createTools(floatingWidgets, relatedFiles),
      sessionManager: SessionManager.inMemory(workspaceRoot),
      tools: ["read", "grep", "find", "ls", showExplanationSkill.name, showMarkdownDiagramSkill.name, showRelatedFilesSkill.name]
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
      await session.prompt(createUserPrompt(input, intent));
    } finally {
      unsubscribe();
      session.dispose();
    }

    onStatus?.({ message: "整理执行结果" });

    return {
      intent,
      floatingWidgets,
      relatedFiles,
      codeFocus: relatedFiles[0]
        ? {
            file: relatedFiles[0].path,
            startLine: 1
          }
        : undefined
    };
  }
}

function createTools(
  floatingWidgets: AgentFloatingWidget[],
  relatedFiles: RelatedFile[]
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

  return [explanationTool, markdownDiagramTool, relatedFilesTool];
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
    [showRelatedFilesSkill.name]: "展示相关文件"
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

function createUserPrompt(input: AgentBridgeInput, intent: AgentTaskIntent) {
  return [
    "你是 Emma Web 编辑器的代码阅读 Agent。",
    "必须通过可用工具向前端展示信息，不要依赖普通助手文本作为 UI 输出。",
    "所有面向用户展示的解释文字必须控制在 300 字以内。",
    "解释文本要面向正在理解功能的人，而不是复述源码。非必要不要输出变量名、函数名、类型名或内部字段名。",
    "当代码符号可以被翻译成含义时，必须优先说含义：例如不要说“改写某个 prompt 变量”，而要说“优化用于生成提示词的内容”。",
    "只有在用户明确要求定位具体实现、接口名、变量名、调用点，或不写名称会影响准确性时，才保留代码专有名词。",
    "解释文本必须像人说话一样有断句和语气重点。优先使用 2 到 4 个短句或短段落，不要把原因、动作、结果堆成一整段长句。",
    "每段只表达一个重点；先说结论，再补充原因或影响。",
    "Markdown、Mermaid、结构图或流程图必须保持精简；如果包含图，图中的节点数量不能超过 10 个。",
    "图分为两类：overview 高层抽象图，module_detail 具体模块细节图。",
    "overview 图只表达模块、阶段、职责、边界、数据流或调用关系的高层结构；禁止展示变量名、函数名、具体文件路径、字段名等实现细节。",
    "module_detail 图用于解释某个具体模块内部实现，可以展示文件名、函数名、变量名、关键字段、调用点或具体入口，但必须围绕模块职责组织，不要把代码逐行翻译成节点。",
    "生成 Mermaid 图时必须优先考虑右侧悬浮框展示效果。默认使用 flowchart TD 或 flowchart TB，不要默认使用 LR。",
    "只有 4 个以内节点的简单线性流程才允许使用 LR；5 个以上节点禁止画成一条横向长链。",
    "图的深度不能超过 4 层，任一层横向节点不能超过 4 个；不要生成 5 层以上的纵向深链，也不要生成单层 5 个以上节点的横向宽链。",
    "如果原始流程超过这些限制，必须先做抽象归并：把细碎实现步骤合并成模块、阶段、职责或边界，再画模块之间的关系。",
    "图应该表达抽象结构和模块解耦关系，而不是把每个变量、函数、请求步骤都画成节点。",
    "如果流程超过 5 个节点，优先拆成 2 到 4 层：上层放入口/输入/触发，中层放分析/路由/处理，下层放输出/展示/结果；能分组时使用 subgraph。",
    "节点标签必须短，优先用 2 到 6 个中文词表达职责；不要把变量名、长句或完整解释放进节点。",
    "如果同时展示解释文本和图，解释文本里强调的关键节点必须在图中同步高亮。",
    "Mermaid 高亮节点必须直接写在 markdown 中：优先使用 classDef focus fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#111827; 并用 class 节点ID focus 标记重点节点。必要时可以使用 style 单独标记。",
    "用户请求已经先经过意图理解，下面的意图结果是后续工具选择和模型路由的依据。",
    `意图理解结果：${JSON.stringify(intent)}`,
    `如果需要解释代码或上下文，调用 ${showExplanationSkill.name}。`,
    `如果需要展示 Markdown、Mermaid 图、结构图或流程图，调用 ${showMarkdownDiagramSkill.name}。必须先选择 diagramType：overview 用于高层抽象图，module_detail 用于具体模块细节图。markdown 字段必须是纯 Markdown 或纯 mermaid 代码块，可直接渲染；不要夹带图外说明文字，并确保图节点数量不超过 10 个。Mermaid 图默认使用 TD/TB 纵向或分层布局，禁止把 5 个以上节点画成 LR 横向长链；深度不超过 4 层，任一层宽度不超过 4 个节点，超过时先做模块抽象和职责归并。需要强调的节点必须用 classDef/class 或 style 着色。`,
    `如果需要列出和用户问题相关的文件，调用 ${showRelatedFilesSkill.name}。`,
    `当用户询问某个功能在哪些文件实现、涉及哪些文件、相关文件列表、调用链文件、某问题应该看哪些文件时，必须先用 read/grep/find/ls 分析工作区，再调用 ${showRelatedFilesSkill.name}。`,
    `不要把相关文件清单输出到 ${showExplanationSkill.name} 或 ${showMarkdownDiagramSkill.name}；左侧文件区只读取 ${showRelatedFilesSkill.name} 的结果。`,
    `调用 ${showRelatedFilesSkill.name} 时只提交已经确认存在且确实相关的文件，不要提交不确定、猜测、泛相关或低相关文件。`,
    "每个相关文件的 reason 必须说明它在该功能中的职责、使用范围、关键关系或需要用户关注的原因。",
    "相关文件路径必须来自工作区或当前文件路径，不要编造路径。",
    `用户问题：${input.message}`,
    `工程目录：${input.workspaceRoot}`,
    `当前文件：${input.activeFile}`,
    input.selectedText ? `选中文本：\n${input.selectedText}` : "选中文本：无"
  ].join("\n\n");
}
