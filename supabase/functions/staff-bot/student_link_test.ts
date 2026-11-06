import { assertEquals } from "jsr:@std/assert@1";
import { pickStudentMatch, renderStudentChoices, type StudentMatch } from "./student_link.ts";

const s = (user_id: string, full_name: string, score: number, phone: string | null = null): StudentMatch =>
  ({ user_id, full_name, phone, score });

Deno.test("pickStudentMatch: bo'sh ro'yxat → null", () => {
  assertEquals(pickStudentMatch([]), null);
});

Deno.test("pickStudentMatch: bitta aniq moslik → user_id", () => {
  const r = pickStudentMatch([s("u1", "Aliyev Ali", 0.9)]);
  assertEquals(r, { user_id: "u1" });
});

Deno.test("pickStudentMatch: ishonch past → ro'yxat qaytadi (bitta bo'lsa ham)", () => {
  const r = pickStudentMatch([s("u1", "Ali", 0.4)]);
  assertEquals(r && "choices" in r, true);
});

Deno.test("pickStudentMatch: ikkitasi yaqin ball bilan → ro'yxat (aniqlashtirish)", () => {
  const rows = [s("u1", "Aliyev Ali", 0.85), s("u2", "Aliyev Vali", 0.8)];
  const r = pickStudentMatch(rows);
  assertEquals(r && "choices" in r && r.choices.length, 2);
});

Deno.test("pickStudentMatch: birinchisi ancha oldinda → aniq moslik", () => {
  const rows = [s("u1", "Aliyev Ali", 0.9), s("u2", "Boboyev Bob", 0.3)];
  assertEquals(pickStudentMatch(rows), { user_id: "u1" });
});

Deno.test("renderStudentChoices: ro'yxat va telefon ko'rsatiladi", () => {
  const text = renderStudentChoices("ali", [s("u1", "Aliyev Ali", 0.5, "+998901234567"), s("u2", "Vali", 0.4)]);
  assertEquals(text.includes("Aliyev Ali"), true);
  assertEquals(text.includes("+998901234567"), true);
  assertEquals(text.includes("1. "), true);
  assertEquals(text.includes("2. "), true);
});
