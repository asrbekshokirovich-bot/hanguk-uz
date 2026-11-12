import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  feedbackTokenBudget,
  groupTurns,
  normalizeMessageScores,
  parseFeedback,
  transcriptOf,
} from "./turns.ts";

const row = (id: string, role: string, content: string | null) => ({ id, role, content });

Deno.test("fragments of one answer become one turn", () => {
  const turns = groupTurns([
    row("i1", "interviewer", "Hello! Are you ready?"),
    row("s1", "student", "Yes"),
    row("s2", "student", "I am ready"),
    row("i2", "interviewer", "Why Korea?"),
    row("i3", "interviewer", "Take your time."),
    row("s3", "student", "Because of"),
    row("s4", "student", "  the universities "),
    row("s5", "student", "and the language"),
  ]);
  assertEquals(turns.map((t) => [t.id, t.role, t.content]), [
    ["i1", "interviewer", "Hello! Are you ready?"],
    ["s1", "student", "Yes I am ready"],
    ["i2", "interviewer", "Why Korea? Take your time."],
    ["s3", "student", "Because of the universities and the language"],
  ]);
  assertEquals(turns[3].messageIds, ["s3", "s4", "s5"]);
});

Deno.test("empty rows are not turns and do not split one", () => {
  const turns = groupTurns([
    row("s1", "student", "First"),
    row("s2", "student", "   "),
    row("s3", "student", null),
    row("s4", "student", "second"),
  ]);
  assertEquals(turns.length, 1);
  assertEquals(turns[0].content, "First second");
  assertEquals(turns[0].messageIds, ["s1", "s4"]);
});

Deno.test("130 fragments, 15 answers: 15 ids to score", () => {
  const rows = [];
  for (let a = 0; a < 15; a++) {
    rows.push(row(`i${a}`, "interviewer", `Question ${a}`));
    const fragments = a < 10 ? 9 : 8; // 10×9 + 5×8 = 130
    for (let f = 0; f < fragments; f++) rows.push(row(`s${a}-${f}`, "student", `part ${f}`));
  }
  const students = groupTurns(rows).filter((t) => t.role === "student");
  assertEquals(rows.filter((r) => r.role === "student").length, 130);
  assertEquals(students.length, 15);
  assertEquals(students[0].id, "s0-0");
});

Deno.test("the transcript names each turn once", () => {
  const text = transcriptOf(groupTurns([
    row("i1", "interviewer", "Why Korea?"),
    row("s1", "student", "For"),
    row("s2", "student", "study"),
  ]));
  assertEquals(text, "[i1] 면접관: Why Korea?\n\n[s1] 학생: For study");
});

Deno.test("room for the reply grows with the answers, up to a ceiling", () => {
  assertEquals(feedbackTokenBudget(1), 8000);
  assertEquals(feedbackTokenBudget(8), 8000);
  assertEquals(feedbackTokenBudget(15), 8000 + 7 * 600);
  assertEquals(feedbackTokenBudget(500), 20000);
});

const whole = {
  communication_score: 6,
  confidence_score: 5,
  content_score: 4,
  language_score: 7,
  strengths: ["a"],
  improvements: ["b"],
  detailed_feedback: 'He said "hello" {twice}.',
  message_scores: [
    { message_id: "s1", score: 6, strengths: ["x"], suggestions: ["y } z"], ideal_hint: 'Say "I chose…"' },
    { message_id: "s3", score: 4, strengths: [], suggestions: ["more detail"], ideal_hint: "…" },
  ],
};

Deno.test("a whole reply is read as it is", () => {
  const r = parseFeedback("```json\n" + JSON.stringify(whole, null, 2) + "\n```");
  assertEquals(r.truncated, false);
  assertEquals(r.data, whole);
});

Deno.test("a reply cut inside the second answer keeps the overall part and the first answer", () => {
  const text = JSON.stringify(whole, null, 2);
  const cut = text.slice(0, text.indexOf('"more detail"') + 5);
  const r = parseFeedback(cut);
  assertEquals(r.truncated, true);
  assertEquals(r.data.communication_score, 6);
  assertEquals(r.data.detailed_feedback, whole.detailed_feedback);
  assertEquals(r.data.message_scores, [whole.message_scores[0]]);
});

Deno.test("a reply cut right after the list opens has no answers, and still the overall part", () => {
  const text = JSON.stringify(whole);
  const cut = text.slice(0, text.indexOf('"message_scores":[') + '"message_scores":['.length);
  const r = parseFeedback(cut);
  assertEquals(r.truncated, true);
  assertEquals(r.data.message_scores, []);
  assertEquals(r.data.language_score, 7);
});

Deno.test("braces and quotes inside strings do not end an answer early", () => {
  const tricky = { ...whole, message_scores: [{ message_id: "s1", score: 5, ideal_hint: 'a "}" b \\ c {' }, { message_id: "s3", score: 2 }] };
  const text = JSON.stringify(tricky);
  const r = parseFeedback(text.slice(0, text.length - 12)); // inside the last answer
  assertEquals(r.truncated, true);
  assertEquals(r.data.message_scores, [tricky.message_scores[0]]);
});

Deno.test("a reply cut before the per-answer part is not usable", () => {
  const text = JSON.stringify(whole);
  assertThrows(() => parseFeedback(text.slice(0, text.indexOf('"improvements"') + 20)));
  assertThrows(() => parseFeedback(""));
  assertThrows(() => parseFeedback("Sorry, I cannot do that."));
});

Deno.test("reviews are kept only for answers that were given, one each, with their words", () => {
  const turns = groupTurns([
    row("i1", "interviewer", "Why Korea?"),
    row("s1", "student", "For"),
    row("s2", "student", "study"),
    row("i2", "interviewer", "And after?"),
    row("s3", "student", "Work"),
    row("i3", "interviewer", "Thanks"),
    row("s4", "student", "Bye"),
  ]).filter((t) => t.role === "student");
  const out = normalizeMessageScores([
    { message_id: "s3", score: 4 },
    { message_id: "made-up", score: 9 },
    { message_id: "s2", score: 6, strengths: ["clear"] }, // a later row of the first answer
    { message_id: "s1", score: 1 }, // a second review of the same answer
    "nonsense",
    null,
  ], turns);
  assertEquals(out, [
    { message_id: "s1", score: 1, answer: "For study" },
    { message_id: "s3", score: 4, answer: "Work" },
  ]);
  assertEquals(normalizeMessageScores(undefined, turns), []);
});
