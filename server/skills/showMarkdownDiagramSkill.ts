import type { AgentDisplaySkill } from "./types.js";

const skillName = "show_markdown_diagram";

export type ShowMarkdownDiagramInput = {
  title: string;
  diagramType?: "overview" | "module_detail";
  markdown: string;
};

export const showMarkdownDiagramSkill: AgentDisplaySkill<ShowMarkdownDiagramInput> = {
  name: skillName,
  description:
    "当 Agent 需要展示 Markdown 内容、Mermaid 图或结构化说明时调用。必须选择图类型：overview 是高层抽象图，只展示模块、阶段、职责、边界和关系；module_detail 是具体模块细节图，可以展示文件名、函数名、变量名、调用点等具体信息。markdown 字段必须是纯 Markdown 或纯 mermaid 代码块，可直接渲染；不要加入图外说明、前言、结论或解释文字。如果包含图，节点数量必须控制在 10 个以内。Mermaid 图必须适合右侧悬浮框展示：默认使用 flowchart TD/TB，深度不能超过 4 层，任一层横向节点不能超过 4 个；超过限制时必须提升抽象层级，把细节点合并成模块、阶段或职责分组。需要强调的节点必须在 Mermaid 中用 classDef/class 或 style 设置特殊颜色。",
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
