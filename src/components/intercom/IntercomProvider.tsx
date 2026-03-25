import { createContext, useContext, ReactNode } from 'react';
import { useIntercomCaller } from '@/hooks/useIntercomCaller';
import { useStaffPresence } from '@/hooks/useStaffPresence';
import { IntercomListener } from './IntercomListener';
import { ActiveCallOverlay } from './ActiveCallOverlay';

interface IntercomContextType {
  callState: ReturnType<typeof useIntercomCaller>['callState'];
  startCall: (callee: { userId: string; name: string; avatar?: string }) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  isUserOnline: (userId: string) => boolean;
  getUserStatus: (userId: string) => 'online' | 'away' | 'busy' | 'offline';
}

const IntercomContext = createContext<IntercomContextType | null>(null);

export function useIntercom() {
  const context = useContext(IntercomContext);
  if (!context) {
    throw new Error('useIntercom must be used within IntercomProvider');
  }
  return context;
}

interface IntercomProviderProps {
  children: ReactNode;
}

export function IntercomProvider({ children }: IntercomProviderProps) {
  const { callState, startCall, endCall, toggleMute } = useIntercomCaller();
  const { isUserOnline, getUserStatus } = useStaffPresence();

  return (
    <IntercomContext.Provider
      value={{
        callState,
        startCall,
        endCall,
        toggleMute,
        isUserOnline,
        getUserStatus,
      }}
    >
      {children}
      
      {/* Global incoming call listener */}
      <IntercomListener />
      
      {/* Outgoing call overlay */}
      {(callState.isActive || callState.isCalling) && callState.callee && (
        <ActiveCallOverlay
          isActive={callState.isActive}
          isCalling={callState.isCalling}
          userName={callState.callee.name}
          userAvatar={callState.callee.avatar}
          startTime={callState.startTime}
          isMuted={callState.isMuted}
          onEndCall={endCall}
          onToggleMute={toggleMute}
        />
      )}
    </IntercomContext.Provider>
  );
}
