import type { AgentBridgeInput, AgentEditorResult, AgentStatusListener } from "../types.js";
import { loadWorkspaceFiles } from "../workspaceFiles.js";
import { closeFloatingWidgetsTool } from "./closeFloatingWidgetsTool.js";
import { focusFileTool } from "./focusFileTool.js";
import type { QuickTool } from "./types.js";

const quickTools: QuickTool[] = [closeFloatingWidgetsTool, focusFileTool];

export async function runQuickTool(input: AgentBridgeInput, onStatus?: AgentStatusListener): Promise<AgentEditorResult | undefined> {
  onStatus?.({ message: "识别快速工具" });

  const files = await loadWorkspaceFiles(input.workspaceRoot);

  for (const tool of quickTools) {
    const result = tool.tryRun({ input, files, onStatus });

    if (result) {
      return result;
    }
  }

  return undefined;
}
