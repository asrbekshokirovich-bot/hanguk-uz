import { useCallback, useEffect, useRef, useState } from 'react';
import Recorder from 'opus-recorder';
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js?url';

/**
 * Records a voice note for the inbox composer, as OGG/Opus.
 *
 * The container is the whole reason this uses `opus-recorder` rather than the
 * browser's own MediaRecorder. Telegram plays a voice note — the bubble with a
 * waveform, playable without downloading — only for OGG/Opus; anything else
 * arrives as a file card the client has to tap and save. Chromium's
 * MediaRecorder cannot produce OGG at all (it gives `audio/webm`), and the
 * userbot has no ffmpeg to convert with, so the browser has to encode it right
 * the first time. `useAudioRecorder` stays as it is: it feeds the interview
 * tooling, where a WebM upload is fine.
 *
 * Duration is measured, not guessed. The player in the thread reads
 * `media_duration`, and a voice note whose bar never matches its audio looks
 * broken even when the audio is perfect.
 */

/** Opus always encodes at 48kHz, whatever the microphone ran at. */
const OPUS_SAMPLE_RATE = 48000;

/** The profile tuned for speech rather than music. */
const OPUS_APPLICATION_VOIP = 2048;

/** Plenty for a spoken reply; keeps a minute under about 190 KB. */
const OPUS_BITRATE = 24000;

export interface VoiceRecording {
  /** Ready to hand to the same send path an attachment takes. */
  file: File;
  durationSeconds: number;
  /** Object URL for local playback. The caller revokes it. */
  url: string;
}

export interface UseVoiceRecorder {
  isRecording: boolean;
  /** Whole seconds elapsed, for the timer next to the stop button. */
  elapsedSeconds: number;
  error: string | null;
  supported: boolean;
  start: () => Promise<boolean>;
  stop: () => Promise<VoiceRecording | null>;
  cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorder {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set while stop() waits for the encoder to hand back the finished file.
  const pendingRef = useRef<((data: Uint8Array | null) => void) | null>(null);

  const supported = typeof window !== 'undefined' && Recorder.isRecordingSupported();

  const teardown = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec) {
      rec.ondataavailable = null;
      rec.onstop = null;
      // Releases the microphone and terminates the encoder worker. Without it
      // the browser keeps showing the recording indicator after the send.
      try {
        rec.close();
      } catch {
        // Already closed; nothing to release.
      }
    }
    setIsRecording(false);
    setElapsedSeconds(0);
  }, []);

  // A component unmounted mid-recording must not leave the microphone open.
  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (recorderRef.current) return false;
    if (!supported) {
      setError('unsupported');
      return false;
    }
    setError(null);

    const rec = new Recorder({
      encoderPath,
      encoderSampleRate: OPUS_SAMPLE_RATE,
      numberOfChannels: 1,
      encoderApplication: OPUS_APPLICATION_VOIP,
      encoderBitRate: OPUS_BITRATE,
      // False means the whole file arrives in one piece when recording stops,
      // which is what an upload wants; streaming pages would need reassembly.
      streamPages: false,
      mediaTrackConstraints: { echoCancellation: true, noiseSuppression: true },
    });

    rec.ondataavailable = (data) => {
      const resolve = pendingRef.current;
      pendingRef.current = null;
      resolve?.(data);
    };

    recorderRef.current = rec;
    try {
      // Must run inside the click that called this, or Safari hands back a
      // silent stream and Chrome leaves the audio context suspended.
      await rec.start();
    } catch (e) {
      recorderRef.current = null;
      try {
        rec.close();
      } catch {
        // Nothing to release.
      }
      // Overwhelmingly this is the microphone permission prompt being refused.
      setError(e instanceof Error ? e.message : 'mic');
      return false;
    }

    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setIsRecording(true);
    tickRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return true;
  }, [supported]);

  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    // Prefer what the encoder actually wrote over wall-clock time: they differ
    // by the frames still in flight when stop was pressed.
    const encoded = rec.encoderSamplePosition;
    const wallClock = (Date.now() - startedAtRef.current) / 1000;
    const durationSeconds = Math.max(
      1,
      Math.round(encoded > 0 ? encoded / OPUS_SAMPLE_RATE : wallClock),
    );

    const data = await new Promise<Uint8Array | null>((resolve) => {
      pendingRef.current = resolve;
      // If the encoder never answers, fail rather than hang the composer.
      const bail = setTimeout(() => {
        if (pendingRef.current === resolve) {
          pendingRef.current = null;
          resolve(null);
        }
      }, 5000);
      void rec
        .stop()
        .catch(() => {
          clearTimeout(bail);
          if (pendingRef.current === resolve) {
            pendingRef.current = null;
            resolve(null);
          }
        })
        .finally(() => clearTimeout(bail));
    });

    teardown();

    if (!data || data.byteLength === 0) {
      setError('empty');
      return null;
    }

    // A fresh copy: the worker's buffer is not ours to hold on to.
    const blob = new Blob([new Uint8Array(data)], { type: 'audio/ogg' });
    const name = `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.ogg`;
    return {
      file: new File([blob], name, { type: 'audio/ogg' }),
      durationSeconds,
      url: URL.createObjectURL(blob),
    };
  }, [teardown]);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) {
      // Consume the encoder's final callback so it cannot resolve a stop() that
      // the operator has already walked away from.
      pendingRef.current = null;
      void rec.stop().catch(() => {});
    }
    teardown();
    setError(null);
  }, [teardown]);

  return { isRecording, elapsedSeconds, error, supported, start, stop, cancel };
}
