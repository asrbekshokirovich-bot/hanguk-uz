import { useMemo } from 'react';

export interface PlatformInfo {
  isDespia: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  isPWA: boolean;
  platform: 'despia-ios' | 'despia-android' | 'web-ios' | 'web-android' | 'web-desktop';
}

function detectPlatform(): PlatformInfo {
  if (typeof navigator === 'undefined') {
    return {
      isDespia: false,
      isIOS: false,
      isAndroid: false,
      isWeb: true,
      isPWA: false,
      platform: 'web-desktop',
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  
  const isDespia = ua.includes('despia');
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = ua.includes('android');
  const isPWA = typeof window !== 'undefined' && 
    window.matchMedia('(display-mode: standalone)').matches;
  const isWeb = !isDespia;
  
  let platform: PlatformInfo['platform'];
  if (isDespia && isIOS) platform = 'despia-ios';
  else if (isDespia && isAndroid) platform = 'despia-android';
  else if (isIOS) platform = 'web-ios';
  else if (isAndroid) platform = 'web-android';
  else platform = 'web-desktop';
  
  return { isDespia, isIOS, isAndroid, isWeb, isPWA, platform };
}

export function usePlatform(): PlatformInfo {
  return useMemo(() => detectPlatform(), []);
}

// For use outside of React components
export const getPlatformInfo = detectPlatform;
