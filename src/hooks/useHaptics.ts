import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { usePlatform } from './usePlatform';

export function useHaptics() {
  const { isDespia } = usePlatform();

  const impact = useCallback(async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!isDespia) return;

    try {
      const impactStyle = style === 'light' ? ImpactStyle.Light :
                          style === 'heavy' ? ImpactStyle.Heavy :
                          ImpactStyle.Medium;
      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.warn('Failed to trigger haptic impact:', error);
    }
  }, [isDespia]);

  const notification = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!isDespia) return;

    try {
      const notificationType = type === 'success' ? NotificationType.Success :
                               type === 'warning' ? NotificationType.Warning :
                               NotificationType.Error;
      await Haptics.notification({ type: notificationType });
    } catch (error) {
      console.warn('Failed to trigger haptic notification:', error);
    }
  }, [isDespia]);

  const selection = useCallback(async () => {
    if (!isDespia) return;

    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch (error) {
      console.warn('Failed to trigger haptic selection:', error);
    }
  }, [isDespia]);

  const vibrate = useCallback(async (duration: number = 300) => {
    if (!isDespia) return;

    try {
      await Haptics.vibrate({ duration });
    } catch (error) {
      console.warn('Failed to vibrate:', error);
    }
  }, [isDespia]);

  return { impact, notification, selection, vibrate };
}
