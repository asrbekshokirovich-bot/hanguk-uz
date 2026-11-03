# Kameralar (dasturchi uchun)

Ofisdagi EZVIZ kameralari CRM'ning «Kameralar» sahifasida ko'rinadi. Video EZVIZ bulutidan emas,
ofis serveridagi go2rtc'dan keladi. O'rnatish: `deploy/camera/README.md`.

```
Brauzer ──① camera-session (JWT)──► Supabase: has_camera_access(), jurnal, kalit imzolash
   │◄──② {gate, token, cameras}─────┘
   └──③ wss://cam.hanguk.uz/api/ws?src=kirish&q=hd&t=… ──► VPS Caddy ──WireGuard──► camera-gate ──► go2rtc ──RTSP──► kamera
```

## Qismlar va PR'lar
| PR | Branch | Nima |
|---|---|---|
| A | `feat/camera-gate` | `deploy/camera/` — camera-gate, ofis va VPS sozlamalari, e2e |
| B | `feat/cameras-db` | `cameras`, `camera_access`, `camera_access_log`, `has_camera_access()`; edge `camera-session` |
| C | `feat/crm-cameras` | `/crm/cameras`, menyu, `CameraAccessCard`, Sozlamalar → Kameralar |
| D | `feat/camera-health` | `camera_status`, cron, owner'ga bot xabari |

## Kalit formati (`deploy/camera/gate/token.ts`)
```
v1.<base64url(JSON {u, c, iat, exp})>.<base64url(HMAC-SHA256(CAMERA_GATE_SECRET, "v1." + payload))>
```
- `u` — `auth.users.id`; `c` — kamera nomlari yoki `["*"]`; `iat`, `exp` — unix soniya.
- `camera-session` 300 s beradi; gate 600 s dan uzunini va 30 s farqdan keyin muddati o'tganini rad etadi.
- `camera-session` shu faylning nusxasini ishlatadi (`supabase/functions/_shared/camera-token.ts`, PR-B).

## camera-gate API
| So'rov | Javob |
|---|---|
| `GET /api/frame.jpeg?src=<kamera>&q=sd\|hd&t=<kalit>` | 200 JPEG · 400 nom/sifat · 401 kalit · 403 kamera ruxsati · 404 noma'lum kamera · 504 kamera javob bermadi |
| `GET /api/ws?src=<kamera>&q=hd\|sd&t=<kalit>` (WebSocket) | go2rtc WS API. Origin faqat `GATE_ORIGINS`. Xabar turlari: `mse`, `hls`, `mp4`, `mjpeg` (webrtc o'tmaydi). 429 — ulanishlar chegarasi |
| `GET /api/hls/*?id=…` | faqat shu WS seansida go2rtc bergan id (60 s harakatsiz qolsa yopiladi) |
| `GET /health` + `x-health-key` | `{ok, go2rtc, cameras: {nom: {online, ms, error?}}, sessions}`; kalitsiz 404 |

WS yopilish kodlari: `1008` noto'g'ri xabar · `1011` go2rtc uzildi · `1013` mijoz sekin · `4000` seans vaqti (`SESSION_MAX_SEC`, 900 s) tugadi.
`q`: `hd` → go2rtc oqimi `<kamera>`, `sd` → `<kamera>_sub`.

## CRM'da pleyer (PR-C)
- go2rtc'ning `www/video-rtc.js` (MIT, v1.9.15) nusxasi; `mode = "mse,hls,mjpeg"` (webrtc yo'q).
- `player.src` = `{gate}/api/ws?src={kamera}&q=hd&t={kalit}`; kalit har 4 daqiqada yangilanadi.
  `set src` ochiq ulanishni uzmaydi: yangi manzil faqat qayta ulanishda ishlatiladi.
- Pleyer sahifa yashirilganda oqimni o'zi to'xtatadi (`video-rtc.js`).

## Brauzerlar (go2rtc jadvali)
Chrome/Edge/Android: MSE H.264 va H.265 · Firefox: MSE faqat H.264 · Safari Mac/iPad, iPhone iOS 17.1+: MSE ·
eski iPhone: HLS.

## Sinov
- `cd deploy/camera/gate && deno task test` — kalit, sozlama, yo'llar, WebSocket, HLS, /health (soxta go2rtc).
- `bash deploy/camera/test/e2e.sh` — haqiqiy go2rtc 1.9.15 + ffmpeg soxta kamera, ishlab chiqarishdagi `go2rtc.yaml` bilan.
- CI: `.github/workflows/camera-gate.yml`.
