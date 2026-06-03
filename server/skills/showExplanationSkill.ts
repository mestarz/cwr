import type { AgentDisplaySkill } from "./types.js";

const skillName = "show_explanation";

export type ShowExplanationInput = {
  title: string;
  content: string;
};

export const showExplanationSkill: AgentDisplaySkill<ShowExplanationInput> = {
  name: skillName,
  description: "当 Agent 需要向用户展示代码解释、上下文说明或问题分析时调用。",
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
