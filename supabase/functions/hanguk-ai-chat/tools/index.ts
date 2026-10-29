// Every tool Hanguk AI knows; toolsFor() picks the ones a caller may use.
import { CRM_TOOLS } from "./crm.ts";
import { GUIDELINE_TEXT_TOOL } from "./guideline_text.ts";
import { MEMORY_TOOLS } from "./memory.ts";
import { STUDENT_TOOLS } from "./student.ts";
import { UNIVERSITY_TOOLS } from "./university.ts";
import type { AgentTool } from "./types.ts";
import { webTools } from "./web.ts";

export const ALL_TOOLS: AgentTool[] = [...CRM_TOOLS, ...STUDENT_TOOLS, ...UNIVERSITY_TOOLS, GUIDELINE_TEXT_TOOL, ...MEMORY_TOOLS];

/** Tools that depend on configuration (web_search needs TAVILY_API_KEY). */
export function allTools(): AgentTool[] {
  return [...ALL_TOOLS, ...webTools()];
}
