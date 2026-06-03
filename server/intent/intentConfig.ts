import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AgentRoutingProfile, AgentTaskKind } from "../types.js";

export type IntentUnderstandingMode = "rules" | "model";

export type IntentModelProfileConfig = {
  provider: string;
  name: string;
  temperature: number;
  maxTokens: number;
  thinkingLevel?: string;
  purpose: string;
};

export type IntentTaskFlags = {
  requiresWorkspaceSearch: boolean;
  requiresCodeEdit: boolean;
  requiresDiagram: boolean;
  requiresExplanation: boolean;
};

export type IntentTaskConfig = {
  taskKind: AgentTaskKind;
  routingProfile: AgentRoutingProfile;
  description: string;
  keywords: string[];
  modelProfile: string;
  flags: IntentTaskFlags;
};

export type IntentConfig = {
  modelProfiles: Record<string, IntentModelProfileConfig>;
  intentUnderstanding: {
    mode: IntentUnderstandingMode;
    modelProfile: string;
  };
  tasks: IntentTaskConfig[];
  defaultTaskKind: AgentTaskKind;
};

const intentConfigPath = resolve(process.cwd(), "config/intent.config.json");

export async function loadIntentConfig(): Promise<IntentConfig> {
  return JSON.parse(await readFile(intentConfigPath, "utf8")) as IntentConfig;
}
