# Building a "Perfect" 1:1 Push‑to‑Talk Intercom on LiveKit + Supabase

**Scope:** Web / PWA only (no native iOS/Android). Strictly **1:1 push‑and‑hold‑to‑talk** (press a colleague, hold to talk, release to stop) — no group rooms, no full‑duplex, no ringing. Target users: ~7 staff today, headroom to ~50.
**Date:** 2026‑06‑09. API names verified against `livekit-client` **v2.19.x** and `livekit-server-sdk` **v2.15.x**. Pricing is the softest data (LiveKit blocks automated fetch; figures are from corroborating third‑party aggregators) — **re‑confirm on the LiveKit dashboard before billing decisions.**

---

## 0. Executive verdict

Your current feature *looks* broken mainly because of the **presence layer**, not the WebRTC plumbing: "online" is defined as "wrote a `staff_presence` heartbeat row in the last 60 s," and background‑tab timer throttling + a CRM nobody keeps in the foreground means **almost everyone is always "offline" and therefore non‑clickable** (verified live: 1 of 7 staff fresh‑online). On top of that you run a **second, independent presence signal** (Supabase Realtime presence on the `voice-channel`) that disagrees with the table, a **STUN‑only mesh** (no TURN → strict‑NAT/corporate peers never connect), and **autoplay‑blocked inbound audio**.

Moving to **LiveKit** fixes the media layer wholesale (managed SFU + managed TURN/TLS on 443 + battle‑tested reconnect). The decisive design choice is **how you do presence and how you route 1:1 audio**. Recommended:

> **Two‑plane architecture.**
> **Plane 1 — Signaling & Presence = one always‑connected Supabase Realtime channel** (`intercom`). Presence via Realtime **Presence** (`track`/`sync`/`join`/`leave`) — *not* a heartbeat table. This is the **single source of truth** for "who's available to talk."
> **Plane 2 — Media = LiveKit, connected on‑demand** for the duration of a call into an **ephemeral per‑pair room** `ptt-${[a,b].sort().join('_')}`. The caller summons the callee over Plane 1 (`broadcast`), so the receiver never has to "already be in the channel."

This eliminates every root cause, keeps you inside LiveKit's free tier, and cleanly separates "online status" (cheap, always‑on, Supabase) from "in a call right now" (LiveKit, only while talking). A simpler—but costlier—single‑plane variant (one always‑on LiveKit "office" room with selective subscription) is described in §9.

---

## 1. Why LiveKit over your hand‑rolled mesh

- **SFU vs mesh (the scalability core).** An SFU receives **one** upstream copy from a publisher and forwards it; a full mesh makes each peer **upload N−1 copies and encode N−1 times**. Mesh is comfortable only at ~2–5 participants; an SFU handles 5–100+ per room and clusters to thousands. Even at 7 users you're past mesh's comfort zone. *(High confidence. Sources: LiveKit SFU internals; Ant Media topology guide.)*
- **TURN is not optional.** ~10–30% of real‑world connections can't go peer‑to‑peer and must be relayed (symmetric NAT, corporate firewalls). STUN‑only **fails** for those users — exactly your "no TURN" gap. **LiveKit Cloud provides managed TURN including TURN/TLS over 443** (mimics HTTPS, traverses strict firewalls) with zero config. *(High. Sources: LiveKit firewall docs; videosdk/bloggeek TURN stats.)*
- **Reconnection is built‑in.** LiveKit auto‑reconnects with a fast **resume** (re‑establish signaling WS + ICE‑restart) and falls back to a **full reconnect**; emits `Reconnecting`/`Reconnected`/`Disconnected` and `ConnectionQualityChanged` (`EXCELLENT|GOOD|POOR|LOST`). You delete your bespoke ICE‑restart/health‑check/grace‑timer machinery. *(High; treat quality events as advisory — a few open issues report intermittent misfires.)*

