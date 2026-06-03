import type { AgentBridgeInput, AgentEditorResult, AgentStatusListener, WorkspaceFile } from "../types.js";

export type QuickToolContext = {
  input: AgentBridgeInput;
  files: WorkspaceFile[];
  onStatus?: AgentStatusListener;
};

export type QuickTool = {
  name: string;
  description: string;
  tryRun(context: QuickToolContext): AgentEditorResult | undefined;
};
