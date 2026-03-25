import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CallerInfo {
  userId: string;
  name: string;
}

interface IncomingCallState {
  isActive: boolean;
  isRinging: boolean;
  callId: string | null;
  channelName: string | null;
  caller: CallerInfo | null;
  startTime: Date | null;
  isMuted: boolean;
  incomingOffer: RTCSessionDescriptionInit | null;
}

export function useIntercomListener() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<IncomingCallState>({
    isActive: false,
    isRinging: false,
    callId: null,
    channelName: null,
    caller: null,
    startTime: null,
    isMuted: false,
    incomingOffer: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Clean up resources
  const cleanup = useCallback(() => {
    console.log('[IntercomListener] Cleaning up resources');

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.parentNode) {
        audioRef.current.parentNode.removeChild(audioRef.current);
      }
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }

    pendingCandidatesRef.current = [];

    setCallState({
      isActive: false,
      isRinging: false,
      callId: null,
      channelName: null,
      caller: null,
      startTime: null,
      isMuted: false,
      incomingOffer: null,
    });
  }, []);

  // Handle incoming call - just set ringing state
  const handleIncomingCall = useCallback((payload: {
    callId: string;
    channelName: string;
    offer: RTCSessionDescriptionInit;
    caller: CallerInfo;
  }) => {
    console.log('[IntercomListener] Incoming call from:', payload.caller.name);

    // Play a brief chime for incoming call (user gesture not always strictly required for all browsers if it's brief, but we trigger ringing state)
    try {
      const chime = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdHqBf4Z8aWNzcHmChYSEen55eXt7enl6gISFhYR/gYKChYaGhoWFhISDgoSEhIaFhISDgYB/gIOFhYWFhYSCgYB/gIOEhYaGhYSDgYB/f4CDhIWGhYWDgoB/f4CDhIWFhYWEg4KBgICAgoOEhISEhIOCgYGAgIGCg4SEhISEg4KBgYCAf4GCg4OEg4ODgoGBgYCAgYKCg4ODg4OCgoGBgIGBgoKCg4ODg4KCgoGBgYGBgoKCgoKCgoKCgoGBgYGBgoKCgoKCgoKCgoKBgYGBgYKCgoKCgoKCgoKBgYGBgYKCgoKCgoKCgoKBgYGBgYKCgoKCgoKCgoKBgYGBgYKCgoKCgoKCgoKBgYGBgYGCgoKCgoKCgoKBgYGBgQ==');
      chime.volume = 0.3;
      chime.play().catch(() => { });
    } catch (e) {
      // Ignore audio play errors
    }

    setCallState({
      isActive: false,
      isRinging: true,
      callId: payload.callId,
      channelName: payload.channelName,
      caller: payload.caller,
      startTime: null,
      isMuted: false,
      incomingOffer: payload.offer,
    });
  }, []);

  // Accept the incoming call (Requires explicit User Action)
  const acceptCall = useCallback(async () => {
    if (!callState.incomingOffer || !callState.channelName) return;

    try {
      console.log('[IntercomListener] Accepting call');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = pc;

      // Add audio track
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle incoming audio from caller
      pc.ontrack = (event) => {
        console.log('[IntercomListener] Received remote track');
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        // Append to DOM to prevent garbage collection on mobile Safari
        document.body.appendChild(audio);
        audioRef.current = audio;
        audio.play().catch(console.error);
      };

      // Set up signaling channel
      const channel = supabase.channel(callState.channelName);
      channelRef.current = channel;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[IntercomListener] Sending ICE candidate');
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              candidate: event.candidate,
              from: user?.id,
            },
          });
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[IntercomListener] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallState(prev => ({
            ...prev,
            isActive: true,
            isRinging: false,
            startTime: new Date(),
          }));
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          cleanup();
        }
      };

      // Subscribe to channel events
      channel
        .on('broadcast', { event: 'ice-candidate' }, async (eventPayload) => {
          if (eventPayload.payload.from !== user?.id) {
            console.log('[IntercomListener] Received ICE candidate from caller');
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(eventPayload.payload.candidate));
              } else {
                // Queue candidate if remote description isn't set yet
                pendingCandidatesRef.current.push(eventPayload.payload.candidate);
              }
            } catch (err) {
              console.error('[IntercomListener] Error adding ICE candidate:', err);
            }
          }
        })
        .on('broadcast', { event: 'call-end' }, () => {
          console.log('[IntercomListener] Call ended by caller');
          cleanup();
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[IntercomListener] Channel subscribed, processing offer');

            // Set remote description (offer)
            await pc.setRemoteDescription(new RTCSessionDescription(callState.incomingOffer!));

            // Flush pending ICE candidates
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
              }
            }

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log('[IntercomListener] Sending answer');
            await channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { answer },
            });

            // Update call status in database
            await supabase
              .from('intercom_calls')
              .update({
                status: 'active',
                started_at: new Date().toISOString(),
              })
              .eq('channel_name', callState.channelName);
          }
        });

    } catch (err) {
      console.error('[IntercomListener] Error accepting incoming call:', err);
      cleanup();
    }
  }, [callState, user, cleanup]);

  // End the current call
  const endCall = useCallback(async () => {
    console.log('[IntercomListener] Ending call');

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { from: user?.id },
      });
    }

    if (callState.channelName) {
      await supabase
        .from('intercom_calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('channel_name', callState.channelName);
    }

    cleanup();
  }, [user, callState.channelName, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setCallState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, []);

  // Set up listener for incoming calls
  useEffect(() => {
    if (!user) return;

    console.log('[IntercomListener] Setting up listener for user:', user.id);

    const personalChannel = supabase.channel(`intercom-signals-${user.id}`);

    personalChannel
      .on('broadcast', { event: 'incoming-call' }, (payload) => {
        console.log('[IntercomListener] Received incoming-call event');
        // Only handle if not actively handling another call
        if (!callState.isActive && !callState.isRinging && !callState.callId) {
          handleIncomingCall(payload.payload);
        }
      })
      .subscribe((status) => {
        console.log('[IntercomListener] Personal channel status:', status);
      });

    return () => {
      personalChannel.unsubscribe();
      cleanup();
    };
  }, [user, handleIncomingCall, cleanup, callState.isActive, callState.callId]);

  return {
    callState,
    acceptCall,
    endCall,
    toggleMute,
  };
}
