import { ReactNode, useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { usePlatform } from '@/hooks/usePlatform';

interface AppInitializerProps {
  children: ReactNode;
}

export function AppInitializer({ children }: AppInitializerProps) {
  const { isDespia } = usePlatform();

  useEffect(() => {
    const initializeApp = async () => {
      if (isDespia) {
        try {
          // Hide splash screen after app loads
          await SplashScreen.hide();
        } catch (error) {
          console.warn('Failed to hide splash screen:', error);
        }
      }
    };

    // Small delay to ensure app is fully rendered
    const timer = setTimeout(initializeApp, 100);

    return () => clearTimeout(timer);
  }, [isDespia]);

  // Render children immediately - splash screen handles loading state
  return <>{children}</>;
}
