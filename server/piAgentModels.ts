import { AuthStorage, ModelRegistry, type CreateAgentSessionOptions } from "@earendil-works/pi-coding-agent";
import type { AgentModelProfile } from "./types.js";

type PiThinkingLevel = NonNullable<CreateAgentSessionOptions["thinkingLevel"]>;

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

export type PiAgentModelOptions = Pick<
  CreateAgentSessionOptions,
  "authStorage" | "model" | "modelRegistry" | "thinkingLevel"
>;

export function resolvePiAgentModel(profile: AgentModelProfile): PiAgentModelOptions {
  if (!profile.provider || !profile.name) {
    throw new Error(`Pi Agent 模型配置缺少服务提供方或模型名称：${profile.id}`);
  }

  const loadError = modelRegistry.getError();
  if (loadError) {
    throw new Error(`Pi Agent 模型配置加载失败：${loadError}`);
  }

  const model = modelRegistry.find(profile.provider, profile.name);
  if (!model) {
    throw new Error(
      [
        `Pi Agent 模型配置未找到：${profile.provider}/${profile.name}`,
        `模型配置=${profile.id}`,
        `已加载模型=${listLoadedModels()}`
      ].join("\n")
    );
  }

  return {
    authStorage,
    model,
    modelRegistry,
    ...(profile.thinkingLevel ? { thinkingLevel: profile.thinkingLevel as PiThinkingLevel } : {})
  };
}

function listLoadedModels() {
  const models = modelRegistry.getAll().map((model) => `${model.provider}/${model.id}`);

  if (models.length === 0) {
    return "无";
  }

  return models.slice(0, 80).join(", ");
}
