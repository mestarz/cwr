import { completeSimple, getModel, type Context } from "@earendil-works/pi-ai";
import type { AgentBridgeInput, AgentModelProfile, AgentRoutingProfile, AgentTaskIntent } from "../types.js";
import type { IntentConfig, IntentModelProfileConfig, IntentTaskConfig } from "./intentConfig.js";
import { loadIntentConfig } from "./intentConfig.js";

type ModelIntentResponse = Partial<AgentTaskIntent>;

export async function understandTaskIntent(input: AgentBridgeInput): Promise<AgentTaskIntent> {
  const config = await loadIntentConfig();

  if (config.intentUnderstanding.mode === "model") {
    return understandTaskIntentWithModel(input, config);
  }

  return understandTaskIntentWithRules(input, config);
}

function understandTaskIntentWithRules(input: AgentBridgeInput, config: IntentConfig): AgentTaskIntent {
  const text = `${input.message}\n${input.selectedText}`.toLowerCase();
  const task = config.tasks.find((item) => includesAny(text, item.keywords)) ?? getDefaultTask(config);

  return toIntent(task, config, input.selectedText.length > 0);
}

async function understandTaskIntentWithModel(input: AgentBridgeInput, config: IntentConfig): Promise<AgentTaskIntent> {
  const modelProfile = getModelProfile(config.intentUnderstanding.modelProfile, config);

  if (!modelProfile.provider || !modelProfile.name) {
    throw new Error("意图理解配置为 model 模式时，必须填写 intentUnderstanding.modelProfile 对应模型的 provider 和 name。");
  }

  const context: Context = {
    systemPrompt: createIntentSystemPrompt(config),
    messages: [
      {
        role: "user",
        content: createIntentUserPrompt(input),
        timestamp: Date.now()
      }
    ]
  };
  const model = getModel(modelProfile.provider as never, modelProfile.name as never);
  const message = await completeSimple(model, context, {
    temperature: modelProfile.temperature,
    maxTokens: modelProfile.maxTokens
  });
  const parsed = parseModelIntentResponse(extractText(message.content));

  return normalizeModelIntent(parsed, config, input.selectedText.length > 0);
}

function createIntentSystemPrompt(config: IntentConfig) {
  return [
    "你是 Emma 编辑器的意图理解器，只负责判断用户请求类型，不执行代码任务。",
    "必须只返回 JSON，不要返回 Markdown、解释文本或代码块。",
    "JSON 字段必须包含：taskKind、routingProfile、requiresWorkspaceSearch、requiresCodeEdit、requiresDiagram、requiresExplanation、confidence、reason。",
    "taskKind 和 routingProfile 只能从以下任务配置中选择；modelProfile 由服务端根据 taskKind 从配置推导，不需要你输出。",
    JSON.stringify(
      config.tasks.map((task) => ({
        taskKind: task.taskKind,
        routingProfile: task.routingProfile,
        modelProfile: task.modelProfile,
        description: task.description,
        flags: task.flags
      })),
      null,
      2
    )
  ].join("\n\n");
}

function createIntentUserPrompt(input: AgentBridgeInput) {
  return [
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
  const modelProfile = getModelProfile(task.modelProfile, config);

  return {
    taskKind: task.taskKind,
    routingProfile: isRoutingProfile(response.routingProfile) ? response.routingProfile : task.routingProfile,
    modelProfile,
    requiresWorkspaceSearch: typeof response.requiresWorkspaceSearch === "boolean" ? response.requiresWorkspaceSearch : task.flags.requiresWorkspaceSearch,
    requiresCodeEdit: typeof response.requiresCodeEdit === "boolean" ? response.requiresCodeEdit : task.flags.requiresCodeEdit,
    requiresDiagram: typeof response.requiresDiagram === "boolean" ? response.requiresDiagram : task.flags.requiresDiagram,
    requiresExplanation:
      typeof response.requiresExplanation === "boolean"
        ? response.requiresExplanation || hasSelectedText
        : task.flags.requiresExplanation || hasSelectedText,
    confidence: typeof response.confidence === "number" ? response.confidence : task.confidence,
    reason: typeof response.reason === "string" && response.reason.length > 0 ? response.reason : task.description
  };
}

function toIntent(task: IntentTaskConfig, config: IntentConfig, hasSelectedText: boolean): AgentTaskIntent {
  return {
    taskKind: task.taskKind,
    routingProfile: task.routingProfile,
    modelProfile: getModelProfile(task.modelProfile, config),
    requiresWorkspaceSearch: task.flags.requiresWorkspaceSearch,
    requiresCodeEdit: task.flags.requiresCodeEdit,
    requiresDiagram: task.flags.requiresDiagram,
    requiresExplanation: task.flags.requiresExplanation || hasSelectedText,
    confidence: hasSelectedText && task.taskKind === "local_file_task" ? Math.max(task.confidence, 0.82) : task.confidence,
    reason: task.description
  };
}

function getModelProfile(id: string, config: IntentConfig): AgentModelProfile {
  const profile = config.modelProfiles[id];

  if (!profile) {
    throw new Error(`意图配置引用了不存在的模型 profile：${id}`);
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

function getDefaultTask(config: IntentConfig) {
  const task = config.tasks.find((item) => item.taskKind === config.defaultTaskKind);

  if (!task) {
    throw new Error(`意图配置缺少默认任务：${config.defaultTaskKind}`);
  }

  return task;
}

function parseModelIntentResponse(text: string): ModelIntentResponse {
  return JSON.parse(stripJsonFence(text)) as ModelIntentResponse;
}

function stripJsonFence(text: string) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (match?.[1] ?? text).trim();
}

function extractText(content: Awaited<ReturnType<typeof completeSimple>>["content"]) {
  return content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function isRoutingProfile(value: unknown): value is AgentRoutingProfile {
  return value === "local_file" || value === "module_work";
}
