// deno test supabase/functions/interview-ai/dialog_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { chatMessages, hintContext, hintMessages, isStart, parseHints, toChat } from "./dialog.ts";
import { isCue, STUCK_CUE } from "../_shared/interview-markers.ts";

const row = (role: string, content: string | null) => ({ role, content });

Deno.test("the saved rows as the model reads them", () => {
  const chat = toChat([
    row("student", "[Interview started in en]"),
    row("interviewer", "Hello! Please introduce yourself."),
    row("student", "  "),
    row("student", STUCK_CUE),
    row("student", "My name is Aziz."),
  ]);
  assertEquals(chat, [
    { role: "user", content: "[Interview started in en]" },
    { role: "assistant", content: "Hello! Please introduce yourself." },
    { role: "user", content: "My name is Aziz." },
  ]);
});

Deno.test("the greeting is due until the interviewer has spoken", () => {
  assertEquals(isStart(toChat([row("student", "[Interview started in ko]")])), true);
  assertEquals(isStart([]), true);
  assertEquals(
    isStart(toChat([row("student", "[Interview started in ko]"), row("interviewer", "안녕하세요")])),
    false,
  );
});

Deno.test("an answer is sent to the model once, not twice", () => {
  const chat = toChat([
    row("student", "[Interview started in en]"),
    row("interviewer", "Why Korea?"),
    row("student", "Because of the universities."),
  ]);
  const messages = chatMessages("SYSTEM", chat, "Because of the universities.");
  assertEquals(messages.map((m) => m.role), ["system", "user", "assistant", "user"]);
  assertEquals(messages.filter((m) => m.content === "Because of the universities.").length, 1);
  assertEquals(messages[0], { role: "system", content: "SYSTEM" });
});

Deno.test("the first request is the start cue, once", () => {
  const chat = toChat([row("student", "[Interview started in en]")]);
  assertEquals(chatMessages("S", chat, "[Interview started in en]"), [
    { role: "system", content: "S" },
    { role: "user", content: "[Interview started in en]" },
  ]);
});

Deno.test("a message that was not saved is still sent", () => {
  const chat = toChat([row("student", "[Interview started in en]"), row("interviewer", "Why Korea?")]);
  const messages = chatMessages("S", chat, "For the language.");
  assertEquals(messages[messages.length - 1], { role: "user", content: "For the language." });
  assertEquals(messages.length, 4);
  // Nothing saved at all: the request still opens on the student's message.
  assertEquals(chatMessages("S", [], "Hello"), [
    { role: "system", content: "S" },
    { role: "user", content: "Hello" },
  ]);
});

Deno.test("a hint is about the interviewer's last words", () => {
  const rows = [
    row("interviewer", "Hello."),
    row("student", "Yes, I am ready."),
    row("interviewer", "Great."),
    row("interviewer", "Why did you choose this university?"),
  ];
  assertEquals(hintContext(rows, STUCK_CUE), { question: "Great. Why did you choose this university?", said: "" });
  assertEquals(hintContext(rows, ""), { question: "Great. Why did you choose this university?", said: "" });
  assertEquals(hintContext(rows, null), { question: "Great. Why did you choose this university?", said: "" });
});

Deno.test("what the student has said since the question goes with it", () => {
  const rows = [
    row("interviewer", "Why did you choose this university?"),
    row("student", "Because"),
    row("student", "I like"),
  ];
  // Words still being heard are not saved yet…
  assertEquals(hintContext(rows, "the professors"), {
    question: "Why did you choose this university?",
    said: "Because I like the professors",
  });
  // …and words already saved are not repeated.
  assertEquals(hintContext(rows, "I like"), {
    question: "Why did you choose this university?",
    said: "Because I like",
  });
});

Deno.test("cues are neither a question nor an answer", () => {
  const rows = [
    row("student", "[Interview started in en]"),
    row("interviewer", "Please introduce yourself."),
    row("student", STUCK_CUE),
    row("student", null),
  ];
  assertEquals(hintContext(rows, "[Interview started in en]"), { question: "Please introduce yourself.", said: "" });
  assertEquals(isCue("student", STUCK_CUE), true);
  assertEquals(isCue("student", "[Interview started - AI begins]"), true);
  assertEquals(isCue("interviewer", STUCK_CUE), false);
  assertEquals(isCue("student", "I am stuck."), false);
});

Deno.test("no hint before the interviewer has asked anything", () => {
  assertEquals(hintContext([], STUCK_CUE), null);
  assertEquals(hintContext([row("student", "[Interview started in en]")], ""), null);
  assertEquals(hintContext([row("student", "Hello?")], "Hello?"), null);
});

Deno.test("a long turn keeps its end — where the question is", () => {
  const long = "x".repeat(900) + " Why Korea?";
  const ctx = hintContext([row("interviewer", long)], "");
  assertEquals(ctx!.question.length, 600);
  assertEquals(ctx!.question.endsWith("Why Korea?"), true);
});

Deno.test("the hint request names the interview's language", () => {
  const ctx = { question: "Why Korea?", said: "" };
  const ko = hintMessages(ctx, "ko");
  assertEquals(ko.map((m) => m.role), ["system", "user"]);
  assertEquals(ko[0].content.includes("simple Korean"), true);
  assertEquals(ko[1].content, "Interviewer: Why Korea?\nStudent so far: (nothing yet)");
  assertEquals(hintMessages(ctx, "en")[0].content.includes("simple English"), true);
  assertEquals(hintMessages(ctx, null)[0].content.includes("simple Korean"), true);
  assertEquals(
    hintMessages({ question: "Why Korea?", said: "Because" }, "en")[1].content,
    "Interviewer: Why Korea?\nStudent so far: Because",
  );
});

Deno.test("the model's reply becomes at most three clean lines", () => {
  assertEquals(parseHints("Talk about your major\nMention a professor\nSay your goal"), [
    "Talk about your major",
    "Mention a professor",
    "Say your goal",
  ]);
  assertEquals(parseHints("1. 전공 이야기\n2) 교수님 언급\n- 목표 말하기\n• 넷째 줄"), [
    "전공 이야기",
    "교수님 언급",
    "목표 말하기",
  ]);
  assertEquals(parseHints("\n\n  * One hint only  \n"), ["One hint only"]);
  assertEquals(parseHints(""), []);
  assertEquals(parseHints(null), []);
  assertEquals(parseHints(undefined), []);
});
