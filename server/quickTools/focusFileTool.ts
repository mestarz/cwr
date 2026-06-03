import { basename } from "node:path";
import type { AgentEditorResult } from "../types.js";
import type { QuickTool } from "./types.js";

const focusWords = ["聚焦", "定位", "跳到", "切到", "打开", "查看", "切换到", "focus"];
const currentFileWords = ["当前文件", "当前的文件", "当前", "当地", "这个文件", "本文件"];

export const focusFileTool: QuickTool = {
  name: "focus_file",
  description: "聚焦到当前文件或用户指定的工作区文件。",
  tryRun({ input, files, onStatus }) {
    if (!includesAny(input.message, focusWords)) {
      return undefined;
    }

    const target = includesAny(input.message, currentFileWords) ? input.activeFile : findMentionedFile(input.message, files);

    if (!target) {
      return undefined;
    }

    onStatus?.({ message: "执行快速工具", detail: `聚焦文件：${target}` });

    return createFocusResult(target);
  }
};

function createFocusResult(file: string): AgentEditorResult {
  return {
    floatingWidgets: [],
    relatedFiles: [],
    codeFocus: {
      file,
      startLine: 1
    },
    quickActions: [
      {
        type: "focus_file",
        file,
        startLine: 1
      }
    ]
  };
}

function findMentionedFile(message: string, files: { path: string }[]) {
  const normalizedMessage = normalizePathText(message);

  const matched = files
    .map((file) => ({
      path: file.path,
      score: getMatchScore(normalizedMessage, file.path)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.path.length - right.path.length);

  return matched[0]?.path;
}

function getMatchScore(message: string, filePath: string) {
  const normalizedPath = normalizePathText(filePath);
  const fileName = basename(filePath);

  if (message.includes(normalizedPath)) {
    return normalizedPath.length + 100;
  }

  if (message.includes(fileName)) {
    return fileName.length;
  }

  return 0;
}

function normalizePathText(text: string) {
  return text.replaceAll("\\", "/");
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}
