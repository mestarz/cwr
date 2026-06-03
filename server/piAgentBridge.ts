import { createAgentSession, defineTool, SessionManager } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { resolve } from "node:path";
import type { AgentBridgeInput, AgentEditorResult, AgentFloatingWidget, AgentTaskIntent, RelatedFile } from "./types.js";
import { understandTaskIntent } from "./intent/understandTaskIntent.js";
import { showExplanationSkill, showMarkdownDiagramSkill, showRelatedFilesSkill } from "./skills/index.js";

const explanationParameters = Type.Object({
  title: Type.String({ description: "悬浮框标题" }),
  content: Type.String({ description: "需要展示给用户的解释文本" })
});

const markdownDiagramParameters = Type.Object({
  title: Type.String({ description: "悬浮框标题" }),
  markdown: Type.String({ description: "Markdown 内容，可以包含 mermaid 代码块" })
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
  run(input: AgentBridgeInput): Promise<AgentEditorResult>;
}

export class PiAgentBridgeRuntime implements PiAgentBridge {
  async run(input: AgentBridgeInput): Promise<AgentEditorResult> {
    const intent = await understandTaskIntent(input);
    const floatingWidgets: AgentFloatingWidget[] = [];
    const relatedFiles: RelatedFile[] = [];
    const workspaceRoot = resolve(input.workspaceRoot);
    const { session } = await createAgentSession({
      cwd: workspaceRoot,
      customTools: createTools(floatingWidgets, relatedFiles),
      sessionManager: SessionManager.inMemory(workspaceRoot),
      tools: ["read", "grep", "find", "ls", showExplanationSkill.name, showMarkdownDiagramSkill.name, showRelatedFilesSkill.name]
    });

    try {
      await session.prompt(createUserPrompt(input, intent));
    } finally {
      session.dispose();
    }

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

function createUserPrompt(input: AgentBridgeInput, intent: AgentTaskIntent) {
  return [
    "你是 Emma Web 编辑器的代码阅读 Agent。",
    "必须通过可用工具向前端展示信息，不要依赖普通助手文本作为 UI 输出。",
    "用户请求已经先经过意图理解，下面的意图结果是后续工具选择和模型路由的依据。",
    `意图理解结果：${JSON.stringify(intent)}`,
    `如果需要解释代码或上下文，调用 ${showExplanationSkill.name}。`,
    `如果需要展示 Markdown、Mermaid 图、结构图或流程图，调用 ${showMarkdownDiagramSkill.name}。`,
    `如果需要列出和用户问题相关的文件，调用 ${showRelatedFilesSkill.name}。`,
    `当用户询问某个功能在哪些文件实现、涉及哪些文件、相关文件列表、调用链文件、某问题应该看哪些文件时，必须先用 read/grep/find/ls 分析工作区，再调用 ${showRelatedFilesSkill.name}。`,
    `不要把相关文件清单输出到 ${showExplanationSkill.name} 或 ${showMarkdownDiagramSkill.name}；左侧文件区只读取 ${showRelatedFilesSkill.name} 的结果。`,
    "每个相关文件的 reason 必须说明它在该功能中的职责、使用范围、关键关系或需要用户关注的原因。",
    "相关文件路径必须来自工作区或当前文件路径，不要编造路径。",
    `用户问题：${input.message}`,
    `工程目录：${input.workspaceRoot}`,
    `当前文件：${input.activeFile}`,
    input.selectedText ? `选中文本：\n${input.selectedText}` : "选中文本：无"
  ].join("\n\n");
}
