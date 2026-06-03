import { useState } from "react";
import type { WorkspaceFile } from "../domain/agent";
import { WorkspaceShell } from "../features/editor/WorkspaceShell";
import { WorkspaceStartScreen } from "../features/start/WorkspaceStartScreen";

export type LoadedWorkspace = {
  root: string;
  files: WorkspaceFile[];
};

export function App() {
  const [workspace, setWorkspace] = useState<LoadedWorkspace>();

  if (!workspace) {
    return <WorkspaceStartScreen onLoaded={setWorkspace} />;
  }

  return <WorkspaceShell workspace={workspace} />;
}
