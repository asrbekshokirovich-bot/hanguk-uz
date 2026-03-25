import { useEffect, useCallback } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { usePlatform } from './usePlatform';

type StatusBarStyle = 'light' | 'dark' | 'default';

interface StatusBarOptions {
  style?: StatusBarStyle;
  backgroundColor?: string;
  hidden?: boolean;
}

export function useStatusBar(options?: StatusBarOptions) {
  const { isDespia } = usePlatform();

  const setStyle = useCallback(async (style: StatusBarStyle) => {
    if (!isDespia) return;

    try {
      const capStyle = style === 'light' ? Style.Light : 
                       style === 'dark' ? Style.Dark : 
                       Style.Default;
      await StatusBar.setStyle({ style: capStyle });
    } catch (error) {
      console.warn('Failed to set status bar style:', error);
    }
  }, [isDespia]);

  const setBackgroundColor = useCallback(async (color: string) => {
    if (!isDespia) return;

    try {
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      console.warn('Failed to set status bar background:', error);
    }
  }, [isDespia]);

  const hide = useCallback(async () => {
    if (!isDespia) return;

    try {
      await StatusBar.hide();
    } catch (error) {
      console.warn('Failed to hide status bar:', error);
    }
  }, [isDespia]);

  const show = useCallback(async () => {
    if (!isDespia) return;

    try {
      await StatusBar.show();
    } catch (error) {
      console.warn('Failed to show status bar:', error);
    }
  }, [isDespia]);

  useEffect(() => {
    if (!isDespia) return;

    const applyOptions = async () => {
      if (options?.hidden) {
        await hide();
      } else {
        await show();
      }

      if (options?.style) {
        await setStyle(options.style);
      }

      if (options?.backgroundColor) {
        await setBackgroundColor(options.backgroundColor);
      }
    };

    applyOptions();
  }, [isDespia, options?.style, options?.backgroundColor, options?.hidden, hide, show, setStyle, setBackgroundColor]);

  return { setStyle, setBackgroundColor, hide, show };
}