### Cost (≈ as of 2026‑06; verify on dashboard)
- **Plans:** Build (free, no card) · Ship **$50/mo** · Scale **$500/mo** · Enterprise (custom). *(High.)*
- **Free Build tier:** ~**5,000 WebRTC connection minutes/mo** (one earlier source said 10,000 — **sources conflict, verify**), **50 GB** egress, no card. *(Med.)*
- **Metering model (changed 2024‑08‑06):** **downstream egress only** (upstream free), ~**$0.10–0.12/GB**; WebRTC connection minutes overage ~**$0.0005/min** with volume discounts (a no‑plan PAYG snippet said $0.006/min — band it). "Participant minutes = participants × minutes connected." *(High on model; Med on exact rates.)*
- **Audio is cheap.** Opus voice ≈ **12–96 kbps** vs video ≈ **2 Mbps** → 20–100× less egress. **For 1:1 voice your binding constraint is connection‑minutes, not GB.** *(High.)*
- **What this means for you:**
  - **On‑demand model (recommended):** minutes ≈ actual talk‑time only → comfortably **free** even at 50 users.
  - **Always‑on shared‑room variant (§9):** 7 staff connected ~6 h/day ≈ 55k min/mo → exceeds free; expect **Ship $50/mo + modest overage (~$50–100/mo all‑in)**. Mitigate by disconnecting LiveKit when the tab is hidden (web PTT can't run backgrounded anyway — see §7).
- **Self‑host?** Only if you need data residency/compliance or very high volume. It's a single Go binary (Redis only for multi‑node/egress) but **you must run TURN + a CA‑signed TLS cert** yourself. For 7–50 internal users, **Cloud is the right call.** *(Med/High.)*

---

## 2. Recommended reference architecture (the crisp design)

```
┌──────────────────────────── Browser (staff CRM, PWA) ────────────────────────────┐
│                                                                                    │
│  Plane 1: SIGNALING + PRESENCE  ── always connected while CRM open ──              │
│  Supabase Realtime channel "intercom"                                              │
│   • presence:  channel.track({user_id,name})  →  presenceState()  = who's online   │
│   • broadcast: "ptt-invite" {from,to,room}    = summon callee into a LiveKit room  │
│                                                                                    │
│  Plane 2: MEDIA  ── connected only during an actual call ──                        │
│  LiveKit Room  ptt-<sortedPairIds>                                                  │
│   • mic published once, MUTED; press = unmute, release = mute                      │
│   • caller restricts who may subscribe → server‑enforced 1:1                       │
└────────────────────────────────────────────────────────────────────────────────────┘
        │ fetch short‑lived token (per call)
        ▼
  Supabase Edge Function  POST /livekit-token   (verify_jwt=true)
   • auth.getUser() → trusted user.id
   • validate caller ∈ {a,b}; derive room = ptt-[a,b].sort().join('_')
   • mint AccessToken(API_KEY, API_SECRET, {identity:user.id, ttl:'10m'})
        .addGrant({roomJoin:true, room, canPublishSources:[MICROPHONE], canSubscribe:true})
   • API secret NEVER reaches the browser
        ▼
  LiveKit Cloud (SFU + managed TURN/TLS:443)  ← rooms auto‑create on join, auto‑close when empty
```

**Call flow (A presses B):**
1. A's press handler → fetch token for `room = ptt-A_B` → `room.connect()` (pre‑warmed) → ensure mic published+muted → `setMicrophoneEnabled(true)` (unmute).
2. A restricts its mic track so **only B** may subscribe (`setTrackSubscriptionPermissions`), and `broadcast` `ptt-invite{from:A, room}` on Plane 1.
3. B (already listening on Plane 1) fetches its token → `room.connect()` → subscribes to A → `room.startAudio()` (already unlocked) → hears A.
4. A releases → `setMicrophoneEnabled(false)` (mute) → optional `room.disconnect()` after a short idle window (keep alive for rapid repeat presses) → room auto‑closes when empty.

Why this kills each original bug: presence is push‑based and free (no 60 s heartbeat); the receiver is reachable because it listens on the always‑on Supabase channel (no "must already be in the voice channel"); NAT/firewall solved by LiveKit TURN; autoplay solved once via `startAudio()`; one presence authority, no dual‑source disagreement.

---

## 3. Auth — minting LiveKit tokens from a Supabase Edge Function

**Security model (load‑bearing):** the LiveKit **API key + secret live only in the Edge Function env**, never in the browser. The function authenticates the caller's Supabase JWT *before* issuing a LiveKit token, and **derives identity & room server‑side** (never trust them from the request body).

- Edge Functions enforce `verify_jwt = true` by default, but for *trustworthy* identity call **`auth.getUser()`** (it hits the Auth server; don't trust a decoded JWT's claims blindly). *(High. Supabase functions/auth docs.)*
- Header gotcha: the **user session JWT** goes in `Authorization: Bearer …`; new Supabase publishable/secret keys are **not JWTs** and go in `apikey`. `supabase.functions.invoke()` wires both automatically.
- v2 server SDK **runs on Deno** (import via `npm:`), and **`toJwt()` is async** (v1 was sync `toJWT()` — classic migration bug). Default token TTL is `6h`; use a short **`ttl:'10m'`** for join tokens (LiveKit refreshes already‑connected clients server‑side). *(High; verified from SDK source.)*
- Rooms **auto‑create on first join and auto‑close** after empty (`emptyTimeout`/`departureTimeout` are server `CreateOptions`, not token fields) — you don't pre‑create rooms. *(High.)*
- `canPublishSources:[TrackSource.MICROPHONE]` hard‑limits each staffer to mic‑only (blocks camera/screenshare even if a client tries). If neither `canPublish` nor `canSubscribe` is set, **both are enabled** by default. *(High. VideoGrant reference.)*

```ts
// supabase/functions/livekit-token/index.ts   (Deno)
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken, TrackSource } from "npm:livekit-server-sdk@2.15.4";

const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!;
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Trusted identity — network call to the Auth server.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response("Unauthorized", { status: 401 });

  // OPTIONAL: confirm caller is staff (has a role) before issuing a token.
  const { peerId } = await req.json();                 // who they want to talk to
  if (typeof peerId !== "string") return new Response("Bad request", { status: 400 });

  // Deterministic, both sides compute the same room without coordination.
  const room = `ptt-${[user.id, peerId].sort().join("_")}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: user.id,        // derived server‑side, NOT from the body
    name: user.email ?? user.id,
    ttl: "10m",
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublishSources: [TrackSource.MICROPHONE],       // mic‑only
    canSubscribe: true,
    canPublishData: true,                              // for PTT key‑state data msgs
  });

  const token = await at.toJwt();                      // v2: async!
  return new Response(JSON.stringify({ token, room, url: Deno.env.get("LIVEKIT_URL") }),
    { headers: { "Content-Type": "application/json" } });
});
```

> **Note on 1:1 scoping:** because the JWT's `room` grant binds the token to exactly one room and you compute that room from the *authenticated* user + peer, the room name doesn't need to be secret — the server‑side derivation is what enforces the 1:1 boundary. There is **no official LiveKit convention** for pair‑room naming; the sorted‑IDs pattern is a sound community idiom (your design decision).

---

## 4. Push‑to‑talk on the LiveKit web SDK

**The right mechanism: publish the mic once (muted), then mute/unmute — never publish/unpublish per keypress.**

- `localParticipant.setMicrophoneEnabled(true/false)` on an already‑published track **mutes/unmutes with no SDP renegotiation** (verified in SDK source: enable→`track.unmute()`, disable→`track.mute()`). Publish/unpublish per press tears down the sender and forces renegotiation (and possibly a fresh `getUserMedia`) → latency + audible Bluetooth profile switches. *(High.)*
- Keep **`TrackPublishDefaults.stopMicTrackOnMute = false`** (the default). If `true`, mute *stops* the device, so unmute must re‑acquire it (slow; BT HFP↔A2DP pops). *(High.)*
- **Lowest latency:** `room.prepareConnection(url, token)` on load to overlap DNS/signaling/ICE; pre‑publish the mic muted so the first press is just an unmute; publish audio‑only; keep Opus **DTX + RED** (both default‑on for mono — DTX saves silence bandwidth, RED adds packet‑loss resilience). For voice, set `publishDefaults.audioPreset = AudioPresets.speech` (24 kbps) or `telephone` (12 kbps) instead of the 48 kbps `music` default. *(High.)*
- **`getUserMedia` does NOT strictly need a user gesture** (unlike `getDisplayMedia`); it's *permission*‑gated and prompts on first use. Common "must be in a gesture" advice is over‑constraint. Still call it from the press handler so the prompt is user‑attributable. Handle failures via `RoomEvent.MediaDevicesError` → `MediaDeviceFailure.getFailure(e)` → `PermissionDenied | NotFound | DeviceInUse` (and `localParticipant.lastMicrophoneError`). *(High.)*

**Remote‑audio autoplay (the "I can't hear them" fix):** browsers block autoplay until interaction. LiveKit auto‑attempts playback and, on failure, emits `RoomEvent.AudioPlaybackStatusChanged`; check **`room.canPlaybackAudio`** and call **`room.startAudio()` inside a click/tap handler** once. After that, later tracks play freely. On iOS, `startAudio()` also resumes the AudioContext and injects a silent track to satisfy Safari. *(High — this is the documented pattern.)*

```ts
// PTT press / release
async function onPressStart(peerId: string) {
  const { token, room: roomName, url } = await fetchToken(peerId);   // edge fn
  await room.connect(url, token);                 // no‑op if already connected
  // restrict who can hear me → server‑enforced 1:1
  await room.localParticipant.setTrackSubscriptionPermissions(false, [
    { participantIdentity: peerId, allowAll: true },
  ]);
  await room.localParticipant.setMicrophoneEnabled(true);            // unmute (publishes once)
  intercomChannel.send({ type: "broadcast", event: "ptt-invite",
    payload: { from: myId, to: peerId, room: roomName } });
}
async function onPressEnd() {
  await room.localParticipant.setMicrophoneEnabled(false);           // mute
}

