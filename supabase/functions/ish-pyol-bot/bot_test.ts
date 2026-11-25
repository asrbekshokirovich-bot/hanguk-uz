import { assertEquals } from "jsr:@std/assert@1";
import { type Chat, type Deps, handle, T, wonText } from "./bot.ts";

function fake(methods: Record<string, string> = { bank: "KB 123-45 (Hanguk)" }) {
  const chats = new Map<number, Chat>();
  const sent: { text: string; buttons?: { text: string; data: string }[][] }[] = [];
  const requests: { worker: string; pyols: number; payer: string; proof: string }[] = [];
  let tooMany = false;
  const deps: Deps = {
    chat: async (id) => chats.get(id) ?? null,
    saveChat: async (id, c) => void chats.set(id, c),
    findWorker: async (text) =>
      ["AZIZ01", "010-0000-0001"].includes(text.toUpperCase()) ? { worker_id: "w1", name: "Aziz K.", balance: 90 } : null,
    details: async () => ({
      packs: [{ pyols: 30, won: 3300 }, { pyols: 100, won: 9900 }, { pyols: 300, won: 24000 }],
      methods,
    }),
    storeProof: async (w, f) => `${w}/${f}.jpg`,
    requestTopup: async (worker, pyols, payer, proof) => {
      if (tooMany) throw new Error("TOO_MANY");
      requests.push({ worker, pyols, payer, proof });
    },
    send: async (_id, text, buttons) => void sent.push({ text, buttons }),
    answerCallback: async () => {},
  };
  return { deps, sent, requests, chats, setTooMany: () => (tooMany = true) };
}

const msg = (text: string) => ({ message: { chat: { id: 7, type: "private" }, from: { first_name: "Aziz" }, text } });
const photo = { message: { chat: { id: 7, type: "private" }, from: { first_name: "Aziz", username: "aziz" }, photo: [{ file_id: "s" }, { file_id: "big" }] } };
const pick = (pyols: number) => ({ callback_query: { id: "1", data: `pack:${pyols}`, message: { chat: { id: 7 } } } });

Deno.test("the whole flow: code → pack → details → screenshot → request", async () => {
  const f = fake();
  await handle(msg("/start"), f.deps);
  assertEquals(f.sent.at(-1)!.text, T.hello);
  await handle(msg("nope99"), f.deps);
  assertEquals(f.sent.at(-1)!.text, T.notFound);
  await handle(msg("aziz01"), f.deps);
  assertEquals(f.sent.at(-1)!.text, "Topildi: Aziz K.\nBalans: 90 P\n\nQancha puyl kerak?");
  assertEquals(f.sent.at(-1)!.buttons![1][0], { text: "100 P — 9 900 ₩", data: "pack:100" });
  // A screenshot before a pack: asks for the pack.
  await handle(photo, f.deps);
  assertEquals(f.sent.at(-1)!.text, T.needPack);
  await handle(pick(100), f.deps);
  assertEquals(f.sent.at(-1)!.text.includes("🏦 Bank: KB 123-45 (Hanguk)"), true);
  assertEquals(f.sent.at(-1)!.text.startsWith("100 P = 9 900 ₩"), true);
  await handle(photo, f.deps);
  assertEquals(f.sent.at(-1)!.text, T.thanks);
  assertEquals(f.requests, [{ worker: "w1", pyols: 100, payer: "Aziz (@aziz) · Telegram", proof: "w1/big.jpg" }]);
  // The pack is used up: the next screenshot asks again.
  await handle(photo, f.deps);
  assertEquals(f.sent.at(-1)!.text, T.needPack);
});

Deno.test("no payment details yet; too many requests; strangers and groups", async () => {
  const f = fake({});
  await handle(msg("010-0000-0001"), f.deps);
  await handle(pick(30), f.deps);
  assertEquals(f.sent.at(-1)!.text, T.noDetails);

  const g = fake();
  await handle(msg("AZIZ01"), g.deps);
  await handle(pick(30), g.deps);
  g.setTooMany();
  await handle(photo, g.deps);
  assertEquals(g.sent.at(-1)!.text, T.tooMany);

  const h = fake();
  await handle(photo, h.deps);
  assertEquals(h.sent.at(-1)!.text, T.needWorker, "a screenshot from a stranger");
  await handle(pick(30), h.deps);
  assertEquals(h.sent.at(-1)!.text, T.needWorker, "a pack from a stranger");
  const before = h.sent.length;
  await handle({ message: { chat: { id: -5, type: "group" }, text: "AZIZ01" } }, h.deps);
  assertEquals(h.sent.length, before, "groups are ignored");
});

Deno.test("won", () => {
  assertEquals(wonText(24000), "24 000 ₩");
  assertEquals(wonText(3300), "3 300 ₩");
});
