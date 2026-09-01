// One RealtimeBridge instance per phone call. It owns the WebSocket to the
// Azure OpenAI Realtime API and pumps audio between it and ACS.
//
// Audio contract: both ACS (Pcm24KMono) and the Realtime API use 24 kHz,
// 16-bit, mono PCM, little-endian, base64-encoded. So audio passes through
// frame-for-frame with no resampling. If you change the ACS audioFormat, you
// must resample here.
//
// Turn-taking is delegated to the Realtime API's server-side VAD. When the
// caller starts talking over the agent (barge-in), we tell ACS to stop playing
// the current response immediately.

import { WebSocket } from 'ws';
import { buildInstructions } from './prompt.mjs';

export class RealtimeBridge {
  /**
   * @param {object} cfg
   * @param {string} cfg.endpoint            - https://<res>.openai.azure.com
   * @param {string} cfg.apiKey
   * @param {string} cfg.deployment          - realtime deployment name
   * @param {string} cfg.apiVersion
   * @param {string} cfg.voice
   * @param {object} cfg.call                 - { direction, goal, context, displayName }
   * @param {(b64Pcm: string) => void} cfg.onAudioToAcs   - play audio to the caller
   * @param {() => void} cfg.onBargeIn                    - caller started talking; stop playback
   */
  constructor(cfg) {
    this.cfg = cfg;
    this.ws = null;
    this.ready = false;
    this.closed = false;
    // Transcript turns: { role: 'assistant'|'user', text, at }
    this.transcript = [];
    this._pendingUser = '';
  }

  connect() {
    const { endpoint, deployment, apiVersion, apiKey } = this.cfg;
    const base = endpoint.replace(/^http/, 'ws').replace(/\/$/, '');
    const url = `${base}/openai/realtime?api-version=${encodeURIComponent(apiVersion)}&deployment=${encodeURIComponent(deployment)}`;

    this.ws = new WebSocket(url, { headers: { 'api-key': apiKey } });

    this.ws.on('open', () => this._configureSession());
    this.ws.on('message', (data) => this._onMessage(data));
    this.ws.on('close', () => { this.closed = true; });
    this.ws.on('error', (e) => console.error('[realtime] ws error:', e?.message || e));
    return this;
  }

  _configureSession() {
    const { call, voice } = this.cfg;
    this._send({
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        instructions: buildInstructions(call),
        voice,
        input_audio_format: 'pcm16',   // 24 kHz mono, matches ACS Pcm24KMono
        output_audio_format: 'pcm16',
        // Transcribe the caller's speech so we can log both sides.
        input_audio_transcription: { model: 'whisper-1' },
        // Let the model detect end-of-turn and barge-in.
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    });
    this.ready = true;

    // For an outbound call the agent should speak first. For inbound, greet on
    // connect too — the caller has already "spoken" by dialing us.
    this._send({ type: 'response.create' });
  }

  /** Feed a base64 PCM16/24k frame from ACS into the model. */
  pushCallerAudio(b64Pcm) {
    if (!this.ready || this.closed) return;
    this._send({ type: 'input_audio_buffer.append', audio: b64Pcm });
  }

  _onMessage(data) {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case 'response.audio.delta':
        // Model speech → play to the caller.
        if (msg.delta) this.cfg.onAudioToAcs(msg.delta);
        break;

      case 'input_audio_buffer.speech_started':
        // Caller barged in — stop whatever the agent is saying.
        this.cfg.onBargeIn();
        break;

      case 'response.audio_transcript.done':
        if (msg.transcript) this._pushTurn('assistant', msg.transcript);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (msg.transcript) this._pushTurn('user', msg.transcript);
        break;

      case 'error':
        console.error('[realtime] error event:', JSON.stringify(msg.error || msg));
        break;

      default:
        // response.created / response.done / rate_limits.updated / etc. — ignore.
        break;
    }
  }

  _pushTurn(role, text) {
    const t = String(text).trim();
    if (!t) return;
    this.transcript.push({ role, text: t, at: Date.now() });
  }

  /** Plain-text transcript for logging / summary. */
  getTranscriptText() {
    return this.transcript
      .map((t) => `${t.role === 'assistant' ? 'AI' : 'Caller'}: ${t.text}`)
      .join('\n');
  }

  getSegments() {
    return this.transcript.map((t) => ({ speaker: t.role, text: t.text, at: t.at }));
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  close() {
    this.closed = true;
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}
