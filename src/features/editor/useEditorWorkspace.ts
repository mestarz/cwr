import { useMemo, useState } from "react";
import type { AgentEditorResult, AgentQuickAction, WorkspaceFile } from "../../domain/agent";
import { sendAgentMessageStream } from "../../services/agentClient";

const initialResult: AgentEditorResult = {
  floatingWidgets: [],
  relatedFiles: []
};

export function useEditorWorkspace(workspaceRoot: string, initialFiles: WorkspaceFile[]) {
  const [files] = useState<WorkspaceFile[]>(initialFiles);
  const [activePath, setActivePath] = useState(initialFiles[0]?.path ?? "");
  const [selectedText, setSelectedText] = useState("");
  const [agentResult, setAgentResult] = useState(initialResult);
  const [isSending, setIsSending] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");

  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath),
    [activePath, files]
  );

  async function submitMessage(message: string) {
    if (!activeFile) {
      return;
    }

    setAgentResult((current) => ({
      ...current,
      floatingWidgets: []
    }));
    setIsSending(true);
    setAgentStatus("AI 正在执行：理解意图、选择模型并分析工作区");
    try {
      const result = await sendAgentMessageStream(
        {
          message,
          workspaceRoot,
          activeFile: activeFile.path,
          selectedText
        },
        (status) => {
          setAgentStatus(status.detail ? `AI 正在执行：${status.message} - ${status.detail}` : `AI 正在执行：${status.message}`);
        }
      );
      setAgentResult((current) => applyQuickActions(current, result));

      if (result.codeFocus && files.some((file) => file.path === result.codeFocus?.file)) {
        setActivePath(result.codeFocus.file);
      }

      for (const action of result.quickActions ?? []) {
        if (action.type === "focus_file" && files.some((file) => file.path === action.file)) {
          setActivePath(action.file);
        }
      }
    } catch (error) {
      setAgentResult({
        floatingWidgets: [
          {
            id: `system-error-${Date.now()}`,
            kind: "explanation",
            title: "请求失败",
            content: error instanceof Error ? error.message : String(error),
            skillName: "system_error"
          }
        ],
        relatedFiles: []
      });
    } finally {
      setIsSending(false);
      setAgentStatus("");
    }
  }

  return {
    workspaceRoot,
    files,
    activeFile,
    activePath,
    selectedText,
    agentResult,
    isSending,
    agentStatus,
    setActivePath,
    setSelectedText,
    submitMessage
  };
}

function applyQuickActions(current: AgentEditorResult, result: AgentEditorResult) {
  if (!result.quickActions?.length) {
    return result;
  }

  const base = hasDisplayResult(result) ? result : current;

  return result.quickActions.reduce(applyQuickAction, base);
}

function applyQuickAction(current: AgentEditorResult, action: AgentQuickAction): AgentEditorResult {
  if (action.type === "close_floating_widgets") {
    return {
      ...current,
      floatingWidgets: []
    };
  }

  return current;
}

function hasDisplayResult(result: AgentEditorResult) {
  return Boolean(result.intent) || result.floatingWidgets.length > 0 || result.relatedFiles.length > 0;
}
