// Every tool Hanguk AI knows; toolsFor() picks the ones a caller may use.
import { CRM_TOOLS } from "./crm.ts";
import { STUDENT_TOOLS } from "./student.ts";
import type { AgentTool } from "./types.ts";

export const ALL_TOOLS: AgentTool[] = [...CRM_TOOLS, ...STUDENT_TOOLS];
