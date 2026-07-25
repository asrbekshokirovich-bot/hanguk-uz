# Office camera bridge

Connects the office Xiaomi camera to the Hanguk CRM: live view, 24/7 local
recording, and an event pipeline that AI analysis can plug into later.

## Why a bridge is needed at all

The Xiaomi Smart Camera C300 and C301 support **neither RTSP nor ONVIF** —
that is Xiaomi's own answer, not a limitation we ran into:

> "The Xiaomi Smart Camera C300 does not support ONVIF and RSTP protocol.
> Please wait the subsequent device upgrades."
> — [Xiaomi support, KA-515565](https://www.mi.com/global/support/faq/details/KA-515565/)

So there is no stream URL for a normal NVR to open. What does work is
[go2rtc](https://github.com/AlexxIT/go2rtc), which reimplements Xiaomi's
proprietary P2P protocol. Both models are on its supported list
([issue #1982](https://github.com/AlexxIT/go2rtc/issues/1982)):

| Model | Mi Home model id | Protocol | Status |
|---|---|---|---|
| Smart Camera C300 | `xiaomi.camera.c01a01` | cs2 | Supported |
| Smart Camera C301 | `mxiang.camera.c301` | cs2 | Supported |

go2rtc logs into Mi Home, fetches per-session encryption keys from Xiaomi's
cloud, then streams **locally** from the camera and re-serves it as ordinary
RTSP and WebRTC. Everything downstream is then a normal video problem.

Two consequences worth understanding before you rely on this:

- It is a reverse-engineered protocol. A Xiaomi firmware update can break it
  with no warning and no vendor obligation to fix it. If the office camera
  becomes business-critical, budget for an ONVIF camera (Reolink, Tapo,
  Hikvision, Dahua) as the eventual replacement — those need no bridge at all.
- The bridge needs Mi Home credentials, and internet access at connect time
  to fetch keys. The video path itself is local.

## Where it runs

**Inside the office LAN, on an always-on machine.** Not Railway, not Vercel,
not Supabase — the P2P video path is local-only, so the machine pulling the
stream has to be on the same network as the camera.

Any of these work; the stack is plain Docker Compose:

| Host | Notes |
|---|---|
| Mini-PC (Intel N100/i5, 16 GB) | ~$250–400 used. Recommended. iGPU handles detection later without a separate accelerator. |
| Existing office desktop | Free, but sleep/reboots/Windows updates interrupt recording. Use Linux; go2rtc's Xiaomi support has open bugs on Windows. |
| Raspberry Pi 5 | ~$120. Fine for recording one camera; add a Coral TPU (~$60) before enabling detection. |

Disk is the real sizing constraint: roughly **1 TB per camera-month** of
continuous 2K footage. Adjust `record.retain.days` in `frigate/config.yml` to
whatever the disk actually holds.

## Setup

Copy this folder to the office computer and run:

```bash
cd camera-bridge
bash install.sh
```

It checks (and offers to install) Docker, creates the config files, asks for
the Supabase service role key once and stores it with `chmod 600`, warns if
the disk is too small for the retention window, and starts the stack. Safe to
re-run — it never overwrites config you have already filled in.

Doing it by hand instead:

```bash
cp .env.example .env                       # fill in SUPABASE_SERVICE_ROLE_KEY
cp go2rtc/go2rtc.yaml.example go2rtc/go2rtc.yaml
cp frigate/config.yml.example frigate/config.yml
docker compose up -d
```

Either way, two steps remain and both need a browser:

**1. Pair the camera with go2rtc.** Open `http://<bridge-ip>:1984` →
**Add** → **Xiaomi** → log in with the Mi account that owns the camera
(email/SMS code and captcha are prompted as needed) → pick the camera. This
writes the stream entry into `go2rtc/go2rtc.yaml` for you. Do not hand-write
that entry — it carries per-device encryption material.

Name the stream `office`, or change it consistently in `frigate/config.yml`
and in the camera's `stream_key` in the CRM.

> Use a **dedicated Mi account** with the camera shared to it. These
> credentials sit on the bridge in plain text and unlock every device on
> whichever account you use.

**2. Confirm the restream works.** `http://<bridge-ip>:1984/stream.html?src=office`
should show live video. If it does not, see Troubleshooting below.

**3. Register the camera in the CRM.** Insert a row into `public.cameras`
with `stream_key` matching the go2rtc stream name:

```sql
insert into public.cameras (name, location, model, stream_key, ptz_supported)
values ('Ofis - qabulxona', 'Reception', 'mxiang.camera.c301', 'office', true);
```

**4. Point the CRM at the bridge.** Set `VITE_CAMERA_BRIDGE_URL` in the
frontend environment to the bridge's reachable address. On the office LAN
that is `http://<bridge-ip>:1984`. For access from outside the office, put a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
in front of it — no port forwarding, and put Cloudflare Access in front so
the stream is not open to the internet.

## What is on and what is off

| | State |
|---|---|
| Live view | On |
| 24/7 recording to local disk | On, 30-day retention |
| Recordings uploaded to cloud | **Off** — video never leaves the office |
| Object/motion detection | **Off** — no AI scope chosen yet |
| Event timeline in CRM | Wired, stays empty until detection is on |
| PTZ control from CRM | Not yet — see below |

Turning on detection is a documented block in `frigate/config.yml`. Once it
is on, events flow into `public.camera_events` and the CRM timeline fills in.

## PTZ ("full control")

Pan/tilt is a **separate channel from video**. go2rtc gives you the picture,
not the motor. The C300/C301 motor is driven over Xiaomi's MIoT protocol,
via [python-miio](https://github.com/rytilahti/python-miio) or the
[hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot) integration
(which has confirmed C301 entries). It needs the device token extracted from
the Mi account, and the MIoT siid/piid pair for the pan-tilt service on this
model — neither of which is verified here yet, which is why no PTZ button is
shipped rather than a button that silently does nothing.

## Testing without a camera

```bash
cd agent && npm install && npm test
```

Stands up a fake Frigate and a fake Supabase, runs the real agent against
them, and checks the row it writes — field mapping, epoch→ISO conversion,
clip paths, camera lookup by `stream_key`, upsert idempotency, and that the
payload carries references rather than image bytes. No camera, no Docker, and
it never touches the real Supabase project.

## Troubleshooting

**Stream will not start / `i/o timeout`.** go2rtc 1.9.14 has open bugs
against Xiaomi cs2 cameras ([#2048](https://github.com/AlexxIT/go2rtc/issues/2048),
[#2294](https://github.com/AlexxIT/go2rtc/issues/2294)). The compose file
pins **1.9.13** for this reason. Re-test before bumping.

**Works, then dies after a while.** Usually the key fetch failing — go2rtc
needs internet at connect time even though the video is local.

**Nothing in the CRM timeline.** Expected while detection is off. Check
`docker compose logs agent`; "no active cameras registered" means the
`cameras` row is missing or its `stream_key` does not match the go2rtc
stream name.

**Docker networking.** All three services use host networking on purpose:
the P2P handshake uses arbitrary UDP ports that do not survive bridge NAT.

## Before you point this at people

The footage is of staff and students. The `cameras` and `camera_events`
tables are owner/admin-only under RLS, recordings stay on the office disk,
and retention is capped at 30 days — those defaults are the easy part.
What still needs a human decision: a posted notice that the office is
recorded, and written consent from staff before enabling anything
face-related, which is biometric data rather than ordinary video.
