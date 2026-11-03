// Types for the vendored go2rtc player (video-rtc.js). Only what Hanguk uses.
export declare class VideoRTC extends HTMLElement {
  DISCONNECT_TIMEOUT: number;
  RECONNECT_TIMEOUT: number;
  /** Supported modes, comma separated: webrtc, webrtc/tcp, mse, hls, mp4, mjpeg. */
  mode: string;
  /** Requested medias: video, audio, microphone. */
  media: string;
  /** Keep streaming when the element is not on screen. */
  background: boolean;
  /** Stop when the browser tab is hidden. */
  visibilityCheck: boolean;
  visibilityThreshold: number;
  video: HTMLVideoElement | null;
  ws: WebSocket | null;
  wsURL: string;
  wsState: number;
  /** go2rtc's text messages ({type, value}); every handler sees every message. Reset on each `onopen`. */
  onmessage: Record<string, (msg: { type: string; value?: unknown }) => void>;
  disconnectTID: number;
  reconnectTID: number;
  /** WebSocket URL (http(s) URLs are turned into ws(s)). Setting it never drops an open connection. */
  set src(value: string | URL);
  play(): void;
  oninit(): void;
  onconnect(): boolean;
  ondisconnect(): void;
  onopen(): string[];
  onclose(): boolean;
  connectedCallback(): void;
  disconnectedCallback(): void;
}
