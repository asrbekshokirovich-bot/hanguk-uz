# An AI Phone Agent that Talks in Natural Uzbek — Research & Plan

**Goal (as requested):** an AI that **answers and conducts phone calls itself**, speaks **fluent, accent‑free Uzbek**, responds **without long pauses** (natural turn‑taking), and is **as human‑sounding as possible** so callers don't feel they're talking to a machine.

**Scope decided with the requester:** (1) build a **working demo first** to judge voice quality + latency before committing; (2) use a **managed voice‑agent platform + our own Uzbek voice** (not a from‑scratch media server yet); (3) **sound fully human but give a brief, light "virtual assistant" disclosure up front** (legally safe, still natural).

**Date:** 2026‑06‑19. Vendor capabilities, latency and pricing are 2025–2026 figures gathered from 5 parallel web‑research passes; the softest data (exact per‑minute prices, Azure voice *quality*, and whether sip.uz exposes a SIP trunk) is flagged throughout — **re‑confirm before billing/contract decisions.** This sits alongside the staff‑intercom research in [`livekit-1to1-ptt-intercom.md`](./livekit-1to1-ptt-intercom.md); that is push‑to‑talk between staff, this is an autonomous phone agent — different problem, shared LiveKit/Supabase muscle memory.

---

## 0. Executive verdict

**The whole project hinges on one thing: there is essentially *one* production‑grade way to make a computer speak natural Uzbek today — Microsoft Azure Neural TTS** (voices `uz-UZ-MadinaNeural` / `uz-UZ-SardorNeural`). Almost every famous voice‑AI engine that powers human‑sounding English agents — **ElevenLabs, Google, Cartesia, Deepgram, OpenAI, PlayHT, Rime, Amazon Polly — does NOT speak Uzbek at all.** A dangerous trap runs through the whole market: several of them (ElevenLabs, Google) support Uzbek for **speech‑to‑text** but **not** text‑to‑speech. *Understanding* Uzbek ≠ *speaking* it.

Three consequences fall out of that:

1. **No "speech‑to‑speech" model speaks Uzbek** (OpenAI Realtime, Gemini Live, AWS Nova Sonic, Ultravox, Kyutai all exclude Uzbek output). So the magic ~300 ms end‑to‑end voice models are **off the table**. We must build a **cascade**: Uzbek STT → LLM (our existing Gemini brain) → Uzbek TTS. Realistic, well‑tuned cascade latency is **~700 ms–1 s** round‑trip — good enough to feel natural if we engineer it, not as instant as English speech‑to‑speech.

2. **The honest ceiling on "indistinguishable from human" is lower for Uzbek than English.** Uzbek is a *low‑resource* language; its TTS prosody (stress, intonation, emotion) — the very thing that makes English agents pass as human — is the first thing that degrades. A realistic verdict: **"intelligible and reasonably natural for short, focused calls, but identifiably synthetic to an attentive listener."** A *fully* undetectable Uzbek phone agent is **not achievable in 2026.** This is why the brief upfront disclosure (below) is the right call anyway — it captures ~all of the "sounds human" UX benefit and removes the legal/reputational downside.

3. **The build is mostly integration, not invention** — and we already own most of it. We have Uzbek STT (ElevenLabs Scribe), the LLM brain (`hanguk-ai-chat`, Gemini 2.5 Flash, with student/lead retrieval), the phone identity spine (`resolveIdentity`, `communication_identities`), lead capture, and call logging. The genuinely new pieces are: **(a) an Uzbek voice (Azure), (b) a real‑time turn‑taking loop, and (c) a live media bridge from our phone line.**

**Recommended stack for the demo → production:**

> **Telephony/turn‑taking:** a managed platform — **Vapi** (fastest) for the demo, with **LiveKit Agents** as the self‑host graduation path for latency/data‑residency.
> **Uzbek voice (TTS):** **Azure `uz-UZ-MadinaNeural`/`SardorNeural`** as default, **A/B‑tested against Yandex SpeechKit Uzbek and Aisha AI (Tashkent)** — because Azure gives only 2 voices, no custom‑voice training, and has occasional latency spikes.
> **Uzbek ears (STT):** **ElevenLabs Scribe** (we already use it) or Azure `uz-UZ`, picked by measured accuracy on *real* call audio.
> **Brain:** our existing **`hanguk-ai-chat` / Gemini**, exposed to the agent as a webhook tool (student lookup + lead capture into Supabase).
> **Region:** run media + models in **europe‑central (Frankfurt)**, never us‑east — Tashkent→Frankfurt is ~86 ms, Tashkent→US adds ~400–500 ms RTT and pushes the call past 1 s (laggy).
> **Disclosure:** one short Uzbek line at answer time — *"Assalomu alaykum, men Hanguk Education'ning virtual yordamchisiman…"* — then be as natural as the tech allows.

