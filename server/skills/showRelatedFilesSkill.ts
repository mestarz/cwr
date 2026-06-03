import type { RelatedFile } from "../types.js";

export type ShowRelatedFilesInput = {
  files: RelatedFile[];
};

export const showRelatedFilesSkill = {
  name: "show_related_files",
  description:
    "当用户询问某个功能、模块、流程或问题涉及哪些文件、在哪些文件实现、相关文件清单、调用链文件时必须调用。每个文件必须带上它在该功能中的职责、使用范围或关键关系说明；不要把相关文件清单写到普通解释或 Markdown 图中。",
  call(input: ShowRelatedFilesInput) {
    return input.files;
  }
};
