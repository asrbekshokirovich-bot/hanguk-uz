import { useEffect, useCallback, useState } from 'react';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { usePlatform } from './usePlatform';
import { supabase } from '@/integrations/supabase/client';

interface PushNotificationState {
  token: string | null;
  permissionGranted: boolean;
  isLoading: boolean;
}

export function useNativePushNotifications() {
  const { isDespia, platform } = usePlatform();
  const [state, setState] = useState<PushNotificationState>({
    token: null,
    permissionGranted: false,
    isLoading: false
  });

  const registerToken = useCallback(async (token: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const platformType = platform.includes('ios') ? 'ios' : 'android';

      // Upsert token to push_tokens table
      await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          token,
          platform: platformType,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform'
        });

      console.log('Push token registered successfully');
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }, [platform]);

  const requestPermission = useCallback(async () => {
    if (!isDespia) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const permResult = await PushNotifications.checkPermissions();
      
      if (permResult.receive === 'prompt') {
        const requestResult = await PushNotifications.requestPermissions();
        if (requestResult.receive !== 'granted') {
          setState(prev => ({ ...prev, isLoading: false, permissionGranted: false }));
          return false;
        }
      } else if (permResult.receive !== 'granted') {
        setState(prev => ({ ...prev, isLoading: false, permissionGranted: false }));
        return false;
      }

      await PushNotifications.register();
      setState(prev => ({ ...prev, permissionGranted: true }));
      return true;
    } catch (error) {
      console.error('Failed to request push notification permission:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [isDespia]);

  useEffect(() => {
    if (!isDespia) return;

    let registrationListener: { remove: () => void } | null = null;
    let registrationErrorListener: { remove: () => void } | null = null;
    let pushReceivedListener: { remove: () => void } | null = null;
    let pushActionListener: { remove: () => void } | null = null;

    const setupListeners = async () => {
      try {
        registrationListener = await PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success:', token.value);
          setState(prev => ({ ...prev, token: token.value, isLoading: false }));
          registerToken(token.value);
        });

        registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
          setState(prev => ({ ...prev, isLoading: false }));
        });

        pushReceivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push notification received:', notification);
        });

        pushActionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          console.log('Push notification action performed:', action);
          // Handle deep linking based on notification data
          const data = action.notification.data;
          if (data?.route) {
            window.location.href = data.route;
          }
        });

        // Auto-request permission on mount
        await requestPermission();
      } catch (error) {
        console.warn('Failed to setup push notification listeners:', error);
      }
    };

    setupListeners();

    return () => {
      registrationListener?.remove();
      registrationErrorListener?.remove();
      pushReceivedListener?.remove();
      pushActionListener?.remove();
    };
  }, [isDespia, registerToken, requestPermission]);

  return {
    ...state,
    requestPermission
  };
}