**The one thing that can block everything:** whether **Mediateka / sip.uz gives us a real SIP trunk** (host/port/codec/credentials) or only the closed webhook‑PBX we use today. If it's webhook‑only, we cannot bridge live audio without their cooperation. **This must be confirmed with the provider first** (questions in §7). For the *demo* we sidestep it by using a platform‑provisioned number.

---

## 1. The crux: speaking Uzbek (TTS)

This is the make‑or‑break. Findings, with the important "does it actually speak Uzbek?" column:

| Engine | Speaks Uzbek? | Notes | Source |
|---|---|---|---|
| **Microsoft Azure Neural TTS** | **YES ✅** | The only tier‑1 cloud with real Uzbek voices: `uz-UZ-MadinaNeural` (F), `uz-UZ-SardorNeural` (M). Native‑speaker‑trained → genuinely accent‑free. *Standard* neural (not the newer expressive HD tier); only **2 voices**; **no Custom Neural Voice for Uzbek** (can't train a brand voice). $15/1M chars. Watch tail‑latency spikes — buffer. | [Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support), [pricing](https://azure.microsoft.com/en-us/pricing/details/speech/), [CNV Uzbek not supported](https://learn.microsoft.com/en-us/answers/questions/1652080/request-for-support-in-developing-a-neural-tts-sys) |
| ElevenLabs (v3 / Multilingual v2 / Flash) | **NO ❌** | Uzbek is in **none** of the TTS language lists. Scribe *transcribes* Uzbek — different capability. Voice‑cloning an Uzbek speaker reproduces timbre but **won't speak intelligible Uzbek**. | [ElevenLabs languages](https://help.elevenlabs.io/hc/en-us/articles/13313366263441), [PVC languages](https://help.elevenlabs.io/hc/en-us/articles/19569659818129) |
| Google Cloud TTS (Chirp 3 HD etc.) | **NO ❌** | 31‑language Chirp 3 list has Turkish + Russian but **no `uz-UZ`**. (Google STT *does* do Uzbek — the trap again.) | [Chirp 3 HD list](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd) |
| Amazon Polly | **NO ❌** | Uzbek not in neural or standard voice lists (only in Amazon *Translate*). | [Polly languages](https://docs.aws.amazon.com/polly/latest/dg/SupportedLanguage.html) |
| Cartesia / Deepgram Aura / OpenAI / PlayHT / Rime | **NO ❌** | The entire low‑latency "voice‑agent‑native" TTS category skips Uzbek. PlayHT's "142 languages" does not evidence Uzbek. | [Cartesia langs](https://cartesia.ai/all-languages), [Deepgram TTS](https://developers.deepgram.com/docs/tts-models) |
| **Aisha AI** (Tashkent) | **YES (local) ✅** | Local Uzbek stack: TTS (6 voices, emotion control), voice **cloning**, dialect tuning, explicit **IVR/call‑center** focus. **No independent latency/MOS/pricing** — vendor‑claimed. Best route if we need a custom/owned Uzbek voice or more variety than Azure's two. | [aisha.group/text-to-speech](https://aisha.group/en/text-to-speech) |
| **Yandex SpeechKit** | **YES (under‑documented) ✅?** | Uzbek synthesis announced 2023 (Latin, real‑announcer‑trained, phoneme‑level control). **Bonus: Yandex Cloud has a Central‑Asia (Kazakhstan) region** → lowest geographic latency to Tashkent + native Uz/Ru. Verify voice names/quality directly. | [globalcio](https://globalcio.com/news/9699/), [Yandex CA region](https://orient.tm/en/post/71107/) |
| Open‑source (TurkicTTS, Coqui XTTS, MMS‑uzb) | weak | TurkicTTS Uzbek ≈ 2.85/5 quality, 41% intelligibility; XTTS has no Uzbek; MMS‑uzb robotic. Only viable if we *train our own* on **FeruzaSpeech** (60 h native corpus) — a real ML project. | [TurkicTTS](https://github.com/IS2AI/TurkicTTS), [FeruzaSpeech](https://arxiv.org/abs/2410.00035) |

> ⚠️ Most third‑party "Uzbek TTS" websites (Narakeet, SpeechGen, Fliki, Verbatik, LOVO…) are just **reselling the same two Azure voices** — no quality advantage over going to Azure directly.

**Decision:** **Azure is the default Uzbek voice.** Because it's only two standard‑neural voices with known latency spikes, **Phase 0 of the plan A/B‑tests Azure vs Yandex vs Aisha with a native Uzbek listener before we build anything** — voice quality is the single biggest product risk, so we de‑risk it first and cheaply.

---

## 2. Hearing Uzbek (STT)

Better news here — three independent providers do Uzbek, and we already run one.

| Engine | Uzbek? | Real‑time? | Notes | Source |
|---|---|---|---|---|
| **ElevenLabs Scribe v2** | **YES** | v2 Realtime ~150 ms (Uzbek in the realtime tier plausible, confirm) | We already use Scribe for Uzbek call transcription. Vendor‑claimed Uzbek WER 3.1% FLEURS / 5.5% Common Voice — but those are *clean read‑speech*, not 8 kHz phone + Russian code‑switch. | [Scribe Uzbek](https://elevenlabs.io/speech-to-text/uzbek), [v2 realtime](https://elevenlabs.io/blog/introducing-scribe-v2-realtime) |
| **Azure STT** `uz-UZ` | **YES** | "fast transcription"/custom = near‑real‑time, **not true streaming** | Pairs with Azure TTS on one vendor/bill, but the live‑streaming caveat matters for turn‑taking. | [Azure STT langs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) |
| **Google STT** `uz-UZ` (Chirp) | **YES** | streaming **varies by method** — must confirm `uz-UZ` supports `StreamingRecognize` | Good endpointing controls if streaming is confirmed. | [Chirp 3](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3) |
| **Yandex SpeechKit** `uz-UZ` + `ru-RU` | **YES** | streaming | Strong for **Uzbek↔Russian code‑switching** (Russian is first‑class) + CA region. | [Yandex SpeechKit](https://yandex.cloud/en/services/speechkit) |
| Local: **Mohir.ai / UzbekVoice**, **Aisha**, **Muxlisa** (Uzinfocom) | **YES** | unverified streaming | Purpose‑built for Uzbek dialects + Uz/Ru mixed calls; Muxlisa claims 11.39% WER on *telephony* audio. Streaming latency undocumented — confirm. | [mohir.ai](https://mohir.ai/en-US), [muxlisa](https://muxlisa.uz/en) |
| Deepgram | **NO ❌** | — | Best latency/turn‑taking stack but **zero Uzbek** (does Russian). | [Deepgram langs](https://developers.deepgram.com/docs/models-languages-overview) |
| Whisper large‑v3 | nominally | non‑streaming | Low‑resource → poor Uzbek WER without fine‑tuning; not streaming. Avoid for live. | [HF model](https://huggingface.co/openai/whisper-large-v3) |

**Decision:** start with **ElevenLabs Scribe** (already integrated, best published Uzbek numbers). Keep **Azure `uz-UZ`** and **Yandex** as drop‑in alternates; **benchmark all three on our own recorded Uzbek calls** (we already store recordings) — real code‑switched phone audio is the only test that matters.

---

## 3. Architecture & latency (the "no long pauses" requirement)

**Mandatory shape — cascade** (because no S2S speaks Uzbek):

```
 Caller (Uzbek)
   │  G.711 µ-law 8kHz over SIP
   ▼
 Telephony bridge (Vapi managed → later LiveKit self-host)   ── handles VAD,
   │   endpointing, barge-in / interruption, audio buffering    turn-taking
   ├─► Uzbek STT  (Scribe / Azure / Yandex)        ~150–400 ms
   ├─► LLM brain  (our hanguk-ai-chat / Gemini)     TTFT ~200–400 ms
   │     └─ webhook TOOL → Supabase: get_student_360, capture_lead, find_program
   └─◄ Uzbek TTS (Azure uz-UZ, streamed)            TTFA ~100–300 ms
   ▼
 Caller hears reply       target round-trip ≈ 700 ms–1 s
```

**Human conversation gaps are ~200–300 ms; users notice >800 ms; >1.5 s feels broken.** Levers that keep us in budget:

- **Co‑locate everything in Frankfurt.** Tashkent↔Europe ≈ **86 ms**; Tashkent↔US ≈ **180–250 ms each way**. Routing to a US AI endpoint alone can add ~400–500 ms RTT → >1 s calls. (Vapi/Bland default to **US media — a red flag**; force an EU region or use LiveKit/jambonz placed in Frankfurt.)
- **Model‑integrated / semantic endpointing** (not a fixed silence timer) is the dominant latency variable — it decides *when the caller finished talking*. Get this wrong and the agent either talks over people or sits in dead air.
- **Barge‑in**: caller can interrupt; agent audio stops immediately. Table stakes for "natural."
- **Stream TTS** (first audio while the sentence is still generating) and **buffer Azure** against its latency spikes.
- **Filler/backchannel** ("hmm", "ha, albatta") to mask the inevitable Uzbek‑cascade latency and read as human — but sparingly (over‑use is itself a tell).

**Speech‑to‑speech status (for the record):** OpenAI Realtime, Gemini Live (24 native‑audio langs), AWS Nova Sonic (7 langs), Ultravox (42 langs), Kyutai (EN/FR) — **none output Uzbek.** Revisit only when a provider adds Uzbek voice. Until then, cascade is the only path.

---

## 4. Build vs buy — platform choice

Every candidate has webhooks/tool‑calling and bring‑your‑own SIP. The deciding question is **"can it speak Uzbek by plugging in Azure `uz-UZ` TTS?"**

| Platform | Speaks Uzbek (via Azure)? | BYO SIP | Self‑host | Verdict for us |
|---|---|---|---|---|
| **Vapi** | **Yes** — Azure is a native TTS provider; custom transcriber too | Yes (any carrier) | Enterprise on‑prem | **Best for the demo.** Lowest‑friction Azure‑Uzbek + Uzbek SIP + Supabase webhooks. ~$0.05/min platform + passthrough. EU region available. |
| **LiveKit Agents** | **Yes** — Azure TTS plugin + any STT, +MCP | Yes (any carrier) | **Fully self‑host** | **Best for production.** Same Azure Uzbek, but we own placement (Frankfurt/Tashkent) for latency + data‑residency. We already use LiveKit for the staff intercom — reuse the muscle. |
| **Pipecat (Daily)** | **Yes** — Azure service + any STT | Yes | **Fully self‑host** | Equivalent to LiveKit; pick on Python preference. |
| **Retell AI** | **Probably** (Azure supported; confirm `uz-UZ` *voice* is selectable) | Yes ($0 own‑SIP) | Cloud (US data) | Cheap, great webhooks; verify Azure Uzbek voice + EU placement before committing. |
| **ElevenLabs Agents** | **Listens yes, speaks NO** (TTS locked to ElevenLabs, no Uzbek) | Yes (native SIP) | Cloud | Dealbreaker — can't speak Uzbek. |
| **Synthflow** | No (Deepgram+ElevenLabs default; no Uzbek path) | Yes | Cloud | Not viable. |
| **Bland AI** | No (closed stack, no BYO STT/TTS) | Yes | No | Disqualified for Uzbek. |

Sources: [Vapi multilingual/Azure](https://docs.vapi.ai/customization/multilingual) · [Vapi BYO SIP](https://docs.vapi.ai/advanced/sip/sip-trunk) · [LiveKit agents](https://docs.livekit.io/agents/) · [LiveKit SIP](https://docs.livekit.io/sip/sip-trunk/) · [Retell custom telephony](https://docs.retellai.com/deploy/custom-telephony) · [ElevenLabs v3 langs — no Uzbek](https://x.com/elevenlabsio/status/1933557207582355635) · [Bland closed stack](https://telnyx.com/resources/bland-ai-alternatives).

**Decision:** **Vapi for the demo** (managed, matches the requester's choice), **LiveKit Agents as the production target** (self‑host in Frankfurt; we already run LiveKit). Both use the **same Azure Uzbek voice + same Supabase tool webhook + same Gemini brain**, so nothing built for the demo is thrown away.

---

## 5. Telephony bridge (getting live audio from our line)

Today **Mediateka/sip.uz is webhook + post‑call recording only** — no live media. To answer calls live we need a **SIP trunk**. Options, ranked:

1. **LiveKit Agents (EU, with SIP pinning)** — accepts our Uzbek trunk via standard G.711 SIP, agent runs in Frankfurt next to the models, ~$0.003–0.004/min SIP + ~$0.01/min agent, self‑hostable later. **Best overall.**
2. **jambonz (self‑host in Frankfurt or Tashkent)** — MIT open‑source universal SIP↔websocket bridge; we own media placement and pay ~zero per‑minute markup. Best if sip.uz's trunk is quirky or audio must stay in‑region.
3. **Telnyx Voice AI / Twilio ConversationRelay (BYOC)** — polished managed bridges, EU PoPs, ~$0.05–0.07/min; one bill, less ops.
4. **Vapi/Retell direct BYO trunk** — fastest to prototype but **US‑default media** unless forced through an EU gateway.

**For the demo:** use a **Vapi‑provisioned EU number** (zero dependency on sip.uz) to validate voice + latency, then graduate to the real Uzbek number once the SIP‑trunk questions (§7) are answered.

**Regulatory note (Uzbekistan):** the new Telecom Law (LRU‑1015, in force Dec 2024) is liberalizing — from Jan 2025 licensed operators may connect directly to international networks. The real constraints are **(a) whether sip.uz's terms permit re‑originating/bridging the trunk to a third party**, and **(b) communications‑secrecy/data‑protection on call recordings** streamed abroad. Conservative posture: keep media in‑region (jambonz/Asterisk on an EU or Tashkent VM) and have local counsel confirm. ([gazeta.uz](https://www.gazeta.uz/en/2024/06/04/telecommunications/))

---

## 6. Sounding human + the legal line (disclosure)

**Naturalness techniques (state of the art):** sub‑500 ms response is the biggest "human" signal; add disfluencies/fillers, backchannels, prosody variation, barge‑in handling, and *avoid robotic over‑perfection*. Reality check: for **short, focused** calls, 2025–26 agents fool a large fraction of listeners in *English*; over long/open‑ended/adversarial calls, latency, memory slips and uncanny artifacts still give them away. **For low‑resource Uzbek the bar is lower still** — prosody is weak, so "fully indistinguishable" is not realistic in 2026. Design for *short, well‑scoped* call flows (greet → understand need → answer 1–2 study‑abroad questions → capture lead / book a human callback), not open‑ended chat.

**Disclosure — the decided approach (brief, upfront, still natural):** open every call with one short line, e.g.

> *"Assalomu alaykum! Men Hanguk Education'ning virtual yordamchisiman. Sizga qanday yordam bera olaman?"*
> ("Hello! I'm Hanguk Education's virtual assistant. How can I help you?")

…then be as warm, fast and natural as the tech allows. This single line satisfies essentially every relevant rule and removes the legal/reputational risk of concealment:

- **Uzbekistan — AI Law LRU‑1115** (signed **21 Jan 2026**) mandates **labeling of AI‑generated content *including audio*** and adds personal‑data‑via‑AI penalties (~20.6–41.2M soums). No rule literally says "announce at call start," but the audio‑labeling duty + anti‑deepfake purpose point straight at disclosure. ([babl.ai summary](https://babl.ai/uzbekistan-adopts-new-law-to-regulate-artificial-intelligence-use-across-sectors/), [gazeta.uz fines](https://www.gazeta.uz/ru/2026/01/22/artificial-intelligence/))
- **EU AI Act Art. 50** — if any caller is in the EU, informing them they're talking to an AI is **mandatory from 2 Aug 2026**, given at first interaction; fines up to €15M or 3% of turnover. ([Art. 50](https://artificialintelligenceact.eu/article/50/))
- **US** — California SB 1001 (disclosure safe harbor), Utah (disclose if asked / upfront for regulated services), Colorado SB 26‑189 (notify when interacting with AI, from 2027), FTC §5 (undisclosed AI = deceptive practice). And critically, **FCC/TCPA: AI‑generated voice = "artificial voice"** → **prior express (written, for marketing) consent required for outbound** AI calls. ([FCC ruling](https://www.fcc.gov/document/fcc-makes-ai-generated-voices-robocalls-illegal))

**Bottom line:** *inbound* answering with a one‑line disclosure is low‑risk. **Outbound** AI calling is a separate, heavier regime (consent) — keep it out of the first build.

---

## 7. Open questions to confirm before/while building

1. **sip.uz / Mediateka SIP trunk (the #1 blocker).** Ask the provider: (a) Do you offer a SIP trunk / SIP account with credentials? (b) SBC/gateway IP(s), signaling port + transport (UDP 5060 / TLS 5061)? (c) Codec (expect G.711 µ‑law/alaw)? (d) Auth by registration or static IP? (e) Can an inbound DID be pointed at an arbitrary SIP URI / external softswitch? If **no trunk** → live bridging needs their cooperation; demo proceeds on a platform number meanwhile.
2. **Azure Uzbek voice quality** — does a native speaker judge Madina/Sardor good enough? If not → A/B Yandex Uzbek and Aisha (§1).
3. **Uzbek STT accuracy on *our* phone audio** (8 kHz, Uz↔Ru code‑switch) — benchmark Scribe vs Azure vs Yandex on stored recordings.
4. **Latency** — confirm we can pin media + models to **Frankfurt** end‑to‑end.
5. **Data residency** — is streaming call audio/recordings to an EU cloud acceptable under Uzbek comms‑secrecy/data‑protection rules? (local counsel).

---

## 8. Phased plan (mapped to this codebase)

The plan front‑loads the two real risks — **voice quality** and **live latency** — and reuses what we already have (`hanguk-ai-chat`, identity spine, `calls`/`leads`, Scribe).

**Phase 0 — Voice quality bake‑off (½–1 day, ~$0, no telephony).**
Generate ~15 real Hanguk sentences in Uzbek (greeting + disclosure, GKS/TOPIK/visa answers, "let me take your number") with **Azure Madina & Sardor**, **Yandex Uzbek**, and **Aisha**. A native speaker rates accent/naturalness/clarity. *Gate:* pick the voice. If none passes → escalate to custom voice (Aisha clone or train on FeruzaSpeech) before going further. **De‑risks the entire project for almost nothing.**

**Phase 1 — Demo agent on a test number (2–4 days).**
- New Supabase Edge Function **`voice-agent-brain`** (Deno) — the agent's tool endpoint. Reuses `hanguk-ai-chat`'s retrieval + `resolveIdentity()`; tools: `get_student_360(phone)`, `find_program(query)`, `capture_lead({name,phone,interest})` → writes to `leads`. A tight study‑abroad **system prompt + the Uzbek disclosure line**, scoped to short flows.
- A **Vapi** agent (EU region): Azure `uz-UZ` TTS (Phase‑0 winner) + Scribe/Azure Uzbek STT + Gemini + the `voice-agent-brain` webhook tool. Provision a Vapi EU number.
- *Gate:* call the number, hold a real Uzbek conversation. Measure round‑trip latency and naturalness; confirm lead capture lands in the CRM. **This is the demo to judge before committing.**

**Phase 2 — Connect the real line + log into the CRM (1–2 weeks, after §7.1 answered).**
- Bridge sip.uz → the agent. If sip.uz exposes a trunk: point it at **LiveKit Agents (Frankfurt)** or **jambonz**; otherwise work with the provider. Port the Phase‑1 agent (same Azure voice, same `voice-agent-brain` tool) to LiveKit.
- Log AI calls into `calls`/`call_transcripts`/`call_analyses` exactly like human calls (reuse the Communication Intelligence pipeline) so the CRM timeline is unified. Add a **"handoff to human"** path (transfer or scheduled callback) for anything out of scope.

**Phase 3 — Hardening & guardrails.**
Tune endpointing/barge‑in/fillers; add per‑caller rate limits and abuse guards; refusal/escalation for sensitive topics (visa/legal/financial advice → human); dashboards for latency + transcripts; only *then* consider outbound (with the separate consent regime).

**Reused vs new:**
- **Reuse:** `hanguk-ai-chat` (Gemini brain + retrieval), `_shared/identity.ts` (`resolveIdentity`, phone normalization), `calls`/`leads`/`call_transcripts`/`call_analyses`, ElevenLabs Scribe, LiveKit + `turn-credentials` know‑how, `voip-webhook` patterns.
- **New:** `voice-agent-brain` edge function (tool endpoint), an **Azure Speech** account + secret, a Vapi (then LiveKit‑agent) deployment in Frankfurt, the SIP bridge, and the agent system prompt/flow design.

---

## 9. Cost sketch (per‑minute, verify before billing)

| Layer | Demo (Vapi) | Production (LiveKit self‑host) |
|---|---|---|
| Platform/agent | ~$0.05/min (Vapi) | ~$0.01/min agent + infra (Frankfurt VM) |
| SIP/telephony | platform number | ~$0.003–0.004/min + carrier |
| Uzbek STT | Scribe/Azure passthrough | same |
| Uzbek TTS | Azure ~$15/1M chars | same |
| LLM | Gemini 2.5 Flash (cheap) | same |
| **All‑in (rough)** | **~$0.10–0.20/min** | **lower per‑minute, more ops** |

A demo costs only test minutes; the real cost decision is Phase 2 (managed vs self‑host) and is dominated by call volume.

---

## 10. Confidence & sourcing

- **High (cross‑corroborated by ≥2 independent passes):** Azure is the only tier‑1 Uzbek TTS; ElevenLabs/Google/Cartesia/Deepgram/OpenAI/Polly do **not** speak Uzbek; **no speech‑to‑speech model outputs Uzbek**; Uzbek STT exists (Scribe/Azure/Google/Yandex); Vapi/LiveKit/Pipecat can plug in Azure Uzbek + BYO SIP + webhooks; cascade ≈ 700 ms–1 s is the realistic latency; Tashkent↔EU ≈ 86 ms vs US adds ~400–500 ms; brief upfront disclosure is the legally safe + natural posture; EU AI Act Art. 50 (Aug 2026), Uzbek AI Law LRU‑1115 (Jan 2026), FCC/TCPA outbound consent.
- **Medium / verify before committing:** exact per‑minute prices; whether Scribe/Google `uz-UZ` are in the *streaming* tier; whether Retell exposes Azure `uz-UZ` *voice*; Azure Uzbek voice *quality* (no independent MOS); local vendors' (Aisha/Mohir) streaming latency.
- **Unknown until we ask the provider:** whether **sip.uz/Mediateka offers a registrable SIP trunk** — the gating dependency for live audio.
- **Methodology:** several vendor doc domains (Twilio, LiveKit, Vapi, MS Learn, gov/regulatory) return HTTP 403 to automated fetch; those facts rest on search extracts cross‑checked against reputable secondary sources and are flagged where softest.

### Key sources
Azure Uzbek voices & pricing: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support · https://azure.microsoft.com/en-us/pricing/details/speech/ — ElevenLabs (no Uzbek TTS; Scribe STT): https://help.elevenlabs.io/hc/en-us/articles/13313366263441 · https://elevenlabs.io/speech-to-text/uzbek — Google Chirp 3 (no Uzbek TTS): https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd — S2S language limits: https://openai.com/index/introducing-gpt-realtime/ · https://ai.google.dev/gemini-api/docs/live-api/capabilities · https://aws.amazon.com/nova/models/ — Platforms: https://docs.vapi.ai/customization/multilingual · https://docs.livekit.io/agents/ · https://docs.retellai.com/deploy/custom-telephony — Telephony/SIP & latency: https://docs.livekit.io/sip/sip-trunk/ · https://www.twilio.com/docs/voice/conversationrelay · https://livekit.com/blog/checklist-for-regional-deployments — Local Uzbek vendors: https://aisha.group/en · https://mohir.ai/en-US · https://muxlisa.uz/en · https://globalcio.com/news/9699/ — Legal: https://artificialintelligenceact.eu/article/50/ · https://babl.ai/uzbekistan-adopts-new-law-to-regulate-artificial-intelligence-use-across-sectors/ · https://www.fcc.gov/document/fcc-makes-ai-generated-voices-robocalls-illegal
