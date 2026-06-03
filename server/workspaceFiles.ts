import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import type { WorkspaceDirectoryListing, WorkspaceFile } from "./types.js";

const ignoredDirs = new Set([".git", ".pi", ".codex", ".agents", "node_modules", "dist", "dist-server", "build", "coverage"]);
const maxFiles = 200;
const maxBytes = 160_000;

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

  const paths = await collectFiles(root, root);

  return Promise.all(
    paths.slice(0, maxFiles).map(async (path) => ({
      path: relative(root, path),
      language: getLanguage(path),
      content: await readFile(path, "utf8")
    }))
  );
}

export async function listWorkspaceDirectories(workspaceRoot: string): Promise<WorkspaceDirectoryListing> {
  const root = resolve(workspaceRoot);
  const rootStat = await stat(root);

  if (!rootStat.isDirectory()) {
    throw new Error(`目录不存在或不是目录：${root}`);
  }

  const entries = await readdir(root, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && !ignoredDirs.has(entry.name))
    .map((entry) => ({
      path: resolve(root, entry.name),
      name: entry.name
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    root,
    parent: dirname(root) === root ? undefined : dirname(root),
    directories
  };
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
