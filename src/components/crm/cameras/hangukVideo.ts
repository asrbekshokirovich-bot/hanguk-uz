// go2rtc pleyeri (src/vendor/go2rtc/video-rtc.js) Hanguk uchun:
// faqat MSE / HLS (eski iPhone) / MJPEG — WebRTC yo'q (ofisdan UDP ochilmaydi), faqat video, tugmalarsiz.
import { VideoRTC } from '@/vendor/go2rtc/video-rtc.js';

export const PLAYER_TAG = 'hanguk-video';
export type PlayerState = 'connecting' | 'playing' | 'reconnecting' | 'offline';

export class HangukVideo extends VideoRTC {
  private state: PlayerState = 'connecting';

  constructor() {
    super();
    this.mode = 'mse,hls,mjpeg';
    this.media = 'video';
  }

  oninit(): void {
    super.oninit();
    const v = this.video;
    if (!v) return;
    v.controls = false;
    v.muted = true;
    v.autoplay = true;
    v.style.objectFit = 'contain';
    v.style.background = '#000';
    v.addEventListener('playing', () => this.emit('playing'));
    v.addEventListener('waiting', () => this.emit('connecting'));
  }

  onopen(): string[] {
    const modes = super.onopen();
    // Kameraga ulana olmasa go2rtc {"type":"error","value":"mse: …"} yuboradi, pleyer MJPEG'ni sinaydi.
    // MJPEG ham xato bersa — kamera javob bermayapti: «oflayn», 15 s dan keyin qayta urinadi (onclose).
    this.onmessage['hanguk'] = (msg) => {
      if (msg.type === 'error' && typeof msg.value === 'string' && msg.value.startsWith('mjpeg')) {
        this.emit('offline');
        this.ws?.close();
      }
    };
    return modes;
  }

  onclose(): boolean {
    const reconnecting = super.onclose();
    if (reconnecting && this.state !== 'offline') this.emit('reconnecting');
    return reconnecting;
  }

  ondisconnect(): void {
    super.ondisconnect();
    // super `video.src = ''` qiladi — Chromium buni «Empty src attribute» xatosi deb konsolga yozadi.
    // Atribut olib tashlanib load() chaqirilsa, navbatdagi o'sha xato bekor bo'ladi.
    this.video?.removeAttribute('src');
    this.video?.load();
  }

  /** Darhol to'xtatish (oyna yopilganda): pleyerning 5 soniyalik kutishisiz ulanishni yopadi. */
  stop(): void {
    if (this.disconnectTID) {
      clearTimeout(this.disconnectTID);
      this.disconnectTID = 0;
    }
    if (this.reconnectTID) {
      clearTimeout(this.reconnectTID);
      this.reconnectTID = 0;
    }
    if (this.video) this.ondisconnect();
  }

  private emit(state: PlayerState): void {
    this.state = state;
    this.dispatchEvent(new CustomEvent<PlayerState>('player-state', { detail: state }));
  }
}

export function definePlayer(): void {
  if (typeof customElements !== 'undefined' && !customElements.get(PLAYER_TAG)) {
    customElements.define(PLAYER_TAG, HangukVideo);
  }
}
