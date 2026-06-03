import { ArrowUp, Folder, FolderOpen, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { LoadedWorkspace } from "../../app/App";
import type { WorkspaceDirectoryListing } from "../../domain/agent";
import { listWorkspaceDirectories, loadWorkspaceFiles } from "../../services/agentClient";

type WorkspaceStartScreenProps = {
  onLoaded: (workspace: LoadedWorkspace) => void;
};

export function WorkspaceStartScreen({ onLoaded }: WorkspaceStartScreenProps) {
  const [selectedRoot, setSelectedRoot] = useState("");
  const [browseRoot, setBrowseRoot] = useState("/root/workspace/game");
  const [listing, setListing] = useState<WorkspaceDirectoryListing>();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);

  useEffect(() => {
    browse(browseRoot);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openWorkspace(selectedRoot);
  }

  async function openWorkspace(root: string) {
    setError("");
    setIsLoading(true);

    try {
      const files = await loadWorkspaceFiles(root.trim());
      onLoaded({
        root: root.trim(),
        files
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }

  async function browse(root: string) {
    setError("");
    setIsBrowsing(true);

    try {
      const nextListing = await listWorkspaceDirectories(root);
      setListing(nextListing);
      setBrowseRoot(nextListing.root);
      setSelectedRoot(nextListing.root);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBrowsing(false);
    }
  }

  const quickRoots = ["/root/workspace/game", "/root/workspace/game/cwr", "/root/workspace"];

  return (
    <main className="start-screen">
      <section className="start-panel">
        <aside className="start-sidebar">
          <div className="start-title">
            <FolderOpen size={20} />
            <span>快速位置</span>
          </div>
          <div className="quick-list">
            {quickRoots.map((root) => (
              <button key={root} onClick={() => browse(root)} title={root} type="button">
                <Folder size={15} />
                <span>{root}</span>
              </button>
            ))}
          </div>
        </aside>

        <form className="start-main" onSubmit={submit}>
          <div className="start-header">
            <div>
              <strong>打开工程</strong>
              <span>{browseRoot}</span>
            </div>
            <button disabled={isBrowsing} onClick={() => browse(browseRoot)} title="刷新目录" type="button">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="start-controls">
            <input
              autoFocus
              onChange={(event) => setSelectedRoot(event.target.value)}
              placeholder="/path/to/project"
              value={selectedRoot}
            />
            <button disabled={isLoading || selectedRoot.trim().length === 0} type="submit">
              {isLoading ? "加载中" : "打开"}
            </button>
          </div>

          <div className="directory-browser">
            {listing?.parent ? (
              <button className="directory-row" onClick={() => browse(listing.parent!)} type="button">
                <ArrowUp size={15} />
                <span>..</span>
              </button>
            ) : null}
            {listing?.directories.map((directory) => (
              <button
                className={directory.path === selectedRoot ? "directory-row active" : "directory-row"}
                key={directory.path}
                onClick={() => setSelectedRoot(directory.path)}
                onDoubleClick={() => browse(directory.path)}
                title={directory.path}
                type="button"
              >
                <Folder size={15} />
                <span>{directory.name}</span>
              </button>
            ))}
          </div>

          {error ? <p className="start-error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
