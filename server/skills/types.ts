import type { AgentFloatingWidget } from "../types.js";

export type AgentDisplaySkill<Input> = {
  name: string;
  description: string;
  call(input: Input): AgentFloatingWidget;
};
