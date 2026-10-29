// Student tools: the signed-in student's OWN data only. Every RPC reads
// auth.uid() in Postgres; nothing here takes a student id from the model.
import { type AgentTool, rpc } from "./types.ts";

export const STUDENT_TOOLS: AgentTool[] = [
  {
    name: "my_card",
    description:
      "The signed-in student's own card: name, TOPIK/IELTS on the profile, seasons with contract status and current stage, the 8-document application pack (which documents are approved, under review or missing), chosen universities with online/offline submission, interview, result, final choice, visa status and the guideline deadlines for each (online_deadline, interview_round, result_round, visa_round), and whether the Study Plan is ready. Call it for ANY question about 'my documents / my application / my universities / my next step'.",
    parameters: { type: "object", properties: {} },
    audiences: ["student"],
    run: async (ctx) => ({ data: await rpc(ctx.user, "ai_my_card", {}) }),
  },
];
