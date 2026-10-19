// deno test supabase/functions/auto-translate-documents/rules_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import { existingTranslationAction, planTranslation, slotTag, type StudentDoc, waitingMessage } from "./rules.ts";

let n = 0;
function doc(slot: string, created = "2026-10-19T09:00:00Z", status = "uploaded"): StudentDoc {
  n += 1;
  return {
    id: `d${n}`,
    name: `[${slot}] scan.pdf`,
    file_path: `student/${slot}-${n}.pdf`,
    created_at: created,
    status,
    intake_id: null,
  };
}

Deno.test("a diploma waits for the student's foreign passport", () => {
  const plan = planTranslation("diploma", [doc("diploma"), doc("applicant_id_card")]);
  assertEquals(plan, { ready: false, missing: ["talabaning zagran pasporti"] });
});

Deno.test("a diploma with the foreign passport is ready, passport attached", () => {
  const passport = doc("foreign_passport");
  const plan = planTranslation("diploma", [doc("diploma"), passport]);
  assertEquals(plan.ready, true);
  if (plan.ready) {
    assertEquals(plan.supporting.map((s) => [s.documentId, s.role]), [[passport.id, "student_passport"]]);
  }
});

Deno.test("the legacy applicant_passport tag counts as the foreign passport", () => {
  assertEquals(planTranslation("diploma", [doc("applicant_passport")]).ready, true);
});

Deno.test("a birth certificate needs the student's and both parents' passports", () => {
  const plan = planTranslation("birth_certificate", [doc("birth_certificate"), doc("foreign_passport")]);
  assertEquals(plan, {
    ready: false,
    missing: ["otasining pasporti (ID karta yoki zagran)", "onasining pasporti (ID karta yoki zagran)"],
  });

  const onlyFather = planTranslation("birth_certificate", [doc("father_id_card")]);
  assertEquals(onlyFather, {
    ready: false,
    missing: ["talabaning zagran pasporti", "onasining pasporti (ID karta yoki zagran)"],
  });
});

Deno.test("a parent's ID card or foreign passport both satisfy the rule, and both are attached", () => {
  const plan = planTranslation("birth_certificate", [
    doc("foreign_passport"),
    doc("father_foreign_passport"),
    doc("mother_id_card"),
    doc("mother_foreign_passport"),
  ]);
  assertEquals(plan.ready, true);
  if (plan.ready) {
    assertEquals(plan.supporting.map((s) => s.role), ["student_passport", "father_id", "mother_id", "mother_id"]);
  }
});

Deno.test("the newest upload of a slot is the one used", () => {
  const old = doc("foreign_passport", "2026-01-01T00:00:00Z");
  const fresh = doc("foreign_passport", "2026-10-01T00:00:00Z");
  const plan = planTranslation("diploma", [old, fresh]);
  assertEquals(plan.ready && plan.supporting[0].documentId, fresh.id);
});

Deno.test("slot tags are read from the name prefix", () => {
  assertEquals(slotTag({ name: "[Diploma_Translation] x.docx" }), "diploma_translation");
  assertEquals(slotTag({ name: "x.pdf" }), null);
});

Deno.test("an existing translation is kept when approved or newer than the source", () => {
  const source = { created_at: "2026-10-10T00:00:00Z" };
  assertEquals(existingTranslationAction(undefined, source), "add");
  assertEquals(existingTranslationAction({ status: "approved", created_at: "2026-01-01T00:00:00Z" }, source), "keep");
  assertEquals(existingTranslationAction({ status: "uploaded", created_at: "2026-10-11T00:00:00Z" }, source), "keep");
  assertEquals(existingTranslationAction({ status: "uploaded", created_at: "2026-10-01T00:00:00Z" }, source), "replace");
});

Deno.test("the waiting message lists what is missing", () => {
  assertEquals(waitingMessage(["a", "b"]), "Hujjat kutilmoqda: a, b");
});
