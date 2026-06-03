import { createAgentSession, defineTool, SessionManager } from "@earendil-works/pi-coding-agent";
import { Type, type Model } from "@earendil-works/pi-ai";
import { resolve } from "node:path";
import type { AgentBridgeInput, AgentModelProfile, AgentStatusListener, AgentTaskIntent, AgentTaskKind } from "../types.js";
import { resolvePiAgentModel } from "../piAgentModels.js";
import type { IntentConfig, IntentModelProfileConfig, IntentTaskConfig } from "./intentConfig.js";
import { loadIntentConfig } from "./intentConfig.js";

type ModelIntentResponse = {
  taskKind: AgentTaskKind;
};

const emitTaskIntentToolName = "emit_task_intent";
const emitTaskIntentParameters = Type.Object({
  taskKind: Type.Union([Type.Literal("local_file_task"), Type.Literal("module_task")], {
    description: "只能选择 local_file_task 或 module_task"
  })
});

export async function understandTaskIntent(input: AgentBridgeInput, onStatus?: AgentStatusListener): Promise<AgentTaskIntent> {
  const config = await loadIntentConfig();

  if (config.intentUnderstanding.mode === "model") {
    return understandTaskIntentWithModel(input, config, onStatus);
  }

  return understandTaskIntentWithRules(input, config);
}

function understandTaskIntentWithRules(input: AgentBridgeInput, config: IntentConfig): AgentTaskIntent {
  const text = `${input.message}\n${input.selectedText}`.toLowerCase();
  const task = config.tasks.find((item) => includesAny(text, item.keywords)) ?? getDefaultTask(config);

  return toIntent(task, config, input.selectedText.length > 0);
}

async function understandTaskIntentWithModel(
  input: AgentBridgeInput,
  config: IntentConfig,
  onStatus?: AgentStatusListener
): Promise<AgentTaskIntent> {
  const modelProfile = getModelProfile(config.intentUnderstanding.modelProfile, config);
  onStatus?.({ message: "调用意图理解模型", detail: formatModelName(modelProfile) });

  let intent: AgentTaskIntent | undefined;
  const intentTool = defineTool<typeof emitTaskIntentParameters, AgentTaskIntent>({
    name: emitTaskIntentToolName,
    label: "记录任务意图",
    description: "返回 Emma 编辑器下一步执行所需的任务意图分类。只能在完成意图判断时调用。",
    promptSnippet: "Emit the classified Emma task intent as a terminating structured tool result.",
    promptGuidelines: [
      `必须调用 ${emitTaskIntentToolName} 返回意图分类，不要用普通文本回答。`,
      "只能在 local_file_task 和 module_task 之间二选一。",
      "函数级、文件级、当前选区理解，或明确范围的单文件简单修改，归为 local_file_task。",
      "跨文件功能模块理解、相关文件定位、架构链路分析、模块级重构或大范围改造，归为 module_task。",
      "如果有选中文本且用户没有明显跨文件或模块诉求，优先 local_file_task。"
    ],
    parameters: emitTaskIntentParameters,
    async execute(_toolCallId, params) {
      intent = normalizeModelIntent(params, config, input.selectedText.length > 0);

      return {
        content: [{ type: "text", text: "意图理解结果已记录。" }],
        details: intent,
        terminate: true
      };
    }
  });

  const workspaceRoot = resolve(input.workspaceRoot);
  const piModel = resolvePiAgentModel(modelProfile);
  const { session } = await createAgentSession({
    cwd: workspaceRoot,
    ...piModel,
    customTools: [intentTool],
    sessionManager: SessionManager.inMemory(workspaceRoot),
    tools: [emitTaskIntentToolName]
  });
  onStatus?.({
    message: "已选择意图理解模型",
    detail: formatSelectedModelName(session.model) ?? formatModelName(modelProfile)
  });

  try {
    await session.prompt(createIntentPrompt(input, config));
  } finally {
    session.dispose();
  }

  if (!intent) {
    throw new Error(`Pi Agent 意图理解失败：模型未调用 ${emitTaskIntentToolName}。`);
  }

  return intent;
}

function createIntentPrompt(input: AgentBridgeInput, config: IntentConfig) {
  return [
    "你是 Emma 编辑器的意图理解器，只负责判断用户请求类型，不执行代码任务。",
    `必须调用 ${emitTaskIntentToolName} 工具，只输出 taskKind。不要输出普通文本。`,
    "候选任务：",
    config.tasks.map((task) => `- ${task.taskKind}: ${task.description}`).join("\n"),
    "分类规则：",
    "local_file_task：函数级、文件级、当前选区理解，局部解释，或用户已经给出明确范围的单文件简单修改。",
    "module_task：跨文件、功能模块级理解、相关文件定位、调用链/架构/流程分析、模块级重构或大范围改造。",
    "如果有选中文本且用户没有明显跨文件或模块诉求，优先 local_file_task。",
    `用户问题：${input.message}`,
    `工程目录：${input.workspaceRoot}`,
    `当前文件：${input.activeFile}`,
    input.selectedText ? `选中文本：\n${input.selectedText}` : "选中文本：无"
  ].join("\n\n");
}

function normalizeModelIntent(
  response: ModelIntentResponse,
  config: IntentConfig,
  hasSelectedText: boolean
): AgentTaskIntent {
  const task = config.tasks.find((item) => item.taskKind === response.taskKind) ?? getDefaultTask(config);

  return toIntent(task, config, hasSelectedText);
}

function toIntent(task: IntentTaskConfig, config: IntentConfig, hasSelectedText: boolean): AgentTaskIntent {
  return {
    taskKind: task.taskKind,
    routingProfile: task.routingProfile,
    modelProfile: getModelProfile(task.modelProfile, config),
    requiresWorkspaceSearch: task.flags.requiresWorkspaceSearch,
    requiresCodeEdit: task.flags.requiresCodeEdit,
    requiresDiagram: task.flags.requiresDiagram,
    requiresExplanation: task.flags.requiresExplanation || hasSelectedText
  };
}

function getModelProfile(id: string, config: IntentConfig): AgentModelProfile {
  const profile = config.modelProfiles[id];

  if (!profile) {
    throw new Error(`意图配置引用了不存在的模型配置：${id}`);
  }

  return toModelProfile(id, profile);
}

function toModelProfile(id: string, profile: IntentModelProfileConfig): AgentModelProfile {
  return {
    id,
    provider: profile.provider,
    name: profile.name,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
    thinkingLevel: profile.thinkingLevel,
    purpose: profile.purpose
  };
}

function formatModelName(profile: AgentModelProfile) {
  return `${profile.provider}/${profile.name}`;
}

function formatSelectedModelName(model: Model<any> | undefined) {
  return model ? `${model.provider}/${model.id}` : undefined;
}

function getDefaultTask(config: IntentConfig) {
  const task = config.tasks.find((item) => item.taskKind === config.defaultTaskKind);

  if (!task) {
    throw new Error(`意图配置缺少默认任务：${config.defaultTaskKind}`);
  }

  return task;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}
