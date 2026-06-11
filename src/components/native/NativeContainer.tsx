import { ReactNode, useEffect } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { useStatusBar } from '@/hooks/useStatusBar';
import { cn } from '@/lib/utils';

interface NativeContainerProps {
  children: ReactNode;
  className?: string;
  statusBarStyle?: 'light' | 'dark' | 'default';
  hideStatusBar?: boolean;
}

export function NativeContainer({
  children,
  className,
  statusBarStyle = 'dark',
  hideStatusBar = false
}: NativeContainerProps) {
  const { isDespia, isIOS, isAndroid } = usePlatform();
  
  useStatusBar({
    style: statusBarStyle,
    backgroundColor: '#1A3A6C',
    hidden: hideStatusBar
  });

  return (
    <div
      className={cn(
        'min-h-screen w-full',
        isDespia && 'native-container',
        isIOS && 'ios-container',
        isAndroid && 'android-container',
        className
      )}
      style={{
        paddingTop: isDespia ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: isDespia ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: isDespia ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: isDespia ? 'env(safe-area-inset-right)' : undefined
      }}
    >
      {children}
    </div>
  );
}

// Safe area spacing components
export function SafeAreaTop({ className }: { className?: string }) {
  const { isDespia } = usePlatform();
  
  if (!isDespia) return null;
  
  return (
    <div 
      className={cn('w-full', className)}
      style={{ height: 'env(safe-area-inset-top)' }}
    />
  );
}

export function SafeAreaBottom({ className }: { className?: string }) {
  const { isDespia } = usePlatform();
  
  if (!isDespia) return null;
  
  return (
    <div 
      className={cn('w-full', className)}
      style={{ height: 'env(safe-area-inset-bottom)' }}
    />
  );
}
