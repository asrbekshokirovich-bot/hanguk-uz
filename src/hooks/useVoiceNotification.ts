import { useCallback, useRef } from 'react';

interface NotificationOptions {
  volume?: number;
}

export function useVoiceNotification(options: NotificationOptions = {}) {
  const { volume = 0.5 } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playNotificationSound = useCallback(() => {
    // Create a simple notification tone using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create oscillator for notification tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant notification sound - two-tone chime
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
      
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Second chime
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        osc2.frequency.setValueAtTime(1318.51, audioContext.currentTime); // E6
        gain2.gain.setValueAtTime(volume, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        osc2.type = 'sine';
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.4);
      }, 150);
      
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [volume]);

  const notifyTaskCreated = useCallback(() => {
    playNotificationSound();
  }, [playNotificationSound]);

  const notifyTaskAssigned = useCallback(() => {
    playNotificationSound();
  }, [playNotificationSound]);

  const notifyTaskCompleted = useCallback(() => {
    playNotificationSound();
  }, [playNotificationSound]);

  const notifyCustom = useCallback(() => {
    playNotificationSound();
  }, [playNotificationSound]);

  return {
    playNotificationSound,
    notifyTaskCreated,
    notifyTaskAssigned,
    notifyTaskCompleted,
    notifyCustom,
  };
}
