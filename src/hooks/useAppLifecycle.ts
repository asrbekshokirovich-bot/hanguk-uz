import { useEffect, useCallback } from 'react';
import { App, AppState } from '@capacitor/app';
import { usePlatform } from './usePlatform';

interface AppLifecycleCallbacks {
  onResume?: () => void;
  onPause?: () => void;
  onStateChange?: (state: AppState) => void;
}

export function useAppLifecycle(callbacks?: AppLifecycleCallbacks) {
  const { isDespia } = usePlatform();

  const handleStateChange = useCallback((state: AppState) => {
    if (state.isActive) {
      callbacks?.onResume?.();
    } else {
      callbacks?.onPause?.();
    }
    callbacks?.onStateChange?.(state);
  }, [callbacks]);

  useEffect(() => {
    if (!isDespia) return;

    let listener: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        listener = await App.addListener('appStateChange', handleStateChange);
      } catch (error) {
        console.warn('Failed to add app state listener:', error);
      }
    };

    setupListener();

    return () => {
      listener?.remove();
    };
  }, [isDespia, handleStateChange]);

  return { isDespia };
}

// Hook for data refetch on resume
export function useRefetchOnResume(refetchFn: () => void) {
  useAppLifecycle({
    onResume: refetchFn
  });
}
