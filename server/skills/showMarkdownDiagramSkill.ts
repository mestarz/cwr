import type { AgentDisplaySkill } from "./types.js";

const skillName = "show_markdown_diagram";

export type ShowMarkdownDiagramInput = {
  title: string;
  markdown: string;
};

export const showMarkdownDiagramSkill: AgentDisplaySkill<ShowMarkdownDiagramInput> = {
  name: skillName,
  description: "当 Agent 需要展示 Markdown 内容、Mermaid 图或结构化说明时调用。",
  call(input) {
    return {
      id: `${skillName}-${Date.now()}`,
      kind: "markdown",
      title: input.title,
      content: input.markdown,
      skillName
    };
  }
};
