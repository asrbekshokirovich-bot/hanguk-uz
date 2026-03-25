import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { useVoiceChannel, type UseVoiceChannelReturn } from "@/hooks/useVoiceChannel";
import { useStaffPresence } from "@/hooks/useStaffPresence";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

type VoiceChannelContextValue = ReturnType<typeof useVoiceChannel> & {
  targetUserId: string | null;
  setTargetUserId: (userId: string | null) => void;
  ensureConnected: () => Promise<void>;
  isAutoConnecting: boolean;
  connectionError: string | null;
  hasMicrophonePermission: boolean;
  ensureInChannel: () => Promise<void>;
  onlineStaffIds: string[];
  isContextReady: boolean;
};

const VoiceChannelContext = createContext<VoiceChannelContextValue | null>(null);

export function useVoiceChannelContext() {
  const ctx = useContext(VoiceChannelContext);
  if (!ctx) {
    // During HMR or if provider is not mounted yet, return a safe fallback
    // This prevents crashes during hot module replacement
    console.warn("[VoiceChannelProvider] Context not available, returning fallback");
    return {
      isConnected: false,
      isSpeaking: false,
      isMuted: false,
      participants: [],
      localStream: null,
      activeTargetUserId: null,
      startSpeaking: () => {
        console.warn("[VoiceChannelProvider] startSpeaking called on fallback context");
      },
      stopSpeaking: () => {},
      toggleMute: () => {},
      connect: async () => {
        throw new Error("VoiceChannel context not ready");
      },
      disconnect: () => {},
      joinChannel: async () => {
        throw new Error("VoiceChannel context not ready");
      },
      isInChannel: false,
      targetUserId: null,
      setTargetUserId: () => {},
      ensureConnected: async () => {
        throw new Error("VoiceChannel context not ready");
      },
      isAutoConnecting: false,
      connectionError: null,
      hasMicrophonePermission: false,
      ensureInChannel: async () => {
        throw new Error("VoiceChannel context not ready");
      },
      onlineStaffIds: [],
      isContextReady: false,
    } as VoiceChannelContextValue;
  }
  return ctx;
}

export function VoiceChannelProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isStaff, loading: roleLoading } = useUserRole();
  const voice = useVoiceChannel();
  const { onlineStaff } = useStaffPresence();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const autoJoinAttemptsRef = useRef(0);
  const autoJoinInProgressRef = useRef(false);
  const [isContextReady, setIsContextReady] = useState(false);

  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const joinChannelPromiseRef = useRef<Promise<void> | null>(null);
  
  // Mark context as ready after mount
  useEffect(() => {
    setIsContextReady(true);
    return () => setIsContextReady(false);
  }, []);
  
  // Get online staff IDs (excluding current user)
  const onlineStaffIds = useMemo(() => {
    return onlineStaff
      .filter(s => s.userId !== user?.id && s.status === 'online')
      .map(s => s.userId);
  }, [onlineStaff, user?.id]);
  
  // Check existing microphone permission status on mount
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
        setHasMicrophonePermission(result.state === "granted");
        result.onchange = () => {
          setHasMicrophonePermission(result.state === "granted");
        };
      }).catch(() => {
        // Some browsers don't support microphone permission query
      });
    }
  }, []);

  // FIX #3: More robust auto-join with retry logic
  useEffect(() => {
    // Wait for role to fully load
    if (!user || roleLoading) return;
    // Only for staff
    if (!isStaff) return;
    // Already joined
    if (voice.isInChannel) {
      autoJoinAttemptsRef.current = 0;
      autoJoinInProgressRef.current = false;
      return;
    }
    // Already trying
    if (autoJoinInProgressRef.current) return;
    // Max 3 attempts
    if (autoJoinAttemptsRef.current >= 3) return;
    
    autoJoinInProgressRef.current = true;
    
    const tryJoin = async (attempt: number) => {
      if (voice.isInChannel) {
        autoJoinInProgressRef.current = false;
        return;
      }
      
      console.log(`[VoiceChannelProvider] Auto-joining signaling channel (attempt ${attempt}/3)`);
      
      try {
        await voice.joinChannel();
        console.log("[VoiceChannelProvider] Auto-join successful");
        autoJoinAttemptsRef.current = 0;
        autoJoinInProgressRef.current = false;
      } catch (err) {
        console.log("[VoiceChannelProvider] Auto-join failed:", err);
        autoJoinAttemptsRef.current = attempt;
        
        if (attempt < 3) {
          // Exponential backoff: 2s, 4s, 6s
          const delay = 2000 * attempt;
          console.log(`[VoiceChannelProvider] Retrying in ${delay}ms...`);
          setTimeout(() => {
            if (!voice.isInChannel) {
              tryJoin(attempt + 1);
            } else {
              autoJoinInProgressRef.current = false;
            }
          }, delay);
        } else {
          autoJoinInProgressRef.current = false;
        }
      }
    };
    
    // Initial delay to let other initialization complete
    const timer = setTimeout(() => tryJoin(1), 1500);
    
    return () => clearTimeout(timer);
  }, [user, roleLoading, isStaff, voice.isInChannel]);

  // Update permission state when connected
  useEffect(() => {
    if (voice.isConnected && voice.localStream) {
      setHasMicrophonePermission(true);
    }
  }, [voice.isConnected, voice.localStream]);

  // Join channel without requiring microphone (for receiving calls)
  const ensureInChannel = useCallback(async () => {
    if (voice.isInChannel) return;
    
    // Join the signaling channel without requiring microphone
    console.log("[VoiceChannelProvider] ensureInChannel - joining signaling channel");
    await voice.joinChannel();
  }, [voice.isInChannel, voice.joinChannel]);

  const ensureConnected = useCallback(async () => {
    if (voice.isConnected) return;
    
    setConnectionError(null);
    
    if (!connectPromiseRef.current) {
      setIsAutoConnecting(true);
      connectPromiseRef.current = voice.connect()
        .then(() => {
          setHasMicrophonePermission(true);
        })
        .catch((error) => {
          console.error("[VoiceChannel] Connection error:", error);
          const errorMessage = error instanceof Error ? error.message : "Ulanishda xatolik";
          
          // Handle specific errors
          if (error.name === "NotAllowedError" || errorMessage.includes("Permission")) {
            setConnectionError("Mikrofonga ruxsat berilmadi");
            toast.error("Mikrofonga ruxsat berilmadi. Brauzer sozlamalarini tekshiring.");
          } else if (error.name === "NotFoundError") {
            setConnectionError("Mikrofon topilmadi");
            toast.error("Mikrofon topilmadi. Qurilmangizni tekshiring.");
          } else {
            setConnectionError(errorMessage);
            toast.error("Ovozli kanalga ulanib bo'lmadi");
          }
          
          throw error;
        })
        .finally(() => {
          connectPromiseRef.current = null;
          setIsAutoConnecting(false);
        });
    }
    await connectPromiseRef.current;
  }, [voice]);

  const value = useMemo<VoiceChannelContextValue>(
    () => ({
      ...voice,
      targetUserId,
      setTargetUserId,
      ensureConnected,
      isAutoConnecting,
      connectionError,
      hasMicrophonePermission,
      ensureInChannel,
      onlineStaffIds,
      isContextReady,
    }),
    [voice, targetUserId, ensureConnected, ensureInChannel, isAutoConnecting, connectionError, hasMicrophonePermission, onlineStaffIds, isContextReady]
  );

  return <VoiceChannelContext.Provider value={value}>{children}</VoiceChannelContext.Provider>;
}
