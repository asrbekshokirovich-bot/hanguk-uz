import { assertEquals } from "jsr:@std/assert@1";
import { parseRecurringCommand, renderRecurringList, renderWeekdays } from "./recurring.ts";

Deno.test("parseRecurringCommand — har kuni, vaqtsiz", () => {
  const r = parseRecurringCommand("Ali Valiyev | Kunlik hisobot yozish | har kuni");
  assertEquals(r, { nameQuery: "Ali Valiyev", title: "Kunlik hisobot yozish", freq: "daily", weekdays: null, dueTime: null });
});

Deno.test("parseRecurringCommand — har kuni, vaqt bilan", () => {
  const r = parseRecurringCommand("Ali | Hisobot | har kuni | 18:00");
  assertEquals(r, { nameQuery: "Ali", title: "Hisobot", freq: "daily", weekdays: null, dueTime: "18:00" });
});

Deno.test("parseRecurringCommand — har hafta kunlar bilan", () => {
  const r = parseRecurringCommand("Ali | Haftalik yig'ilish | har hafta Du,Chor | 9:30");
  assertEquals(r, { nameQuery: "Ali", title: "Haftalik yig'ilish", freq: "weekly", weekdays: "1,3", dueTime: "09:30" });
});

Deno.test("parseRecurringCommand — takrorlanuvchi kunlar birlashadi va saralanadi", () => {
  const r = parseRecurringCommand("Ali | T | har hafta Juma,Du,Juma");
  assertEquals((r as { weekdays: string | null }).weekdays, "1,5");
});

Deno.test("parseRecurringCommand — kam bo'lak xato beradi", () => {
  const r = parseRecurringCommand("Ali | Sarlavha");
  assertEquals("error" in r, true);
});

Deno.test("parseRecurringCommand — noto'g'ri chastota xato beradi", () => {
  const r = parseRecurringCommand("Ali | Sarlavha | har oy");
  assertEquals("error" in r, true);
});

Deno.test("parseRecurringCommand — har hafta kunlarsiz xato beradi", () => {
  const r = parseRecurringCommand("Ali | Sarlavha | har hafta");
  assertEquals("error" in r, true);
});

Deno.test("parseRecurringCommand — noto'g'ri vaqt xato beradi", () => {
  const r = parseRecurringCommand("Ali | Sarlavha | har kuni | 25:99");
  assertEquals("error" in r, true);
});

Deno.test("renderWeekdays", () => {
  assertEquals(renderWeekdays(null), "har kuni");
  assertEquals(renderWeekdays("1,3,5"), "Du,Chor,Juma");
});

Deno.test("renderRecurringList — bo'sh", () => {
  assertEquals(renderRecurringList([]), "Faol takroriy vazifa yo'q.");
});

Deno.test("renderRecurringList — bitta yozuv", () => {
  const text = renderRecurringList([{
    id: "1", title: "Hisobot", assigned_to: "u1", assignee_name: "Ali",
    priority: "normal", freq: "weekly", weekdays: "1,3", due_time: "18:00",
  }]);
  assertEquals(text.includes("Ali"), true);
  assertEquals(text.includes("har hafta Du,Chor"), true);
  assertEquals(text.includes("18:00"), true);
});
