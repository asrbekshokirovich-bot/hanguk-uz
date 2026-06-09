import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
// Fixed WebRTC implementation with proper track attachment, ICE queuing, race condition prevention

export interface Participant {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  isSpeaking: boolean;
}

export interface UseVoiceChannelReturn {
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  participants: Participant[];
  localStream: MediaStream | null;
  activeTargetUserId: string | null;
  startSpeaking: (targetUserId: string) => void;
  stopSpeaking: () => void;
  toggleMute: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  joinChannel: () => Promise<void>;
  isInChannel: boolean;
}

// STUN lets peers discover their public address; it works for ~70-80% of
// connections. The rest (symmetric NAT, corporate/office firewalls) need a TURN
// relay or they silently fail to connect. TURN is resolved at runtime so the
// credentials don't have to be baked into the client bundle.
//
// Configure via Vite env (all optional — with none set we fall back to STUN-only,
// i.e. the previous behavior, so this is a zero-regression change):
//   VITE_TURN_FUNCTION      — name of a Supabase Edge Function returning
//                             { iceServers } with short-lived creds (most secure;
//                             see supabase/functions/turn-credentials). The user's
//                             auth token is attached automatically.
//   VITE_TURN_ICE_ENDPOINT  — URL returning { iceServers: [...] } (or a bare array)
//                             with SHORT-LIVED credentials. Preferred for production
//                             so the long-term TURN secret stays server-side.
//   VITE_TURN_URLS          — comma-separated TURN url(s), e.g.
//                             "turn:turn.example.com:3478,turns:turn.example.com:5349"
//   VITE_TURN_USERNAME      — static TURN username (used with VITE_TURN_URLS)
//   VITE_TURN_CREDENTIAL    — static TURN credential (used with VITE_TURN_URLS)
const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let iceServersPromise: Promise<RTCConfiguration> | null = null;

async function buildIceConfiguration(): Promise<RTCConfiguration> {
  // 1. Supabase Edge Function that mints ephemeral TURN creds (most secure — the
  //    user's auth token is attached automatically by the supabase client, so the
  //    relay can only be used by signed-in staff).
  const fnName = import.meta.env.VITE_TURN_FUNCTION as string | undefined;
  if (fnName) {
    try {
      const { data, error } = await supabase.functions.invoke(fnName);
      const servers: RTCIceServer[] | undefined = Array.isArray(data) ? data : data?.iceServers;
      if (!error && servers && servers.length > 0) {
        console.log("[VoiceChannel] Loaded", servers.length, "ICE server(s) from function", fnName);
        return { iceServers: servers };
      }
      console.warn("[VoiceChannel] TURN function returned no iceServers; trying next source", error);
    } catch (e) {
      console.warn("[VoiceChannel] TURN function invoke failed; trying next source", e);
    }
  }

  // 2. Generic runtime endpoint (e.g. Metered) → ephemeral credentials.
  const endpoint = import.meta.env.VITE_TURN_ICE_ENDPOINT as string | undefined;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { credentials: "omit" });
      if (res.ok) {
        const data = await res.json();
        const servers: RTCIceServer[] | undefined = Array.isArray(data) ? data : data?.iceServers;
        if (servers && servers.length > 0) {
          console.log("[VoiceChannel] Loaded", servers.length, "ICE server(s) from endpoint");
          return { iceServers: [...STUN_ONLY, ...servers] };
        }
      }
      console.warn("[VoiceChannel] TURN endpoint returned no iceServers; using STUN only");
    } catch (e) {
      console.warn("[VoiceChannel] Failed to load ICE servers from endpoint; using STUN only", e);
    }
  }

  // 3. Static TURN credentials from env.
  const turnUrls = import.meta.env.VITE_TURN_URLS as string | undefined;
  if (turnUrls) {
    const urls = turnUrls.split(",").map((u) => u.trim()).filter(Boolean);
    if (urls.length > 0) {
      console.log("[VoiceChannel] Using static TURN server(s) from env");
      return {
        iceServers: [
          ...STUN_ONLY,
          {
            urls,
            username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
            credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
          },
        ],
      };
    }
  }

  // 4. No TURN configured → STUN only (previous behavior).
  return { iceServers: STUN_ONLY };
}

