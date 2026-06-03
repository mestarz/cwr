export type RelatedFile = {
  path: string;
  reason: string;
  relevance: number;
};

export type CodeFocus = {
  file: string;
  startLine?: number;
  endLine?: number;
};

export type AgentFloatingWidgetKind = "explanation" | "markdown";

export type AgentFloatingWidget = {
  id: string;
  kind: AgentFloatingWidgetKind;
  title: string;
  content: string;
  skillName: string;
};

export type AgentTaskKind = "local_file_task" | "module_task";

export type AgentRoutingProfile = "local_file" | "module_work";

export type AgentModelProfile = {
  id: string;
  provider: string;
  name: string;
  temperature: number;
  maxTokens: number;
  thinkingLevel?: string;
  purpose: string;
};

export type AgentTaskIntent = {
  taskKind: AgentTaskKind;
  routingProfile: AgentRoutingProfile;
  modelProfile: AgentModelProfile;
  requiresWorkspaceSearch: boolean;
  requiresCodeEdit: boolean;
  requiresDiagram: boolean;
  requiresExplanation: boolean;
};

export type AgentEditorResult = {
  intent?: AgentTaskIntent;
  floatingWidgets: AgentFloatingWidget[];
  relatedFiles: RelatedFile[];
  codeFocus?: CodeFocus;
};

export type AgentStatusUpdate = {
  message: string;
  detail?: string;
};

export type AgentStatusListener = (status: AgentStatusUpdate) => void;

export type AgentBridgeInput = {
  message: string;
  workspaceRoot: string;
  activeFile: string;
  selectedText: string;
};

export type WorkspaceFile = {
  path: string;
  language: string;
  content: string;
};

export type WorkspaceDirectoryEntry = {
  path: string;
  name: string;
};

export type WorkspaceDirectoryListing = {
  root: string;
  parent?: string;
  directories: WorkspaceDirectoryEntry[];
};
