import { ReactNode } from 'react';
import { usePlatform } from '@/hooks/usePlatform';

interface PlatformGateProps {
  /** Content to show when running in Despia native app */
  native?: ReactNode;
  /** Content to show when running in web browser */
  web?: ReactNode;
  /** Content to show only on iOS (native or web) */
  ios?: ReactNode;
  /** Content to show only on Android (native or web) */
  android?: ReactNode;
  /** Fallback content (optional) */
  fallback?: ReactNode;
  /** Children to always render */
  children?: ReactNode;
}

export function PlatformGate({
  native,
  web,
  ios,
  android,
  fallback,
  children,
}: PlatformGateProps) {
  const { isDespia, isIOS, isAndroid } = usePlatform();

  // Render platform-specific content
  let content: ReactNode = null;

  if (isDespia && native !== undefined) {
    content = native;
  } else if (!isDespia && web !== undefined) {
    content = web;
  } else if (isIOS && ios !== undefined) {
    content = ios;
  } else if (isAndroid && android !== undefined) {
    content = android;
  } else if (fallback !== undefined) {
    content = fallback;
  }

  return (
    <>
      {content}
      {children}
    </>
  );
}

// Utility component for showing content only in native app
export function NativeOnly({ children }: { children: ReactNode }) {
  const { isDespia } = usePlatform();
  if (!isDespia) return null;
  return <>{children}</>;
}

// Utility component for showing content only in web browser
export function WebOnly({ children }: { children: ReactNode }) {
  const { isDespia } = usePlatform();
  if (isDespia) return null;
  return <>{children}</>;
}