// One‑time audio unlock (wire to the first user interaction / first press)
room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
  if (!room.canPlaybackAudio) showEnableAudioButton(() => room.startAudio());
});
```

```ts
// Callee: already listening on Plane 1; auto‑join on invite
intercomChannel.on("broadcast", { event: "ptt-invite" }, async ({ payload }) => {
  if (payload.to !== myId) return;
  const { token, url } = await fetchToken(payload.from);
  await room.connect(url, token);
  await room.startAudio().catch(() => {/* prompt if not yet unlocked */});
  // subscribe to caller's mic (autoSubscribe:false by default in our RoomOptions)
});
```

---

## 5. Presence — one source of truth, no heartbeat

**Delete the `staff_presence` heartbeat entirely.** Use **Supabase Realtime Presence** on the always‑on `intercom` channel:

- `channel.track({ user_id, name })` to announce yourself; read `channel.presenceState()`; listen to `sync` / `join` / `leave`. State is **in‑memory in the Realtime servers, synced over the WebSocket — no DB table, no freshness window.** *(High.)*
- Why the old design failed: **background/inactive tabs clamp `setInterval` to ≥1 s, and Chrome ≥88 "heavy‑throttles" hidden‑tab timers to ~1/min after 5 min** → your 20 s heartbeat stops, the row goes stale within the 60 s window, and the user shows offline though present. Crucially, **tabs with an active WebSocket/WebRTC connection are largely exempt from throttling**, so a Realtime‑Presence (or LiveKit) connection stays accurate exactly where the timer heartbeat dies. *(High.)*
- **Don't run two presence systems for the same fact.** "Online/available" = Supabase Realtime Presence, period. LiveKit room membership means only "in a call right now" (a different fact). No disagreement. *(Avoids the dual‑source bug you have today.)*
- Caveat: on a `sync`, Supabase may emit simultaneous `join`/`leave` as reconciliation — don't treat those as literal connect/disconnect; render from `presenceState()`. Don't `track()` at high frequency (that's what Broadcast is for). *(High.)*

> If you instead choose the **always‑on LiveKit "office" room** variant (§9), then LiveKit becomes the single presence source via `RoomEvent.ParticipantConnected/Disconnected` + `room.remoteParticipants` (seed from the map at join; the connected event doesn't fire for participants already present). Either way: **one** authority.

---

## 6. Reliability & TURN (mostly free with LiveKit Cloud)

- **Auto‑reconnect** (resume → full) is built in; surface `Reconnecting/Reconnected/Disconnected`. Use `ConnectionQualityChanged === 'LOST'` as an *early* "peer dropped" hint for UI, but rely on `Disconnected` + `remoteParticipants` for ground truth (quality events have known intermittent misfires). *(High/Med.)*
- **TURN:** Cloud provides TURN/TLS on **443** automatically (allowlist `*.turn.livekit.cloud` for enterprise firewalls). Transport fallback order: ICE/UDP → ICE/TCP → TURN/UDP → TURN/TLS:443. Self‑host would require enabling the embedded TURN with a CA‑signed cert. *(High.)*

---

## 7. PWA / browser reality check (set expectations honestly)

- **Web PTT cannot run in the background or with the screen locked** like a native walkie‑talkie. On iOS, audio capture/playback is **suspended when a standalone web app loses foreground**, and `AudioContext` is suspended when backgrounded (WebKit bugs 198277, 237878). There is **no web equivalent of CallKit/PushKit / Android foreground‑service** for sustained background mic. **Design for it:** pause/disconnect on `visibilitychange→hidden`, reacquire on `→visible`. *(High for iOS; Med‑High for Android battery policies.)*
- **iOS audio unlock:** remote audio needs a user gesture once; add **`playsinline`** to media elements; `AudioContext.resume()` inside a tap. LiveKit's `startAudio()` encapsulates this — call it once from a gesture. *(High.)*
- **getUserMedia in standalone PWAs** was broken pre‑iOS 14.5 and **fixed in iOS 14.5 / Safari 14.1 (Apr 2021)** — assume any modern iOS is fine. iOS also **doesn't persist mic grants** like desktop Chrome (expect occasional re‑prompts; keep the gesture→getUserMedia on a stable same‑origin route). *(High/Med.)*
- **Graceful degradation:** guard `if (navigator.mediaDevices?.getUserMedia)` (undefined on non‑HTTPS), branch UX on `NotAllowedError` (deep‑link to Settings — no in‑page re‑grant on iOS) vs `NotFoundError` vs `NotReadableError`. *(High.)*

---

## 8. Migration plan mapped to **this** codebase

**Add**
- `supabase/functions/livekit-token/index.ts` (§3). Secrets: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.
- `src/hooks/useIntercom.ts` — owns the Supabase `intercom` channel (presence + `ptt-invite` broadcast) **and** a single LiveKit `Room`. Exposes `onlineUserIds`, `pressToTalk(peerId)`, `release()`, `audioBlocked`/`enableAudio()`.
- `npm i livekit-client` (client) and `livekit-server-sdk` (edge function via `npm:`).

**Replace / delete**
- `src/hooks/useVoiceChannel.ts` → **delete the entire mesh**: `RTCPeerConnection` map, offer/answer/ICE handlers, ICE queue, reconnect/grace/health‑check timers, the `"voice-channel"` broadcast signaling. LiveKit replaces all of it. *(This is ~700 lines gone.)*
- `src/contexts/StaffPresenceContext.tsx` → **delete the `staff_presence` heartbeat** (20 s upsert, 60 s freshness filter, beforeunload PATCH). Re‑expose the same `isUserOnline(id)` API backed by Supabase Realtime Presence so callers don't change.
- `src/components/intercom/VoiceChannelProvider.tsx` → becomes a thin wrapper over `useIntercom` (drop the auto‑join‑with‑3‑attempts logic, the fallback context, the mic‑permission polling).

**Keep (UI is fine — it was never the problem)**
- `SidebarStaffPanel.tsx`, `PushToTalkStaffCard.tsx`, `VoiceChannelStaffPanel.tsx` — keep the staff list, the press‑and‑hold card, the speaking indicators. Only swap the data source: `isOnline` ← Realtime Presence; `isSpeakingToMe` ← LiveKit `isSpeaking`/`ActiveSpeakersChanged`; `onPressStart/onPressEnd` → `pressToTalk/release`.
- The `staff`/roles loading in `useStaffManagement.ts` is unaffected (also: backfill the null `full_name` so "Unknown" rows get real names, and give `Mukhsin` a profile).

**Phasing**
1. **Phase 0:** create LiveKit Cloud project; deploy `livekit-token`; verify a hard‑coded 2‑tab call works.
2. **Phase 1:** ship presence swap (Supabase Realtime Presence) behind a flag — immediately fixes the "everyone offline" screenshot, independent of media.
3. **Phase 2:** wire `pressToTalk`/`release` + invite broadcast + `startAudio`; run old mesh and new LiveKit paths behind a feature flag; dogfood with 2–3 staff.
4. **Phase 3:** delete the mesh + heartbeat; remove `intercom_calls`/`staff_presence` tables if unused elsewhere.

---

## 9. Alternative: single always‑on "office" room (simpler, costs minutes)

Every staffer joins **one** persistent audio‑only LiveKit room on login (muted). Then:
- **Presence is free from LiveKit** (`remoteParticipants` + connect/disconnect events) — no Supabase plane at all.
- **No join race / instant PTT** (everyone pre‑connected, mic pre‑published muted → press = unmute).
- **1:1 privacy** via `RoomOptions.autoSubscribe=false` + caller `setTrackSubscriptionPermissions(false,[{identity:peer,allowAll:true}])`; callee `setSubscribed(true)` on the caller's track when targeted (signaled by a LiveKit **data message**).
- **Cost:** connection‑minutes accrue while connected → ~$50–100/mo for 7 full‑time staff (disconnect on tab‑hidden to trim). Scales less gracefully to 50.

Choose this if you value zero call‑setup latency and minimal moving parts over staying in the free tier. Otherwise use the two‑plane design (§2).

---

## 10. Pitfalls & anti‑patterns checklist

- ❌ **Heartbeat‑table presence with a freshness window** → stale via timer throttling. ✅ WebSocket presence (Supabase Realtime or LiveKit).
- ❌ **Two presence systems for the same fact** (your current table *and* channel presence). ✅ Exactly one authority.
- ❌ **Publish/unpublish per PTT keypress** → renegotiation latency, BT pops. ✅ Publish once, mute/unmute; `stopMicTrackOnMute=false`.
- ❌ **Forgetting `room.startAudio()`** → silent inbound audio. ✅ Unlock once via a gesture; show an "enable audio" affordance.
- ❌ **STUN‑only** → strict‑NAT/corporate users never connect. ✅ LiveKit TURN/TLS:443.
- ❌ **API secret in the client.** ✅ Mint tokens only in the Edge Function; short TTL; identity/room derived server‑side from `auth.getUser()`.
- ❌ **`toJwt()` used synchronously** (v1 habit) → empty token. ✅ `await at.toJwt()` (v2).
- ❌ **Expecting background/locked‑screen PTT on the web.** ✅ Pause on hidden, reacquire on visible; document the limitation.
- ❌ **Trusting `peerId`/`identity` from the request body.** ✅ Authenticated user is identity; validate membership before minting.

---

## 11. Testing strategy

- **Automated mic injection (CI/headless Chrome):** `--use-fake-device-for-media-stream` (synthetic audio/video), `--use-fake-ui-for-media-stream` (auto‑accept permission), `--use-file-for-fake-audio-capture=clip.wav` (16‑bit WAV). Firefox: `media.navigator.streams.fake=true`. *(High — flags verified.)*
- **Manual multi‑party on one machine:** separate **browser profiles** (independent permissions/identity) across tabs; use fake devices to avoid feedback.
- **Load / simulated participants:** `lk load-test --room test --audio-publishers 5 --duration 1m` (livekit‑cli); raise `ulimit -n`. Good proxy for concurrent PTT speakers. *(High — param names verified.)*
- **Real‑world matrix:** test behind a corporate/symmetric‑NAT network (forces TURN), on iOS Safari + standalone PWA (autoplay unlock, backgrounding), and a flaky‑network reconnect (toggle airplane mode mid‑call).

---

## Confidence & sourcing notes
- **High & code‑verified:** SDK API names/behavior (mute‑vs‑publish, `startAudio`/`canPlaybackAudio`, `setMicrophoneEnabled`, presence/reconnect events), token minting (`AccessToken`/`addGrant`/async `toJwt`, default 6h TTL, Deno support), VideoGrant fields, Supabase Realtime Presence semantics, browser timer‑throttling and iOS audio/background limits, Chrome test flags, `lk load-test` params.
- **Medium / verify before billing:** exact LiveKit free‑tier minute count (**5,000 vs 10,000 — sources conflict**), per‑minute overage ($0.0005 vs $0.006 PAYG), 50 GB egress (single‑sourced), free‑tier per‑room cap (50 vs 3000). Pricing model changed **2024‑08‑06**; LiveKit blocks automated fetch so these came from third‑party aggregators — **confirm on the dashboard.**
- **Application‑level (no official spec):** deterministic pair‑room naming; incremental feature‑flagged migration.

### Key sources
- LiveKit token minting & grants: https://docs.livekit.io/home/server/generating-tokens/ · https://docs.livekit.io/reference/server-sdk-js/interfaces/VideoGrant.html · SDK source https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk
- LiveKit web SDK (PTT, autoplay, devices): https://github.com/livekit/client-sdk-js#readme · `LocalParticipant.ts`, `Room.ts`, `track/options.ts` in that repo
- Presence / reconnect / quality events: https://github.com/livekit/client-sdk-js/blob/main/src/room/events.ts · https://docs.livekit.io/reference/client-sdk-js/classes/Room.html
- TURN / firewall: https://docs.livekit.io/home/cloud/firewall/ · https://kb.livekit.io/articles/1724892785-establishing-media-connection-firewall-troubleshooting
- Self‑host / TURN config: https://docs.livekit.io/transport/self-hosting/deployment/ · https://github.com/livekit/livekit/blob/master/config-sample.yaml
- Pricing & SFU rationale: https://blog.livekit.io/towards-a-future-aligned-pricing-model/ · https://docs.livekit.io/reference/internals/livekit-sfu · https://checkthat.ai/brands/livekit/pricing · https://www.forasoft.com/blog/article/livekit-vs-agora-cost-analysis
- Supabase Edge Function auth & Deno deps: https://supabase.com/docs/guides/functions/auth · https://supabase.com/docs/guides/functions/auth-headers · https://supabase.com/docs/guides/functions/dependencies
- Supabase Realtime Presence: https://supabase.com/docs/guides/realtime/presence
- Browser/iOS constraints: https://developer.chrome.com/blog/timer-throttling-in-chrome-88 · https://developer.chrome.com/blog/autoplay · https://webkit.org/blog/6784/new-video-policies-for-ios/ · WebKit bugs 185448 / 198277 / 237878 · https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Testing: https://webrtc.github.io/webrtc-org/testing/ · https://docs.livekit.io/transport/self-hosting/benchmark/ · https://pkg.go.dev/github.com/livekit/livekit-cli/pkg/loadtester
