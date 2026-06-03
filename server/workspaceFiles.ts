import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { WorkspaceDirectoryListing, WorkspaceFile } from "./types.js";

const ignoredDirs = new Set([".git", ".pi", ".codex", ".agents", "node_modules", "dist", "dist-server", "build", "coverage"]);
const maxFiles = 200;
const maxBytes = 160_000;
const execFileAsync = promisify(execFile);

const languageByExt: Record<string, string> = {
  ".css": "css",
  ".html": "html",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".mjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".txt": "plaintext",
  ".yaml": "yaml",
  ".yml": "yaml"
};

export async function loadWorkspaceFiles(workspaceRoot: string): Promise<WorkspaceFile[]> {
  const root = resolve(workspaceRoot);
  const rootStat = await stat(root);

  if (!rootStat.isDirectory()) {
    throw new Error(`工程目录不存在或不是目录：${root}`);
  }

  const paths = await collectWorkspaceFilePaths(root);
  const files: WorkspaceFile[] = [];

  for (const path of paths) {
    if (files.length >= maxFiles || !isReadableSourceFile(path)) {
      continue;
    }

    const fileStat = await stat(path);
    if (fileStat.size > maxBytes) {
      continue;
    }

    files.push({
      path: toWorkspacePath(relative(root, path)),
      language: getLanguage(path),
      content: await readFile(path, "utf8")
    });
  }

  return files;
}

export async function listWorkspaceDirectories(workspaceRoot: string): Promise<WorkspaceDirectoryListing> {
  const root = resolve(workspaceRoot);
  const rootStat = await stat(root);

  if (!rootStat.isDirectory()) {
    throw new Error(`目录不存在或不是目录：${root}`);
  }

  const entries = await readdir(root, { withFileTypes: true });
  const isGitWorkspace = await isInsideGitWorkTree(root);
  const directories: WorkspaceDirectoryListing["directories"] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = resolve(root, entry.name);
    if (isGitWorkspace && (await isIgnoredByGit(root, fullPath, true))) {
      continue;
    }

    directories.push({
      path: fullPath,
      name: entry.name
    });
  }

  directories.sort((left, right) => left.name.localeCompare(right.name));

  return {
    root,
    parent: dirname(root) === root ? undefined : dirname(root),
    directories
  };
}

async function collectWorkspaceFilePaths(root: string): Promise<string[]> {
  const gitPaths = await listGitVisibleFiles(root);

  if (gitPaths) {
    return gitPaths;
  }

  return collectFiles(root, root);
}

async function listGitVisibleFiles(root: string): Promise<string[] | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", root, "ls-files", "-co", "--exclude-standard", "-z"], {
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024
    });

    return stdout
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((path) => resolve(root, path));
  } catch {
    return undefined;
  }
}

async function collectFiles(root: string, dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await collectFiles(root, fullPath)));
      }
      continue;
    }

    if (entry.isFile() && isReadableSourceFile(fullPath) && files.length < maxFiles) {
      const fileStat = await stat(fullPath);
      if (fileStat.size <= maxBytes) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function isReadableSourceFile(path: string) {
  return extname(path) in languageByExt;
}

function getLanguage(path: string) {
  return languageByExt[extname(path)] ?? basename(path);
}

async function isInsideGitWorkTree(root: string) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8"
    });

    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function isIgnoredByGit(root: string, path: string, isDirectory: boolean) {
  const relativePath = toWorkspacePath(relative(root, path));
  const gitPath = isDirectory ? `${relativePath}/` : relativePath;

  try {
    await execFileAsync("git", ["-C", root, "check-ignore", "-q", "--", gitPath]);
    return true;
  } catch {
    return false;
  }
}

function toWorkspacePath(path: string) {
  return path.replaceAll("\\", "/");
}