// Resolve ICE configuration once (memoized) and reuse it for every peer connection.
function loadIceConfiguration(): Promise<RTCConfiguration> {
  if (!iceServersPromise) {
    iceServersPromise = buildIceConfiguration();
  }
  return iceServersPromise;
}

const CONNECTION_TIMEOUT = 25000; // Increased from 15s for slower networks
const RECONNECT_DELAY = 2000;
const MAX_RETRY_ATTEMPTS = 2;

type PresencePayload = {
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  isSpeaking?: boolean;
};

// Lightweight channel for signaling-only presence (no microphone required)
const SIGNALING_CHANNEL_NAME = "voice-channel";

export function useVoiceChannel(): UseVoiceChannelReturn {
  const { user } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [isInChannel, setIsInChannel] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [activeTargetUserId, setActiveTargetUserId] = useState<string | null>(null);

  // Refs to avoid timing issues
  const activeTargetUserIdRef = useRef<string | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribeReadyPromiseRef = useRef<Promise<void> | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const sendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  // ICE candidate queue for candidates that arrive before remote description is set
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const connectionTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const disconnectGraceTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const audioPlaybackPendingRef = useRef<Set<HTMLAudioElement>>(new Set());

  // Lock to prevent duplicate peer connection creation (race condition fix)
  const creatingConnectionsRef = useRef<Set<string>>(new Set());
  // Promises for pending connection creation (allows awaiting ongoing creation)
  const connectionPromisesRef = useRef<Map<string, Promise<RTCPeerConnection | null>>>(new Map());
  // Track retry attempts for connection timeout (key: participantId, value: attempt count)
  const retryAttemptsRef = useRef<Map<string, number>>(new Map());
  // Health check intervals for active connections
  const healthCheckIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const localStreamRef = useRef<MediaStream | null>(null);
  const myPresenceBaseRef = useRef<{ user_id: string; full_name: string | null; avatar_url: string | null } | null>(null);

  const getLocalAudioTrack = () => localStreamRef.current?.getAudioTracks()?.[0] ?? null;

  const clearConnectionTimeouts = useCallback(() => {
    connectionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    connectionTimeoutsRef.current.clear();

    disconnectGraceTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    disconnectGraceTimeoutsRef.current.clear();

    healthCheckIntervalsRef.current.forEach((interval) => clearInterval(interval));
    healthCheckIntervalsRef.current.clear();

    retryAttemptsRef.current.clear();
  }, []);

  const trackPresence = useCallback(
    async (partial: Partial<PresencePayload>) => {
      const base = myPresenceBaseRef.current;
      if (!base || !presenceChannelRef.current) return;
      await presenceChannelRef.current.track({
        user_id: base.user_id,
        full_name: base.full_name,
        avatar_url: base.avatar_url,
        isSpeaking: false,
        ...partial,
      });
    },
    []
  );

  const cleanup = useCallback(() => {
    console.log("[VoiceChannel] Cleanup called");

    clearConnectionTimeouts();

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    sendersRef.current.clear();
    pendingCandidatesRef.current.clear();
    retryAttemptsRef.current.clear();

    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);

    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    subscribeReadyPromiseRef.current = null;

    activeTargetUserIdRef.current = null;
    isSpeakingRef.current = false;

    setIsConnected(false);
    setIsInChannel(false);
    setIsSpeaking(false);
    setIsMuted(false);
    setActiveTargetUserId(null);
    setParticipants([]);
  }, [clearConnectionTimeouts]);

  const waitForChannelSubscribed = useCallback(async () => {
    if (!presenceChannelRef.current) return;
    if (isInChannel) return;

    if (subscribeReadyPromiseRef.current) {
      await subscribeReadyPromiseRef.current;
      return;
    }

    // Should be set during joinSignalingChannel; fallback just in case.
    subscribeReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
      let finished = false;
      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        subscribeReadyPromiseRef.current = null;
        reject(new Error("SIGNALING_SUBSCRIBE_TIMEOUT"));
      }, 8000);

      presenceChannelRef.current
        ?.subscribe((status) => {
          console.log("[VoiceChannel] Channel subscription status (fallback):", status);
          if (finished) return;
          if (status === "SUBSCRIBED") {
            finished = true;
            clearTimeout(timeout);
            setIsInChannel(true);
            void trackPresence({ isSpeaking: false });
            resolve();
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            finished = true;
            clearTimeout(timeout);
            subscribeReadyPromiseRef.current = null;
            reject(new Error(`SIGNALING_SUBSCRIBE_${status}`));
          }
        });
    });

    await subscribeReadyPromiseRef.current;
  }, [isInChannel, trackPresence]);

  const ensureAudioElement = useCallback((participantId: string, stream: MediaStream) => {
    let audio = audioElementsRef.current.get(participantId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      // Append to DOM to prevent garage collection on iOS Safari
      document.body.appendChild(audio);
      audioElementsRef.current.set(participantId, audio);
    }

    const tracks = stream.getAudioTracks();
    console.log("[VoiceChannel] Setting audio source for", participantId, "tracks:", tracks.length, "enabled:", tracks.map(t => t.enabled));

    audio.srcObject = stream;

    const currentAudio = audio;

    // Enhanced autoplay fallback with multiple event listeners
    const tryPlay = async () => {
      try {
        await currentAudio.play();
        console.log("[VoiceChannel] Audio playing for", participantId);
        audioPlaybackPendingRef.current.delete(currentAudio);
      } catch (err) {
        console.error("[VoiceChannel] Audio play failed for", participantId, err);
        if (!audioPlaybackPendingRef.current.has(currentAudio)) {
          audioPlaybackPendingRef.current.add(currentAudio);
          if (audioPlaybackPendingRef.current.size === 1) {
            toast.info("Ovozni yoqish uchun ekranga bosing", { duration: 3000 });

            // Multiple interaction handlers for better autoplay fallback
            const handleInteraction = () => {
              audioPlaybackPendingRef.current.forEach((a) => {
                a.play().catch(() => { });
              });
              audioPlaybackPendingRef.current.clear();
              document.removeEventListener("click", handleInteraction);
              document.removeEventListener("touchstart", handleInteraction);
              document.removeEventListener("keydown", handleInteraction);
            };
            document.addEventListener("click", handleInteraction, { once: true });
            document.addEventListener("touchstart", handleInteraction, { once: true });
            document.addEventListener("keydown", handleInteraction, { once: true });
          }
        }
      }
    };
    tryPlay();
  }, []);

  const applyTarget = useCallback(async (targetId: string | null) => {
    const track = getLocalAudioTrack();
    console.log("[VoiceChannel] applyTarget:", targetId, "track available:", !!track, "track enabled:", track?.enabled);

    for (const [peerId, sender] of sendersRef.current.entries()) {
      try {
        if (!targetId) {
          await sender.replaceTrack(null);
          console.log("[VoiceChannel] Removed track from sender for", peerId);
        } else if (peerId === targetId) {
          await sender.replaceTrack(track);
          console.log("[VoiceChannel] Attached track to sender for", peerId);
        } else {
          await sender.replaceTrack(null);
        }
      } catch (e) {
        console.error("[VoiceChannel] replaceTrack failed", { peerId, e });
      }
    }
  }, []);

  // Helper to flush pending ICE candidates after remote description is set
  const flushPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(peerId) || [];
    if (pending.length > 0) {
      console.log("[VoiceChannel] Flushing", pending.length, "pending ICE candidates for", peerId);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[VoiceChannel] Failed to add queued ICE candidate", e);
        }
      }
      pendingCandidatesRef.current.delete(peerId);
    }
  }, []);

  const createPeerConnection = useCallback(
    async (participantId: string, isInitiator: boolean) => {
      if (!user) return null;

      // Already exists - return existing connection
      if (peerConnectionsRef.current.has(participantId)) {
        return peerConnectionsRef.current.get(participantId) ?? null;
      }

      // Currently being created - wait for existing promise to resolve (race condition fix)
      if (creatingConnectionsRef.current.has(participantId)) {
        console.log("[VoiceChannel] Waiting for existing connection creation to", participantId);
        const existingPromise = connectionPromisesRef.current.get(participantId);
        if (existingPromise) {
          return existingPromise;
        }
        // Fallback: poll for completion
        return new Promise<RTCPeerConnection | null>((resolve) => {
          const interval = setInterval(() => {
            if (!creatingConnectionsRef.current.has(participantId)) {
              clearInterval(interval);
              resolve(peerConnectionsRef.current.get(participantId) ?? null);
            }
          }, 50);
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(interval);
            resolve(peerConnectionsRef.current.get(participantId) ?? null);
          }, 5000);
        });
      }

      // Lock creation to prevent duplicates
      creatingConnectionsRef.current.add(participantId);

      console.log("[VoiceChannel] Creating peer connection with", participantId, "initiator:", isInitiator);

      const pc = new RTCPeerConnection(await loadIceConfiguration());
      peerConnectionsRef.current.set(participantId, pc);

      // FIX: Attach the actual audio track when creating transceiver (not just "audio" string)
      const track = localStreamRef.current?.getAudioTracks()[0] ?? null;
      const audioTransceiver = pc.addTransceiver(track ?? "audio", {
        direction: "sendrecv",
        streams: track && localStreamRef.current ? [localStreamRef.current] : undefined,
      });
      sendersRef.current.set(participantId, audioTransceiver.sender);

      console.log("[VoiceChannel] Created transceiver with track:", !!track);

      // Enhanced logging for debugging
      pc.oniceconnectionstatechange = () => {
        console.log("[VoiceChannel] ICE state with", participantId, ":", pc.iceConnectionState);

        // If ICE becomes connected/completed, treat as success and clear timeout.
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          const timeout = connectionTimeoutsRef.current.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            connectionTimeoutsRef.current.delete(participantId);
          }
        }
      };

      pc.onsignalingstatechange = () => {
        console.log("[VoiceChannel] Signaling state with", participantId, ":", pc.signalingState);
      };

      pc.onnegotiationneeded = () => {
        console.log("[VoiceChannel] Negotiation needed with", participantId);
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams?.[0];
        if (remoteStream) {
          console.log("[VoiceChannel] Received remote track from", participantId, "tracks:", remoteStream.getAudioTracks().length);
          ensureAudioElement(participantId, remoteStream);
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !presenceChannelRef.current) return;
        console.log("[VoiceChannel] Sending ICE candidate to", participantId);
        presenceChannelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            from: user.id,
            to: participantId,
            candidate: event.candidate.toJSON(),
          },
        });
      };

      pc.onconnectionstatechange = () => {
        console.log("[VoiceChannel] Connection state with", participantId, ":", pc.connectionState);

        if (pc.connectionState === "connected") {
          const timeout = connectionTimeoutsRef.current.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            connectionTimeoutsRef.current.delete(participantId);
          }
        }

        // IMPORTANT:
        // - "disconnected" can be transient; do NOT immediately delete the PC (it can cause us to miss the answer).
        // - "failed" is terminal; cleanup + reconnect.

        if (pc.connectionState === "failed") {
          console.log("[VoiceChannel] Connection failed, will attempt reconnect for", participantId);

          // Cleanup hard
          try {
            pc.close();
          } catch {
            // ignore
          }

          peerConnectionsRef.current.delete(participantId);
          sendersRef.current.delete(participantId);
          pendingCandidatesRef.current.delete(participantId);

          const timeout = connectionTimeoutsRef.current.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            connectionTimeoutsRef.current.delete(participantId);
          }

          const grace = disconnectGraceTimeoutsRef.current.get(participantId);
          if (grace) {
            clearTimeout(grace);
            disconnectGraceTimeoutsRef.current.delete(participantId);
          }

          setTimeout(() => {
            if (presenceChannelRef.current && user) {
              console.log("[VoiceChannel] Reconnecting to", participantId);
              void createPeerConnection(participantId, user.id < participantId);
            }
          }, RECONNECT_DELAY);
          return;
        }

        if (pc.connectionState === "disconnected") {
          // Start a short grace timer; if it doesn't recover, then reconnect.
          if (disconnectGraceTimeoutsRef.current.has(participantId)) return;

          console.log("[VoiceChannel] Disconnected (grace period) for", participantId);
          const graceTimeout = setTimeout(() => {
            disconnectGraceTimeoutsRef.current.delete(participantId);

            // Only reconnect if still disconnected and still tracked.
            const currentPc = peerConnectionsRef.current.get(participantId);
            if (!currentPc) return;
            if (currentPc.connectionState !== "disconnected") return;

            console.log("[VoiceChannel] Disconnected too long, reconnecting to", participantId);

            try {
              currentPc.close();
            } catch {
              // ignore
            }

            peerConnectionsRef.current.delete(participantId);
            sendersRef.current.delete(participantId);
            pendingCandidatesRef.current.delete(participantId);

            const timeout = connectionTimeoutsRef.current.get(participantId);
            if (timeout) {
              clearTimeout(timeout);
              connectionTimeoutsRef.current.delete(participantId);
            }

            if (presenceChannelRef.current && user) {
              void createPeerConnection(participantId, user.id < participantId);
            }
          }, 3500);

          disconnectGraceTimeoutsRef.current.set(participantId, graceTimeout);
        }
      };

      const connectionTimeout = setTimeout(() => {
        if (pc.connectionState !== "connected" && pc.connectionState !== "closed") {
          console.log("[VoiceChannel] Connection timeout for", participantId, "state:", pc.connectionState);

          const currentAttempts = retryAttemptsRef.current.get(participantId) || 0;

          // Retry up to MAX_RETRY_ATTEMPTS times before giving up
          if (currentAttempts < MAX_RETRY_ATTEMPTS) {
            retryAttemptsRef.current.set(participantId, currentAttempts + 1);
            console.log("[VoiceChannel] Timeout attempt", currentAttempts + 1, "of", MAX_RETRY_ATTEMPTS, "for", participantId);

            // Clean up and retry
            try {
              pc.close();
            } catch {
              // ignore
            }
            peerConnectionsRef.current.delete(participantId);
            sendersRef.current.delete(participantId);
            pendingCandidatesRef.current.delete(participantId);
            connectionTimeoutsRef.current.delete(participantId);
            creatingConnectionsRef.current.delete(participantId);

            // Retry connection with increasing delay
            const retryDelay = 500 * (currentAttempts + 1);
            setTimeout(() => {
              if (presenceChannelRef.current && user && isSpeakingRef.current && activeTargetUserIdRef.current === participantId) {
                console.log("[VoiceChannel] Retrying connection to", participantId);
                void createPeerConnection(participantId, user.id < participantId);
              }
            }, retryDelay);
            return;
          }

          // Max retries exceeded - give up
          console.log("[VoiceChannel] Max retries exceeded, giving up for", participantId);
          try {
            pc.close();
          } catch {
            // ignore
          }
          peerConnectionsRef.current.delete(participantId);
          sendersRef.current.delete(participantId);
          pendingCandidatesRef.current.delete(participantId);
          connectionTimeoutsRef.current.delete(participantId);
          creatingConnectionsRef.current.delete(participantId);
          retryAttemptsRef.current.delete(participantId);

          // Notify user only if this is the active target
          if (activeTargetUserIdRef.current === participantId && isSpeakingRef.current) {
            toast.error("Ulanib bo'lmadi. Qayta urinib ko'ring.", { duration: 3000 });
          }
        }
      }, CONNECTION_TIMEOUT);
      connectionTimeoutsRef.current.set(participantId, connectionTimeout);

      try {
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log("[VoiceChannel] Created and set local offer for", participantId);

          presenceChannelRef.current?.send({
            type: "broadcast",
            event: "offer",
            payload: {
              from: user.id,
              to: participantId,
              sdp: offer,
            },
          });
        }

        return pc;
      } catch (e) {
        console.error("[VoiceChannel] Failed during peer init (offer/localDescription)", e);
        try {
          pc.close();
        } catch {
          // ignore
        }
        peerConnectionsRef.current.delete(participantId);
        sendersRef.current.delete(participantId);
        pendingCandidatesRef.current.delete(participantId);
        return null;
      } finally {
        // Release lock after peer connection is created
        creatingConnectionsRef.current.delete(participantId);
        connectionPromisesRef.current.delete(participantId);
      }
    },
    [ensureAudioElement, user]
  );

  // Join signaling channel without microphone (for receiving calls)
  const joinSignalingChannel = useCallback(async () => {
    if (!user) return;
    if (presenceChannelRef.current) {
      console.log("[VoiceChannel] Already in signaling channel");
      await waitForChannelSubscribed();
      return;
    }

    console.log("[VoiceChannel] Joining signaling channel (no mic)...");

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("user_id", user.id)
      .single();

    myPresenceBaseRef.current = {
      user_id: user.id,
      full_name: myProfile?.full_name ?? null,
      avatar_url: myProfile?.avatar_url ?? null,
    };

    const channel = supabase.channel(SIGNALING_CHANNEL_NAME, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;

    // Create a single promise representing the subscribe readiness.
    // IMPORTANT: we subscribe only AFTER all handlers are registered (otherwise we can miss presence sync).
    let statusHandler: ((status: string) => void) | null = null;
    subscribeReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
      let finished = false;
      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        subscribeReadyPromiseRef.current = null;
        reject(new Error("SIGNALING_SUBSCRIBE_TIMEOUT"));
      }, 8000);

      statusHandler = (status: string) => {
        console.log("[VoiceChannel] Channel subscription status:", status);
        if (finished) return;

        if (status === "SUBSCRIBED") {
          finished = true;
          clearTimeout(timeout);
          setIsInChannel(true);
          void trackPresence({ isSpeaking: false });
          resolve();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          finished = true;
          clearTimeout(timeout);
          subscribeReadyPromiseRef.current = null;
          reject(new Error(`SIGNALING_SUBSCRIBE_${status}`));
        }
      };
    });

    const upsertParticipantsFromState = async () => {
      const state = channel.presenceState();
      const next: Participant[] = [];

      for (const [otherUserId, presences] of Object.entries(state)) {
        if (otherUserId === user.id) continue;
        const presence = (presences?.[0] ?? {}) as PresencePayload;
        next.push({
          user_id: otherUserId,
          full_name: presence.full_name ?? null,
          avatar_url: presence.avatar_url ?? null,
          isSpeaking: Boolean(presence.isSpeaking),
        });

        // Create peer connections for users in channel (if we have mic stream)
        if (localStreamRef.current && !peerConnectionsRef.current.has(otherUserId)) {
          const initiator = user.id < otherUserId;
          await createPeerConnection(otherUserId, initiator);
        }
      }

      setParticipants(next);
    };

    channel.on("presence", { event: "sync" }, () => {
      console.log("[VoiceChannel] Presence sync");
      void upsertParticipantsFromState();
    });

    channel.on("presence", { event: "join" }, ({ key }) => {
      if (!key || key === user.id) return;
      console.log("[VoiceChannel] User joined:", key);
      void upsertParticipantsFromState();
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      if (!key || key === user.id) return;
      console.log("[VoiceChannel] User left:", key);

      peerConnectionsRef.current.get(key)?.close();
      peerConnectionsRef.current.delete(key);
      sendersRef.current.delete(key);
      pendingCandidatesRef.current.delete(key);

      const timeout = connectionTimeoutsRef.current.get(key);
      if (timeout) {
        clearTimeout(timeout);
        connectionTimeoutsRef.current.delete(key);
      }

      setParticipants((prev) => prev.filter((p) => p.user_id !== key));
    });

    // Handle offer/answer/ICE signaling
    channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      console.log("[VoiceChannel] Received offer from", payload.from);

      let pc = peerConnectionsRef.current.get(payload.from);
      if (!pc) {
        pc = await createPeerConnection(payload.from, false);
        if (!pc) return;
      }

      try {
        if (pc.signalingState === "stable" || pc.signalingState === "have-local-offer") {
          const isPolite = user.id > payload.from;
          if (pc.signalingState === "have-local-offer" && !isPolite) {
            console.log("[VoiceChannel] Ignoring offer (impolite, have local offer)");
            return;
          }
          if (pc.signalingState === "have-local-offer" && isPolite) {
            console.log("[VoiceChannel] Rolling back local offer (polite)");
            await pc.setLocalDescription({ type: "rollback" });
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        console.log("[VoiceChannel] Set remote offer from", payload.from);

        await flushPendingCandidates(payload.from, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("[VoiceChannel] Created and set answer for", payload.from);

        channel.send({
          type: "broadcast",
          event: "answer",
          payload: {
            from: user.id,
            to: payload.from,
            sdp: answer,
          },
        });
      } catch (e) {
        console.error("[VoiceChannel] Error handling offer", e);
      }
    });

    channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      console.log("[VoiceChannel] Received answer from", payload.from);

      let pc = peerConnectionsRef.current.get(payload.from);

      // FIX #1: If we receive an answer but have no PC, re-create connection
      // This happens when the original offer timed out before answer arrived
      if (!pc) {
        console.warn("[VoiceChannel] No peer connection for answer, re-initiating...", payload.from);

        // Only re-initiate if we're actively trying to talk to this user
        if (activeTargetUserIdRef.current === payload.from && isSpeakingRef.current) {
          console.log("[VoiceChannel] Re-creating connection as we're actively speaking to", payload.from);
          // Reset retry counter for fresh start
          retryAttemptsRef.current.delete(payload.from);
          pc = await createPeerConnection(payload.from, true);
          if (!pc) {
            console.error("[VoiceChannel] Failed to re-create peer connection");
            return;
          }
          // The new offer will trigger a fresh answer, so we don't use the stale answer
        }
        return;
      }

      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          console.log("[VoiceChannel] Set remote answer from", payload.from);
          await flushPendingCandidates(payload.from, pc);
        } else {
          console.log("[VoiceChannel] Ignoring answer, signaling state:", pc.signalingState);
        }
      } catch (e) {
        console.error("[VoiceChannel] Error handling answer", e);
      }
    });

    channel.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.to !== user.id) return;

      const pc = peerConnectionsRef.current.get(payload.from);
      if (!pc || !pc.remoteDescription) {
        const queue = pendingCandidatesRef.current.get(payload.from) || [];
        queue.push(payload.candidate);
        pendingCandidatesRef.current.set(payload.from, queue);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        console.log("[VoiceChannel] Added ICE candidate from", payload.from);
      } catch (e) {
        console.error("[VoiceChannel] Failed to add ICE candidate", e);
      }
    });

    // Subscribe only after all handlers are attached
    channel.subscribe((status) => statusHandler?.(status));

    // Wait until SUBSCRIBED before allowing offers/ICE to be sent.
    try {
      await subscribeReadyPromiseRef.current;
    } catch (e) {
      console.error("[VoiceChannel] Failed to subscribe to signaling channel", e);
      // Ensure we don't keep a half-open channel reference.
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      if (presenceChannelRef.current === channel) {
        presenceChannelRef.current = null;
      }
      throw e;
    }
  }, [createPeerConnection, flushPendingCandidates, trackPresence, user, waitForChannelSubscribed]);

  // Get microphone and connect (for sending audio)
  const connect = useCallback(async () => {
    if (!user) return;
    // If already have local stream, we're fully connected
    if (localStreamRef.current) {
      console.log("[VoiceChannel] Already connected with microphone");
      return;
    }

    console.log("[VoiceChannel] Connecting...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Push-to-talk starts silent
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);

      console.log("[VoiceChannel] Got local media stream");

      // Attach track to any existing peer connections that were created before stream was available
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        for (const [peerId, sender] of sendersRef.current.entries()) {
          if (!sender.track) {
            console.log("[VoiceChannel] Attaching late stream to existing sender for", peerId);
            sender.replaceTrack(audioTrack).catch((e) => {
              console.error("[VoiceChannel] Failed to attach late track to sender", peerId, e);
            });
          }
        }
      }

      // Join signaling channel if not already joined (wait until SUBSCRIBED)
      if (!presenceChannelRef.current) {
        await joinSignalingChannel();
      } else {
        await waitForChannelSubscribed();
        // Update participants to create peer connections now that we have mic
        const state = presenceChannelRef.current.presenceState();
        for (const [otherUserId] of Object.entries(state)) {
          if (otherUserId === user.id) continue;
          if (!peerConnectionsRef.current.has(otherUserId)) {
            const initiator = user.id < otherUserId;
            await createPeerConnection(otherUserId, initiator);
          }
        }
      }

      setIsConnected(true);
    } catch (error) {
      console.error("[VoiceChannel] Failed to connect:", error);
      throw error;
    }
  }, [createPeerConnection, joinSignalingChannel, user, waitForChannelSubscribed]);

  // Alias for backwards compatibility
  const joinChannel = useCallback(async () => {
    await joinSignalingChannel();
  }, [joinSignalingChannel]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const startSpeaking = useCallback(
    (targetUserId: string) => {
      if (!user) {
        console.log("[VoiceChannel] startSpeaking: no user");
        return;
      }
      if (!targetUserId) {
        console.log("[VoiceChannel] startSpeaking: no targetUserId");
        return;
      }
      if (!localStreamRef.current) {
        console.log("[VoiceChannel] startSpeaking: no localStream");
        toast.error("Mikrofon ulangani kutilmoqda...", { duration: 2000 });
        return;
      }
      if (isMuted) {
        console.log("[VoiceChannel] startSpeaking: muted");
        return;
      }

      console.log("[VoiceChannel] startSpeaking to", targetUserId);

      // Mark UI state immediately (press-to-talk feel)
      isSpeakingRef.current = true;
      activeTargetUserIdRef.current = targetUserId;
      setIsSpeaking(true);
      setActiveTargetUserId(targetUserId);

      // Continue async: ensure signaling is ready before we try to send offers/ICE.
      void (async () => {
        try {
          await joinSignalingChannel();

          const track = getLocalAudioTrack();
          if (track) {
            track.enabled = true;
            console.log("[VoiceChannel] Enabled audio track");
          }

          // Create peer connection on-demand if target user not yet connected
          if (!sendersRef.current.get(targetUserId)) {
            console.log("[VoiceChannel] No sender yet for", targetUserId, "- creating peer connection");
            await createPeerConnection(targetUserId, user.id < targetUserId);
          }

          // FIX #5: Add health check for active connection
          const existingHealthCheck = healthCheckIntervalsRef.current.get(targetUserId);
          if (existingHealthCheck) {
            clearInterval(existingHealthCheck);
          }

          const healthCheck = setInterval(() => {
            // Only run health check while actively speaking to this target
            if (activeTargetUserIdRef.current !== targetUserId || !isSpeakingRef.current) {
              clearInterval(healthCheck);
              healthCheckIntervalsRef.current.delete(targetUserId);
              return;
            }

            const currentPc = peerConnectionsRef.current.get(targetUserId);
            if (!currentPc || currentPc.connectionState === "failed" || currentPc.connectionState === "closed") {
              console.log("[VoiceChannel] Health check failed, reconnecting to", targetUserId);
              clearInterval(healthCheck);
              healthCheckIntervalsRef.current.delete(targetUserId);
              // Reset retry counter for fresh connection attempt
              retryAttemptsRef.current.delete(targetUserId);
              void createPeerConnection(targetUserId, user.id < targetUserId);
            }
          }, 5000);
          healthCheckIntervalsRef.current.set(targetUserId, healthCheck);

          // Apply routing (track -> target)
          if (activeTargetUserIdRef.current === targetUserId) {
            void applyTarget(targetUserId);
            void trackPresence({ isSpeaking: true });
          }
        } catch (e) {
          console.error("[VoiceChannel] startSpeaking failed", e);

          // Revert state + silence mic
          const track = getLocalAudioTrack();
          if (track) track.enabled = false;
          isSpeakingRef.current = false;
          activeTargetUserIdRef.current = null;
          setIsSpeaking(false);
          setActiveTargetUserId(null);

          toast.error("Ovozli kanalga ulanib bo'lmadi", { duration: 2500 });
        }
      })();
    },
    [applyTarget, createPeerConnection, isMuted, joinSignalingChannel, trackPresence, user]
  );

  const stopSpeaking = useCallback(() => {
    console.log("[VoiceChannel] stopSpeaking");

    const track = getLocalAudioTrack();
    if (track) {
      track.enabled = false;
    }

    isSpeakingRef.current = false;
    const prevTarget = activeTargetUserIdRef.current;
    activeTargetUserIdRef.current = null;

    // Clear health check for previous target
    if (prevTarget) {
      const healthCheck = healthCheckIntervalsRef.current.get(prevTarget);
      if (healthCheck) {
        clearInterval(healthCheck);
        healthCheckIntervalsRef.current.delete(prevTarget);
      }
    }

    setIsSpeaking(false);
    setActiveTargetUserId(null);

    void applyTarget(null);
    void trackPresence({ isSpeaking: false });
  }, [applyTarget, trackPresence]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      console.log("[VoiceChannel] toggleMute:", next);
      if (next) {
        // If muting while speaking, stop
        stopSpeaking();
      }
      return next;
    });
  }, [stopSpeaking]);

  // Stable memo for return shape
  const api = useMemo<UseVoiceChannelReturn>(
    () => ({
      isConnected,
      isSpeaking,
      isMuted,
      participants,
      localStream,
      activeTargetUserId,
      startSpeaking,
      stopSpeaking,
      toggleMute,
      connect,
      disconnect,
      joinChannel,
      isInChannel,
    }),
    [
      activeTargetUserId,
      connect,
      disconnect,
      isConnected,
      isInChannel,
      isMuted,
      isSpeaking,
      joinChannel,
      localStream,
      participants,
      startSpeaking,
      stopSpeaking,
      toggleMute,
    ]
  );

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return api;
}
