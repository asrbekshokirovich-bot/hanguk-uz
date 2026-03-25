import { useCallback, useRef } from 'react';

export function useCallSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playCallChime = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      const now = audioContext.currentTime;

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      // First tone - A5 (880 Hz)
      const osc1 = audioContext.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.connect(gainNode);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Second tone - D6 (1174 Hz)
      const osc2 = audioContext.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174, now + 0.15);
      osc2.connect(gainNode);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.3);

      // Third tone - F#6 (1480 Hz)
      const osc3 = audioContext.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1480, now + 0.3);
      osc3.connect(gainNode);
      osc3.start(now + 0.3);
      osc3.stop(now + 0.5);
    } catch (error) {
      console.error('Failed to play call chime:', error);
    }
  }, [getAudioContext]);

  const playCallEndTone = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      const now = audioContext.currentTime;

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      // Descending tone - G5 to D5
      const osc = audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, now); // G5
      osc.frequency.exponentialRampToValueAtTime(587, now + 0.4); // D5
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (error) {
      console.error('Failed to play call end tone:', error);
    }
  }, [getAudioContext]);

  const playRingingTone = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      const now = audioContext.currentTime;

      // Create gain node
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);

      // Ring pattern: beep-beep, pause, repeat
      for (let i = 0; i < 2; i++) {
        const startTime = now + i * 0.3;
        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.setValueAtTime(0, startTime + 0.1);

        const osc = audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, startTime); // A4
        osc.connect(gainNode);
        osc.start(startTime);
        osc.stop(startTime + 0.1);
      }
    } catch (error) {
      console.error('Failed to play ringing tone:', error);
    }
  }, [getAudioContext]);

  return {
    playCallChime,
    playCallEndTone,
    playRingingTone,
  };
}
