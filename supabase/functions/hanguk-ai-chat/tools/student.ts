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
  {
    name: "handoff_to_staff",
    description:
      "Pass the student's question to a Hanguk consultant (operators' queue in the CRM; if nobody answers within 10 minutes the operators get a Telegram alert). Use it when the student asks to talk to a person/consultant/operator, or when they need something you cannot do (payments, contract, a decision about their case, data you cannot see) and they want help. Put the student's request in their own words in `question`. Do not use it for questions you can answer. Returns alert_at and working_hours_now: tell the student a consultant will contact them (soon if working_hours_now, otherwise on the next working morning — working days Mon–Sat 09:00–18:00).",
    parameters: {
      type: "object",
      properties: { question: { type: "string", description: "What the student wants, in their words (max 500 chars)" } },
      required: ["question"],
    },
    audiences: ["student"],
    run: async (ctx, a) => ({
      data: await rpc(ctx.user, "ai_request_handoff", { p_question: String(a?.question ?? "").slice(0, 500) }),
    }),
  },
];
