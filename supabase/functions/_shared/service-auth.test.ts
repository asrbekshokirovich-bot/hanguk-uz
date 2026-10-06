import { describe, expect, it, vi } from "vitest";
import { constantTimeEqual, isServiceRequest, jwtRole, knownSecretKeys, restJwtVerifier } from "./service-auth";

function jwt(role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role, iss: "supabase" })}.sig`;
}

const req = (headers: Record<string, string>) => new Request("https://x.test/fn", { method: "POST", headers });

describe("constantTimeEqual", () => {
  it("compares strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("jwtRole / knownSecretKeys", () => {
  it("reads the role claim, tolerates garbage", () => {
    expect(jwtRole(jwt("service_role"))).toBe("service_role");
    expect(jwtRole("not-a-jwt")).toBeNull();
    expect(jwtRole("a.b.c")).toBeNull();
  });
  it("lists secret keys", () => {
    expect(knownSecretKeys('{"default":"sb_secret_a","x":1}')).toEqual(["sb_secret_a"]);
    expect(knownSecretKeys("nope")).toEqual([]);
    expect(knownSecretKeys(null)).toEqual([]);
  });
});

describe("isServiceRequest", () => {
  const cfg = { serviceKey: "SERVICE-KEY-1", secretKeysJson: '{"default":"sb_secret_abc"}' };

  it("accepts the service key as bearer", async () => {
    expect(await isServiceRequest(req({ authorization: "Bearer SERVICE-KEY-1" }), cfg)).toBe(true);
  });
  it("accepts a known sb_secret_ apikey, refuses an unknown one", async () => {
    expect(await isServiceRequest(req({ apikey: "sb_secret_abc" }), cfg)).toBe(true);
    expect(await isServiceRequest(req({ apikey: "sb_secret_zzz" }), cfg)).toBe(false);
  });
  it("refuses a missing or wrong bearer", async () => {
    expect(await isServiceRequest(req({}), cfg)).toBe(false);
    expect(await isServiceRequest(req({ authorization: "Bearer nope" }), cfg)).toBe(false);
  });
  it("does not believe an unsigned service_role claim without a verifier", async () => {
    expect(await isServiceRequest(req({ authorization: `Bearer ${jwt("service_role")}` }), cfg)).toBe(false);
  });
  it("asks the verifier about a service_role claim that is not the service key", async () => {
    const good = vi.fn().mockResolvedValue(true);
    const bad = vi.fn().mockResolvedValue(false);
    const token = jwt("service_role");
    expect(await isServiceRequest(req({ authorization: `Bearer ${token}` }), { ...cfg, verifyJwt: good })).toBe(true);
    expect(good).toHaveBeenCalledWith(token);
    expect(await isServiceRequest(req({ authorization: `Bearer ${token}` }), { ...cfg, verifyJwt: bad })).toBe(false);
  });
  it("never consults the verifier for other roles, and a throwing verifier means no", async () => {
    const v = vi.fn().mockResolvedValue(true);
    expect(await isServiceRequest(req({ authorization: `Bearer ${jwt("authenticated")}` }), { ...cfg, verifyJwt: v })).toBe(false);
    expect(v).not.toHaveBeenCalled();
    const boom = vi.fn().mockRejectedValue(new Error("down"));
    expect(await isServiceRequest(req({ authorization: `Bearer ${jwt("service_role")}` }), { ...cfg, verifyJwt: boom })).toBe(false);
  });
});

describe("restJwtVerifier", () => {
  it("passes the token to PostgREST and caches a good answer", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    const verify = restJwtVerifier("https://p.supabase.co", fetchFn as unknown as typeof fetch);
    expect(await verify("tok")).toBe(true);
    expect(await verify("tok")).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("https://p.supabase.co/rest/v1/");
    expect((init as RequestInit).headers).toMatchObject({ apikey: "tok", Authorization: "Bearer tok" });
  });
  it("refuses what PostgREST refuses", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    const verify = restJwtVerifier("https://p.supabase.co", fetchFn as unknown as typeof fetch);
    expect(await verify("forged")).toBe(false);
  });
});
