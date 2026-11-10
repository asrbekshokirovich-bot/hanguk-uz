import { assertEquals } from "jsr:@std/assert@1";
import { isValidBizNo, NTS_STATUS_URL, ntsStatus, placeholderName, recheckUpdate } from "./nts.ts";

Deno.test("사업자등록번호 check digit", () => {
  assertEquals(isValidBizNo("1248100998"), true);
  assertEquals(isValidBizNo("1234567891"), true);
  assertEquals(isValidBizNo("1234567890"), false);
  assertEquals(isValidBizNo("124810099"), false);
  assertEquals(isValidBizNo("124-81-00998"), false, "digits only (the function strips dashes first)");
});

function answering(status: number, body: unknown, seen: Request[] = []): typeof fetch {
  return (input: string | URL | Request, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
}

Deno.test("국세청 answers", async () => {
  const seen: Request[] = [];
  const active = await ntsStatus("1248100998", "a+b/c==", answering(200, { data: [{ b_no: "1248100998", b_stt_cd: "01" }] }, seen));
  assertEquals(active, { kind: "active", code: "01" });
  assertEquals(seen[0].url, `${NTS_STATUS_URL}?serviceKey=a%2Bb%2Fc%3D%3D`);
  assertEquals(seen[0].method, "POST");
  assertEquals(await seen[0].json(), { b_no: ["1248100998"] });
  assertEquals(await ntsStatus("1", "k", answering(200, { data: [{ b_stt_cd: "02" }] })), { kind: "suspended", code: "02" });
  assertEquals(await ntsStatus("1", "k", answering(200, { data: [{ b_stt_cd: "03" }] })), { kind: "closed", code: "03" });
  assertEquals(
    await ntsStatus("1", "k", answering(200, { data: [{ b_stt_cd: "", tax_type: "국세청에 등록되지 않은 사업자등록번호입니다." }] })),
    { kind: "unknown" },
  );
});

Deno.test("no key or no answer: a person checks it", async () => {
  assertEquals(await ntsStatus("1248100998", undefined), { kind: "unchecked" });
  assertEquals(await ntsStatus("1248100998", "k", answering(500, {})), { kind: "unchecked" });
  assertEquals(await ntsStatus("1248100998", "k", () => Promise.reject(new TypeError("network"))), { kind: "unchecked" });
  assertEquals(await ntsStatus("1248100998", "k", answering(200, { data: [] })), { kind: "unchecked" });
});

Deno.test("placeholder name", () => {
  assertEquals(placeholderName("1234567891"), "사업장 123-45-67891");
});

Deno.test("asked again, a waiting business is verified, refused or keeps waiting", () => {
  assertEquals(recheckUpdate({ kind: "active", code: "01" }), { status: "verified", nts_status: "01" });
  assertEquals(recheckUpdate({ kind: "closed", code: "03" }), { status: "rejected", nts_status: "03" });
  assertEquals(recheckUpdate({ kind: "suspended", code: "02" }), { nts_status: "02" }, "휴업: still waiting");
  assertEquals(recheckUpdate({ kind: "unchecked" }), null, "no key or no answer: as it was");
  assertEquals(recheckUpdate({ kind: "unknown" }), null, "not listed (yet): as it was");
});
