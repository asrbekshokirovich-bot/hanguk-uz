import { useEffect, useCallback } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlatform } from './usePlatform';

const ROOT_PATHS = ['/', '/portal', '/crm', '/auth'];

interface BackButtonOptions {
  onBackPress?: () => boolean; // Return true to prevent default behavior
  exitOnRoot?: boolean;
}

export function useBackButton(options?: BackButtonOptions) {
  const { isDespia, isAndroid } = usePlatform();
  const navigate = useNavigate();
  const location = useLocation();

  const handleBackButton = useCallback(async () => {
    // Custom handler takes priority
    if (options?.onBackPress?.()) {
      return;
    }

    // Check if we're at a root path
    const isRoot = ROOT_PATHS.includes(location.pathname);

    if (isRoot) {
      if (options?.exitOnRoot !== false) {
        // Exit the app on root pages
        try {
          await App.exitApp();
        } catch (error) {
          console.warn('Failed to exit app:', error);
        }
      }
    } else {
      // Navigate back in history
      navigate(-1);
    }
  }, [location.pathname, navigate, options]);

  useEffect(() => {
    // Only handle back button on Android in native app
    if (!isDespia || !isAndroid) return;

    let listener: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        listener = await App.addListener('backButton', handleBackButton);
      } catch (error) {
        console.warn('Failed to add back button listener:', error);
      }
    };

    setupListener();

    return () => {
      listener?.remove();
    };
  }, [isDespia, isAndroid, handleBackButton]);

  return { isAndroid };
}
