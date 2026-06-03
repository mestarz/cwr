import type { QuickTool } from "./types.js";

const closeWords = ["关闭", "关掉", "隐藏", "收起", "清掉", "清空"];
const floatingTargetWords = ["文本框", "解释框", "图形框", "图框", "图表框", "悬浮框", "浮层", "右侧", "解释", "markdown", "Markdown", "图"];

export const closeFloatingWidgetsTool: QuickTool = {
  name: "close_floating_widgets",
  description: "关闭右侧 AI 解释和 Markdown 图形悬浮框。",
  tryRun({ input, onStatus }) {
    const message = input.message.trim();
    const shouldClose =
      includesAny(message, closeWords) &&
      (includesAny(message, floatingTargetWords) || /关闭当前(?!文件)/.test(message) || /关掉当前(?!文件)/.test(message));

    if (!shouldClose) {
      return undefined;
    }

    onStatus?.({ message: "执行快速工具", detail: "关闭右侧浮层" });

    return {
      floatingWidgets: [],
      relatedFiles: [],
      quickActions: [{ type: "close_floating_widgets" }]
    };
  }
};

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}
