# Self‑hosted call queuing (ACD) and IVR — no PBX vendor, no monthly bill

**Ask:** route incoming calls fairly across several staff ("call operators") and
let callers reach the right person by purpose of call ("press 1 for
admissions…") — built and owned entirely by Hanguk, with **no Mediateka, no
cloud PBX subscription, and no recurring payment to any telephony company.**

**Decision already made** (2026‑09‑02, confirmed with the owner): a one‑time
hardware purchase is acceptable (a small box that turns SIM cards into phone
lines a computer can use); a spare PC or a cheap mini‑PC will run the software;
the IVR starts as a simple press‑1/press‑2 menu, not an AI voice agent. This
document is written directly to that decision.

**Companion document:** `docs/research/mobile-call-capture.md` covers call
*recording* (the mobile Call Sync plan and the YINGXIN desk phone). This
document is about call *routing* — who a call rings and in what order — which is
a separate problem needing a separate piece of hardware.

---

## 0. The one fact that decides everything

**A single phone (the YINGXIN desk phone, or anyone's mobile) cannot, by
itself, ring "whoever's turn it is" among several people.** Each SIM card only
rings the one device it's inserted into. To distribute one shared number's
calls across multiple staff, something has to sit *between* the call and your
phones and decide who gets it. That something is what the rest of this
document is about — and it does **not** have to be a company you pay monthly.

**The answer: buy a small GSM gateway box once, run free software on a PC you
already have.** This is a completely standard, very common DIY setup:

```
 Caller dials your business SIM number
              │
              ▼
   ┌─────────────────────────┐
   │   GSM gateway box        │   ← one‑time purchase, ≈ $60–500
   │   (holds 1–8 SIM cards)  │      (§2)
   └─────────────┬─────────────┘
                 │ turns the GSM call into a VoIP call (SIP), over your
                 │ office network/Wi‑Fi — no internet telephony company involved
                 ▼
   ┌─────────────────────────┐
   │   Asterisk / FreePBX      │   ← free, open‑source, runs on a spare PC
   │   (self‑hosted, your PC)  │      or a $50–100 mini‑PC / Raspberry Pi (§3)
   │                            │
   │   IVR: "Press 1 for…"     │   ← §4
   │   Queue: rings staff in   │   ← §5
   │   a fair order, skips     │
   │   whoever's away          │
   └─────────────┬─────────────┘
                 │ rings staff extensions — desk IP phones, a softphone app
                 │ on their computer, or a SIP app on their mobile
                 ▼
        Staff answer, same as any phone system
```

**What you actually pay for, ever:** the gateway box (once), the PC/mini‑PC
(once, or free if you already have a spare), and your normal SIM‑card carrier
bills (which you'd pay anyway). **Nothing recurring goes to a PBX or CRM‑telephony
company.** Asterisk is free software maintained by a non‑profit‑adjacent open
project (Sangoma/Digium), not a subscription.

The trade‑off, stated honestly: you are now the IT department for this system.
Someone has to set it up once, and keep the PC running and occasionally
updated. That is the real cost of "no third party" — time, not money.

---

## 1. What this buys you (ACD strategies — the "call turns" part)

Asterisk's queue engine (`app_queue`) is the software every commercial PBX
and cloud phone system copies. It gives you, for free, all of these:

| Strategy | Behavior | Best fit for a small team |
|---|---|---|
| `ringall` | Rings every available operator at once; first to pick up gets it. | Simplest, fastest — good default for 2–4 operators. |
| `rrmemory` (round‑robin) | Cycles through operators in order, remembering where it left off. | Simple, guaranteed fairness. |
| `leastrecent` | Rings whoever has gone longest without a call. | The fairest "everyone gets an even share" option — usually the recommended default once you have more than a couple of operators. |
| `linear` | Fixed order (e.g. front desk first, then a backup, then the owner). | Reception → escalation. |
| Penalty/skills tiers | Some operators get tried first, others only after a delay (e.g. Korean‑speaking staff first for a Korea‑track caller). | Route by what a caller needs, not just who's free. |

**"Skip whoever's away."** Asterisk tracks whether an operator is logged into
the queue and whether their line is busy/ringing, and skips them automatically.
Hanguk already has almost exactly this concept in the app today —
`StaffPresenceContext` (`src/contexts/StaffPresenceContext.tsx`) tracks each
staff member as `online / away / busy / offline` in real time via Supabase
Realtime. That table is a natural signal to feed into (or read back from)
the queue: e.g. a small bridge that logs a staff member's Asterisk queue
membership in or out whenever their CRM presence changes, so "away" in the
CRM also means "don't ring me" on the phone system.

**"You are caller number 3" / hold music / callback.** All standard,
free, built into `app_queue` — nothing to build.

Sources: Asterisk `queues.conf.sample` (https://github.com/asterisk/asterisk/blob/master/configs/samples/queues.conf.sample), FreePBX Queues module guide (https://sangomakb.atlassian.net/wiki/spaces/PG/pages/24510614/Queues+Module+User+Guide), community discussion on ring‑strategy choice (https://community.asterisk.org/t/need-some-help-understanding-queue-ring-strategy/32533).

---

## 2. The hardware: GSM gateway options and real prices

A GSM gateway is a small box with SIM card slots and an antenna. Each SIM
becomes a "line" that Asterisk can dial in and out of over your network, using
the standard SIP protocol — no telephony company involved, just your own
Ethernet/Wi‑Fi.

| Model | Ports (SIM cards) | Price found | Notes |
|---|---|---|---|
| **GoIP‑1** | 1 | roughly $50–90 (marketplace listings) | Cheapest way to try this with one SIM before committing further. |
| **GoIP‑8** | 8 | **$470** (goantifraud.com listing) | GoIP‑4 (4 ports) appears discontinued by some resellers in favour of the 8‑port model — check current availability. |
| **GoIP‑16** | 16 | **$780** (goantifraud.com listing) | Overkill for a small school; listed for scale reference. |
| **Dinstar UC2000/DWG‑2000E, 4 port** | 4 | **≈ $350** (Rs. 29,500 on buymyvoip.com) | Well‑documented Asterisk/FreePBX compatibility; a common recommendation in FreePBX community threads. |
| Dinstar 8/16/32‑port | 8–32 | $610–$1,140+ | For if the school grows well beyond a handful of lines. |

**Recommended starting point:** a **1‑ or 2‑port GoIP** to prove the whole
pipeline works with your existing SIM(s) before spending more, then move to a
4‑port Dinstar or GoIP‑8 once you know how many simultaneous lines the school
actually needs (rarely more than the number of operators answering calls at
once). None of these vendors are China/CIS‑exclusive — they ship
internationally; check a reseller for delivery to Uzbekistan and factor in
shipping/customs, which this research could not price precisely.

Every model above speaks standard SIP and is explicitly documented working
with Asterisk (multiple configuration walkthroughs exist, e.g.
https://ixnfo.com/en/configuring-goip4-with-asterisk.html and
https://blog.telarvostore.com/how-can-i-configure-a-goip-gateway-for-sip-registration-with-asterisk/).

Sources: https://goantifraud.com/en/goip-equipment/4-goip4 , https://www.buymyvoip.com/dinstar-4-port-gsm-gateway.html , https://nerdvittles.com/finally-a-100-portable-pbx-introducing-goip-a-sip-gsm-gateway-for-asterisk/

---

## 3. The software and the machine it runs on

**Asterisk** is the underlying free PBX engine. **FreePBX** is a free web
dashboard on top of it so you configure queues/IVR by clicking, not by editing
text config files by hand — this is the combination almost everyone
self‑hosting a small PBX actually uses.

- Runs comfortably on a **spare PC** you already have, or a cheap **mini‑PC**,
  or even a **Raspberry Pi** (Pi 4 is well‑proven; Pi 5 has some
  community‑reported compatibility rough edges as of this research — worth
  testing before buying one specifically for this). A magazine‑published
  guide puts a full two‑phone PBX with these features "under £100" of
  hardware if you're starting from nothing (Raspberry Pi Official Magazine:
  https://magazine.raspberrypi.com/articles/raspberry-pi-telephone-exchange).
- Pre‑packaged install paths exist that make this a few‑hour project, not a
  from‑scratch build: RasPBX (https://github.com/playfultechnology/RasPBX),
  Incredible PBX, or a Docker image
  (https://github.com/epandi/asterisk-freepbx-rpi).
- All three major self‑hosted options (FreePBX, FusionPBX, 3CX self‑hosted)
  support voice, voicemail, IVR, queues, and recording out of the box — a
  2026 comparison is here: https://www.bigiron.cc/guides/self-hosted-pbx-freepbx-vs-fusionpbx-vs-3cx-2026.
  **FreePBX is the right default** here specifically because it's fully free
  and has by far the largest community (meaning more existing guides when
  something goes wrong).

**Ongoing cost:** electricity for the machine, nothing else. No license fee.

---

## 4. The IVR: "press 1 for admissions, 2 for payments…"

This is the cheap, mature part — FreePBX's IVR module is exactly a menu you
build by recording (or uploading) prompts and mapping digits to destinations
(an extension, a queue, another IVR for a sub‑menu). Setting up an IVR feeding
a queue is a documented, common pattern — see for example
https://community.freepbx.org/t/setting-up-ivr-and-queue-in-asterisk-freepbx/7596.

A sensible first version for the school:

```
Caller dials in → IVR plays a short recorded greeting in Uzbek (+ Russian) →
  "1" → Admissions queue  (rings admissions staff, leastrecent strategy)
  "2" → Payments queue     (rings finance/admin staff)
  "3" → Existing student support
  "0" or timeout → front desk / owner
```

Record the prompts once (a phone voice memo is enough quality‑wise), upload
them in FreePBX, done. No ongoing cost, no AI, no third party.

**A future option, not part of this build:** letting callers just *say* why
they're calling instead of pressing digits needs an AI voice agent, and every
mainstream managed platform for that (Vapi, Retell AI, Bland AI, Twilio
ConversationRelay) is itself a third‑party company you'd pay per call — which
conflicts with today's decision, so it's intentionally out of scope. If this
is ever revisited, the one relevant fact worth keeping: of the platforms
checked, only **Google's Gemini Live API explicitly lists Uzbek** as a
supported language (https://ai.google.dev/gemini-api/docs/live-api/live-translate);
Retell's published 55‑language list has Russian but confirms Uzbek is
**not** included. A self‑built version against Gemini's API would be a
pay‑as‑you‑go API cost (like the Gemini calls Hanguk already makes for call
analysis) rather than a PBX subscription — a different kind of "third party"
than what's being avoided here, worth distinguishing if it ever comes up
again.

---

## 5. Putting §1 and §4 together with what Hanguk already has

The practical build, in order:

1. **Buy one GoIP‑1** (cheapest way to prove SIP‑to‑GSM works with a real
   SIM) and set up Asterisk/FreePBX on a spare PC. Confirm you can receive and
   make a call through it.
2. **Add the IVR** (§4) in front of a single test queue.
3. **Add the queue(s)** (§1) with `leastrecent` or `ringall` and 2+ staff
   extensions (a free softphone app on each operator's computer/phone is
   enough to start — no need to buy desk IP phones yet).
4. **Bridge presence**, optionally: a small script/cron job that reads
   Hanguk's `staff_presence` table and logs the matching Asterisk queue member
   in/out, so marking yourself "away" in the CRM also stops your phone from
   ringing.
5. **Scale the gateway** (move to a 4‑port Dinstar/GoIP‑8, §2) once the
   pipeline is proven and you know how many simultaneous lines you need.
6. **Log calls into the CRM** the same way the recording plan already
   does — Asterisk can fire a webhook/AGI script on call events, feeding the
   same `calls` table and `resolveIdentity` pipeline described in
   `docs/research/mobile-call-capture.md`, so a routed call ends up attached to
   the right student exactly like every other call source in the system.

Nothing here needs Mediateka. If Mediateka is ever reconsidered later, the
research on it (what little is public) is preserved in git history of this
document, since it isn't relevant to the path chosen today.

---

## Sources

ACD / queuing
- Asterisk `queues.conf.sample`: https://github.com/asterisk/asterisk/blob/master/configs/samples/queues.conf.sample
- FreePBX Queues module guide: https://sangomakb.atlassian.net/wiki/spaces/PG/pages/24510614/Queues+Module+User+Guide
- Ring‑strategy discussion: https://community.asterisk.org/t/need-some-help-understanding-queue-ring-strategy/32533

GSM gateway hardware
- GoIP‑4/8/16 pricing and specs: https://goantifraud.com/en/goip-equipment/4-goip4
- Dinstar 4/8/16/32‑port pricing: https://www.buymyvoip.com/dinstar-4-port-gsm-gateway.html
- GoIP + Asterisk background: https://nerdvittles.com/finally-a-100-portable-pbx-introducing-goip-a-sip-gsm-gateway-for-asterisk/
- GoIP4‑Asterisk config walkthrough: https://ixnfo.com/en/configuring-goip4-with-asterisk.html
- GoIP SIP registration with Asterisk: https://blog.telarvostore.com/how-can-i-configure-a-goip-gateway-for-sip-registration-with-asterisk/

Self‑hosted PBX software/hardware
- Self‑hosted PBX comparison 2026 (FreePBX vs FusionPBX vs 3CX): https://www.bigiron.cc/guides/self-hosted-pbx-freepbx-vs-fusionpbx-vs-3cx-2026
- Raspberry Pi telephone exchange (Raspberry Pi Official Magazine): https://magazine.raspberrypi.com/articles/raspberry-pi-telephone-exchange
- RasPBX installer: https://github.com/playfultechnology/RasPBX
- Asterisk/FreePBX Docker image for Raspberry Pi: https://github.com/epandi/asterisk-freepbx-rpi
- FreePBX IVR‑into‑queue setup thread: https://community.freepbx.org/t/setting-up-ivr-and-queue-in-asterisk-freepbx/7596

AI voice‑agent language support (kept for future reference only — out of scope today)
- Gemini Live API supported languages (confirms Uzbek + Russian): https://ai.google.dev/gemini-api/docs/live-api/live-translate
- Retell AI supported languages (confirms Russian, excludes Uzbek): https://www.retellai.com/blog/how-to-use-ai-phone-agents-for-multilingual-communication

Hanguk's own code referenced
- `src/contexts/StaffPresenceContext.tsx` — existing online/away/busy/offline presence, the natural bridge point for queue membership.
- `docs/research/mobile-call-capture.md` — companion recording research; §6 there already discusses a GSM gateway for recording, which this document's gateway can serve double duty for once purchased.
