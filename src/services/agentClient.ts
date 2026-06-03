import type {
  AgentChatRequest,
  AgentEditorResult,
  AgentErrorResponse,
  AgentStatusUpdate,
  WorkspaceDirectoryListing,
  WorkspaceFile
} from "../domain/agent";

export async function sendAgentMessage(request: AgentChatRequest): Promise<AgentEditorResult> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const body = (await response.json()) as AgentEditorResult | AgentErrorResponse;

  if ("error" in body) {
    throw new Error("error" in body ? body.error : "Agent request failed");
  }

  return body;
}

type AgentStreamClientEvent =
  | {
      type: "status";
      status: AgentStatusUpdate;
    }
  | {
      type: "result";
      result: AgentEditorResult;
    }
  | {
      type: "error";
      error: string;
    };

export async function sendAgentMessageStream(
  request: AgentChatRequest,
  onStatus: (status: AgentStatusUpdate) => void
): Promise<AgentEditorResult> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Agent stream request failed: HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Agent stream response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseStreamEvent(line);

      if (event.type === "status") {
        onStatus(event.status);
      } else if (event.type === "result") {
        return event.result;
      } else {
        throw new Error(event.error);
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim().length > 0) {
    const event = parseStreamEvent(buffer);

    if (event.type === "result") {
      return event.result;
    }

    if (event.type === "error") {
      throw new Error(event.error);
    }
  }

  throw new Error("Agent stream ended without a result");
}

function parseStreamEvent(line: string): AgentStreamClientEvent {
  const parsed = JSON.parse(line) as AgentStreamClientEvent;

  if (parsed.type !== "status" && parsed.type !== "result" && parsed.type !== "error") {
    throw new Error(`Unknown Agent stream event: ${line}`);
  }

  return parsed;
}

export async function loadWorkspaceFiles(workspaceRoot: string): Promise<WorkspaceFile[]> {
  const params = new URLSearchParams({ root: workspaceRoot });
  const response = await fetch(`/api/files?${params.toString()}`);

  const body = (await response.json()) as WorkspaceFile[] | AgentErrorResponse;

  if ("error" in body) {
    throw new Error("error" in body ? body.error : "Workspace files request failed");
  }

  return body;
}

export async function listWorkspaceDirectories(workspaceRoot: string): Promise<WorkspaceDirectoryListing> {
  const params = new URLSearchParams({ root: workspaceRoot });
  const response = await fetch(`/api/directories?${params.toString()}`);

  const body = (await response.json()) as WorkspaceDirectoryListing | AgentErrorResponse;

  if ("error" in body) {
    throw new Error(body.error);
  }

  return body;
}
