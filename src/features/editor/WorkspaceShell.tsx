import { FileCode2, LoaderCircle, PanelLeft, Send } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { AgentFloatingStack } from "./components/AgentFloatingStack";
import { useEditorWorkspace } from "./useEditorWorkspace";
import type { LoadedWorkspace } from "../../app/App";

type WorkspaceShellProps = {
  workspace: LoadedWorkspace;
};

export function WorkspaceShell({ workspace: loadedWorkspace }: WorkspaceShellProps) {
  const workspace = useEditorWorkspace(loadedWorkspace.root, loadedWorkspace.files);
  const [message, setMessage] = useState("");
  const relatedFiles = useMemo(() => {
    const availablePaths = new Set(workspace.files.map((file) => file.path));
    const relatedByPath = new Map<string, (typeof workspace.agentResult.relatedFiles)[number]>();

    for (const file of workspace.agentResult.relatedFiles) {
      if (!availablePaths.has(file.path)) {
        continue;
      }

      const current = relatedByPath.get(file.path);

      if (!current || file.relevance > current.relevance) {
        relatedByPath.set(file.path, file);
      }
    }

    return [...relatedByPath.values()].sort((left, right) => right.relevance - left.relevance);
  }, [workspace.agentResult.relatedFiles, workspace.files]);
  const hasRelatedFiles = relatedFiles.length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (message.trim().length === 0 || workspace.isSending) {
      return;
    }

    workspace.submitMessage(message);
    setMessage("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <main className="workspace-shell">
      <aside className="file-rail">
        <div className="panel-title">
          <PanelLeft size={16} />
          <span>{hasRelatedFiles ? "相关文件" : "工程文件"}</span>
        </div>
        <div className="related-list">
          {workspace.files.length === 0 ? <div className="empty-file-list">当前工程目录没有可展示文件</div> : null}
          {hasRelatedFiles
            ? relatedFiles.map((related) => {
                const file = workspace.files.find((item) => item.path === related.path)!;
                const className = [
                  "file-row",
                  "related",
                  related.path === workspace.activePath ? "active" : ""
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    className={className}
                    key={related.path}
                    onClick={() => workspace.setActivePath(file.path)}
                    title={`${workspace.workspaceRoot}/${related.path}`}
                    type="button"
                  >
                    <FileCode2 size={15} />
                    <span>{related.path}</span>
                    <small>{related.reason}</small>
                  </button>
                );
              })
            : workspace.files.map((file) => (
                <button
                  className={file.path === workspace.activePath ? "file-row active" : "file-row"}
                  key={file.path}
                  onClick={() => workspace.setActivePath(file.path)}
                  title={`${workspace.workspaceRoot}/${file.path}`}
                  type="button"
                >
                  <FileCode2 size={15} />
                  <span>{file.path}</span>
                </button>
              ))}
        </div>
      </aside>

      <section className={workspace.agentStatus ? "code-stage has-agent-status" : "code-stage"}>
        <header className="code-toolbar">
          <div>
            <strong>{workspace.activeFile?.path ?? "未加载文件"}</strong>
            <span>{workspace.activeFile?.language ?? "empty"}</span>
          </div>
        </header>
        {workspace.agentStatus ? (
          <div className="agent-status-bar" role="status">
            <LoaderCircle size={14} />
            <span>{workspace.agentStatus}</span>
          </div>
        ) : null}
        <div className="editor-frame">
          {workspace.activeFile ? (
            <Editor
              height="100%"
              language={workspace.activeFile.language}
              onMount={(editor) => {
                editor.onDidChangeCursorSelection(() => {
                  const selection = editor.getSelection();
                  const model = editor.getModel();

                  if (selection && model) {
                    workspace.setSelectedText(model.getValueInRange(selection));
                  }
                });
              }}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                wordWrap: "on"
              }}
              path={workspace.activeFile.path}
              theme="vs"
              value={workspace.activeFile.content}
            />
          ) : (
            <div className="empty-editor">等待后端加载工作区文件</div>
          )}
        </div>

        <form className="composer" onSubmit={submit}>
          <textarea
            aria-label="向 Pi Agent 提问"
            onKeyDown={handleComposerKeyDown}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="输入问题，例如：解释当前文件的职责，并列出相关文件"
            value={message}
          />
          <button disabled={workspace.isSending || message.trim().length === 0} title="发送" type="submit">
            <Send size={18} />
          </button>
        </form>
      </section>

      <AgentFloatingStack widgets={workspace.agentResult.floatingWidgets} />
    </main>
  );
}
