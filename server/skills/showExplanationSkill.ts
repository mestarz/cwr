import type { AgentDisplaySkill } from "./types.js";

const skillName = "show_explanation";

export type ShowExplanationInput = {
  title: string;
  content: string;
};

export const showExplanationSkill: AgentDisplaySkill<ShowExplanationInput> = {
  name: skillName,
  description:
    "当 Agent 需要向用户展示代码解释、上下文说明或问题分析时调用。content 必须控制在 300 字以内；非必要不要输出变量名、函数名、类型名或内部字段名，优先解释这些代码符号对应的职责、数据含义或业务动作。必须像人一样断句和分段，使用 2 到 4 个短句或短段落，重点前置，不要堆成长句。",
  call(input) {
    return {
      id: `${skillName}-${Date.now()}`,
      kind: "explanation",
      title: input.title,
      content: input.content,
      skillName
    };
  }
};
