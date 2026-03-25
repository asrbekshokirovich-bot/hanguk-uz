import { useEffect } from 'react';
import { useIntercomListener } from '@/hooks/useIntercomListener';
import { useCallSounds } from '@/hooks/useCallSounds';
import { ActiveCallOverlay } from './ActiveCallOverlay';

/**
 * IntercomListener component runs in the background for all staff members.
 * It listens for incoming calls and auto-answers them.
 * Should be rendered at the root of the CRM portal.
 */
export function IntercomListener() {
  const { callState, acceptCall, endCall, toggleMute } = useIntercomListener();
  const { playCallChime, playCallEndTone } = useCallSounds();

  // Play chime when call becomes active
  useEffect(() => {
    if (callState.isActive && callState.startTime) {
      playCallChime();
    }
  }, [callState.isActive, callState.startTime, playCallChime]);

  // Play end tone when call ends
  useEffect(() => {
    if (!callState.isActive && !callState.callId) {
      // Only play if we had an active call before
      return;
    }
  }, [callState.isActive, callState.callId]);

  const handleEndCall = () => {
    playCallEndTone();
    endCall();
  };

  // Only show overlay if there's an active or incoming call
  if (!callState.isActive && !callState.isRinging && !callState.callId) {
    return null;
  }

  return (
    <ActiveCallOverlay
      isActive={callState.isActive}
      isCalling={false} // Listener never shows "calling" state, only "active"
      isRinging={callState.isRinging}
      userName={callState.caller?.name || 'Unknown'}
      startTime={callState.startTime}
      isMuted={callState.isMuted}
      onAcceptCall={acceptCall}
      onEndCall={handleEndCall}
      onToggleMute={toggleMute}
    />
  );
}
