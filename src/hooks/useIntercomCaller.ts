import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CalleeInfo {
  userId: string;
  name: string;
  avatar?: string;
}

interface CallState {
  isActive: boolean;
  isCalling: boolean;
  callId: string | null;
  callee: CalleeInfo | null;
  startTime: Date | null;
  isMuted: boolean;
}

export function useIntercomCaller() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    isCalling: false,
    callId: null,
    callee: null,
    startTime: null,
    isMuted: false,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Clean up resources
  const cleanup = useCallback(() => {
    console.log('[IntercomCaller] Cleaning up resources');

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

    pendingCandidatesRef.current = [];

    setCallState({
      isActive: false,
      isCalling: false,
      callId: null,
      callee: null,
      startTime: null,
      isMuted: false,
    });
  }, []);

  // Start a call to a specific user
  const startCall = useCallback(async (callee: CalleeInfo) => {
    if (!user) {
      console.error('[IntercomCaller] No user logged in');
      return;
    }

    console.log('[IntercomCaller] Starting call to:', callee.name);

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      // Generate unique call ID
      const callId = `${user.id}-${callee.userId}-${Date.now()}`;
      const channelName = `intercom-${callId}`;

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

      // Handle incoming audio from callee
      pc.ontrack = (event) => {
        console.log('[IntercomCaller] Received remote track');
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        audio.play().catch(console.error);
      };

      // Set up signaling channel
      const channel = supabase.channel(channelName);
      channelRef.current = channel;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[IntercomCaller] Sending ICE candidate');
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              candidate: event.candidate,
              from: user.id,
            },
          });
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[IntercomCaller] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallState(prev => ({
            ...prev,
            isActive: true,
            isCalling: false,
            startTime: new Date(),
          }));
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          cleanup();
        }
      };

      // Subscribe to channel events
      channel
        .on('broadcast', { event: 'answer' }, async (payload) => {
          console.log('[IntercomCaller] Received answer');
          try {
            const answer = payload.payload.answer;
            await pc.setRemoteDescription(new RTCSessionDescription(answer));

            // Flush pending ICE candidates
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
              }
            }
          } catch (err) {
            console.error('[IntercomCaller] Error setting remote description:', err);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
          if (payload.payload.from !== user.id) {
            console.log('[IntercomCaller] Received ICE candidate from callee');
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
              } else {
                pendingCandidatesRef.current.push(payload.payload.candidate);
              }
            } catch (err) {
              console.error('[IntercomCaller] Error adding ICE candidate:', err);
            }
          }
        })
        .on('broadcast', { event: 'call-end' }, () => {
          console.log('[IntercomCaller] Call ended by callee');
          cleanup();
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[IntercomCaller] Channel subscribed, creating offer');

            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Send offer to callee's personal channel
            const calleeChannel = supabase.channel(`intercom-signals-${callee.userId}`);

            calleeChannel.subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                console.log('[IntercomCaller] Sending offer to callee');
                await calleeChannel.send({
                  type: 'broadcast',
                  event: 'incoming-call',
                  payload: {
                    callId,
                    channelName,
                    offer,
                    caller: {
                      userId: user.id,
                      name: user.user_metadata?.full_name || 'Unknown',
                    },
                  },
                });

                // Allow some time for successful transmission before unsubscribing
                setTimeout(() => calleeChannel.unsubscribe(), 2500);
              }
            });

            // Store call in database
            await supabase.from('intercom_calls').insert({
              caller_id: user.id,
              callee_id: callee.userId,
              channel_name: channelName,
              status: 'ringing',
            });
          }
        });

      setCallState({
        isActive: false,
        isCalling: true,
        callId,
        callee,
        startTime: null,
        isMuted: false,
      });

      // Timeout if no answer after 30 seconds
      setTimeout(() => {
        setCallState(prev => {
          if (prev.isCalling && !prev.isActive) {
            console.log('[IntercomCaller] Call timed out');
            cleanup();
          }
          return prev;
        });
      }, 30000);

    } catch (err) {
      console.error('[IntercomCaller] Error starting call:', err);
      cleanup();
    }
  }, [user, cleanup]);

  // End the current call
  const endCall = useCallback(async () => {
    console.log('[IntercomCaller] Ending call');

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { from: user?.id },
      });
    }

    if (callState.callId) {
      await supabase
        .from('intercom_calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('channel_name', `intercom-${callState.callId}`);
    }

    cleanup();
  }, [user, callState.callId, cleanup]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    callState,
    startCall,
    endCall,
    toggleMute,
  };
}
