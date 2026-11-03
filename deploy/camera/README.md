# Ofis kameralari → CRM (lokal variant)

EZVIZ kameralaridan video EZVIZ bulutisiz olinadi:

```
Kamera (RTSP, faqat LAN) → ofis serveri: go2rtc (127.0.0.1) → camera-gate → WireGuard
  → VPS (Toshkent): Caddy HTTPS cam.hanguk.uz → CRM /crm/cameras (brauzer)
```

Brauzer 5 daqiqalik kalitni Supabase'dagi `camera-session`dan oladi, `camera-gate` uni tekshiradi.
Reja: https://claude.ai/artifact/TLm2fzPrXWqYtfigGcKDxg · dasturchi uchun: `docs/kameralar.md`.

| Papka | Nima |
|---|---|
| `gate/` | camera-gate (Deno, tashqi kutubxonasiz) va testlar |
| `office/` | ofis serveri: `install.sh`, `docker-compose.yml`, `go2rtc.yaml`, namunalar |
| `vps/` | VPS: `setup.sh` (Caddy + WireGuard) |
| `test/` | haqiqiy go2rtc bilan e2e sinov |

## O'rnatish tartibi

### 0. Kameralar (ofisda)
1. EZVIZ ilovasi → Profil → Settings → LAN Live View → Start Scanning → kamera → ⚙ → Local Server Settings → **RTSP** yoqish.
2. Routerda har kameraga doimiy IP (DHCP reservation).
3. VLC → Media → Open Network Stream:
   `rtsp://admin:KOD@IP:554/Streaming/Channels/101` (katta) va `.../102` (kichik).
   KOD — kamera yorlig'idagi 6 ta katta harf. Ochilmasa: `/h264_stream`, `/h264/ch1/main/av_stream`.
4. VLC → Tools → Codec Information: kodek **H.264** bo'lsa yaxshi (Firefox H.265 ko'rsatmaydi).

Kodlarni chatga yozmang — ular faqat serverdagi `secrets/cameras.env` ga kiritiladi.

### 1. VPS (Ubuntu 24.04)
```bash
sudo bash setup.sh --domain cam.hanguk.uz      # VPS kalitini chiqaradi
```
Billur DNS: `cam.hanguk.uz` → **A** → VPS IP. SSH boshqa portda bo'lsa `--ssh-port <port>` qo'shing.

### 2. Ofis serveri (Ubuntu Server 24.04, routerga kabel bilan)
`deploy/camera` papkasini serverga ko'chiring, keyin:
```bash
sudo bash office/install.sh --vps-endpoint <VPS_IP>:51820 --vps-pubkey <1-qadamdagi kalit>
sudo nano /opt/hanguk-camera/cameras.yaml          # nomlar va IP
sudo nano /opt/hanguk-camera/secrets/cameras.env   # kodlar
sudo nano /opt/hanguk-camera/secrets/gate.env      # CAMERAS=kirish,zal,...
cd /opt/hanguk-camera && sudo docker compose up -d --force-recreate
```
BIOS: elektr qaytsa kompyuter o'zi yonsin (Restore on AC power loss → On).

### 3. VPS'ga ofisni ulash
```bash
sudo bash setup.sh --domain cam.hanguk.uz --office-pubkey <install.sh chiqargan kalit>
sudo wg show hanguk-cam                           # "latest handshake" bo'lishi kerak
```

### 4. Supabase secrets
`sudo cat /opt/hanguk-camera/secrets/gate.env` dagi qiymatlar:

| Supabase secret | Qiymat |
|---|---|
| `CAMERA_GATE_SECRET` | `GATE_SECRET` |
| `CAMERA_HEALTH_KEY` | `HEALTH_KEY` |
| `CAMERA_GATE_URL` | `https://cam.hanguk.uz` |

### 5. Tekshirish
```bash
curl -s -H "x-health-key: <HEALTH_KEY>" https://cam.hanguk.uz/health
# {"ok":true,"go2rtc":true,"cameras":{"kirish":{"online":true,...}}}
```

## VPS'siz variant (ofisda oq IP bo'lsa)
`sudo bash office/install.sh --no-wireguard` — gate `127.0.0.1:8080` da tinglaydi. Ofis serveriga Caddy
o'rnatiladi (`apt install caddy`), `/etc/caddy/Caddyfile`:
```
cam.hanguk.uz {
	reverse_proxy 127.0.0.1:8080
}
```
Routerda 80 va 443 → ofis serveri; DNS `cam.hanguk.uz` → ofis IP.

## Kamera qo'shish
1. `cameras.yaml` ga `<nom>` va `<nom>_sub`, `secrets/cameras.env` ga `<NOM>_KOD`.
2. `secrets/gate.env` dagi `CAMERAS` ga nom.
3. `cd /opt/hanguk-camera && sudo docker compose up -d --force-recreate`
4. CRM → Sozlamalar → Kameralar: xuddi shu nom.

## Xavfsizlik
- go2rtc faqat `127.0.0.1:1984` da; faqat kerakli modullar va API yo'llari (`go2rtc.yaml`).
- camera-gate: faqat 4 yo'l (`/api/ws`, `/api/frame.jpeg`, `/api/hls/*`, `/health`), qolgani 404;
  kalit imzosi, muddati va kamera ruxsati; jonli video faqat hanguk.uz sahifasidan; webrtc xabarlari o'tmaydi.
- Ofis routerida port ochilmaydi: tunnelni ofis serveri o'zi ochadi.
- VPS'da kamera kodi ham, `GATE_SECRET` ham yo'q.

## Muammolar
| Belgi | Sabab va yechim |
|---|---|
| `/health` da `"online": false, "error": "no_image"` | go2rtc kameraga ulana olmadi: IP, kod, RTSP yoqilganmi, yo'l (101/102). |
| `"go2rtc": false` | `sudo docker compose logs go2rtc` |
| CRM'da 401 | Supabase `CAMERA_GATE_SECRET` ≠ `GATE_SECRET`, yoki server soati noto'g'ri (`timedatectl`). |
| Firefox'da video yo'q, Chrome'da bor | Kamera H.265 da — kamerada H.264 tanlang. |
| `cam.hanguk.uz` 502 | Tunnel uzilgan: `sudo wg show hanguk-cam` (ikkala tomonda). |

## Sinov (dasturchi)
```bash
cd deploy/camera/gate && deno task test             # birlik testlari
GO2RTC_BIN=/yo'l/go2rtc bash deploy/camera/test/e2e.sh   # haqiqiy go2rtc + ffmpeg soxta kamera
```
