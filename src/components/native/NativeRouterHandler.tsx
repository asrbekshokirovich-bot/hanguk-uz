import { useEffect } from 'react';
import { useBackButton } from '@/hooks/useBackButton';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';

/**
 * Component that handles native-specific functionality that requires Router context.
 * Must be rendered inside BrowserRouter.
 */
export function NativeRouterHandler() {
  // Initialize back button handling for Android (requires Router context)
  useBackButton();

  // Initialize push notifications
  useNativePushNotifications();

  return null;
}
