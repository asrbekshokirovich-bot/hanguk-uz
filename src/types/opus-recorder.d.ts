/**
 * Minimal typings for `opus-recorder`, which ships none.
 *
 * Only the surface the voice composer uses is declared. Anything else stays
 * unavailable on purpose: an over-broad `any` module would hide a typo in the
 * config object, which is exactly where this library is easy to get wrong.
 */
declare module 'opus-recorder' {
  interface RecorderConfig {
    /** URL of the encoder worker. Vite gives us one with a `?url` import. */
    encoderPath?: string;
    /** Opus encodes at 48kHz; anything else is resampled. */
    encoderSampleRate?: number;
    numberOfChannels?: number;
    /** 2048 = VOIP, the profile tuned for speech rather than music. */
    encoderApplication?: number;
    /** Target bitrate in bits per second. */
    encoderBitRate?: number;
    /** True emits a page per frame; false emits the whole file on stop. */
    streamPages?: boolean;
    /** Browser constraints passed to getUserMedia. */
    mediaTrackConstraints?: MediaTrackConstraints | boolean;
    monitorGain?: number;
    recordingGain?: number;
  }

  export default class Recorder {
    constructor(config?: RecorderConfig);
    /** Samples encoded so far. Opus is always 48kHz, so divide for seconds. */
    readonly encoderSamplePosition: number;
    /** Must be called from a user gesture or the mic stream comes back empty. */
    start(): Promise<void>;
    stop(): Promise<void>;
    close(): void;
    ondataavailable: ((data: Uint8Array) => void) | null;
    onstart: (() => void) | null;
    onstop: (() => void) | null;
    static isRecordingSupported(): boolean;
  }
}
