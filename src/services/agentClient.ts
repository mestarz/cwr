import type {
  AgentChatRequest,
  AgentEditorResult,
  AgentErrorResponse,
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
