import { useEffect, useState, useCallback } from 'react';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { usePlatform } from './usePlatform';

interface KeyboardState {
  isVisible: boolean;
  keyboardHeight: number;
}

export function useKeyboard() {
  const { isDespia } = usePlatform();
  const [state, setState] = useState<KeyboardState>({
    isVisible: false,
    keyboardHeight: 0
  });

  const hide = useCallback(async () => {
    if (!isDespia) return;

    try {
      await Keyboard.hide();
    } catch (error) {
      console.warn('Failed to hide keyboard:', error);
    }
  }, [isDespia]);

  useEffect(() => {
    if (!isDespia) return;

    let showListener: { remove: () => void } | null = null;
    let hideListener: { remove: () => void } | null = null;

    const setupListeners = async () => {
      try {
        showListener = await Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
          setState({
            isVisible: true,
            keyboardHeight: info.keyboardHeight
          });
        });

        hideListener = await Keyboard.addListener('keyboardWillHide', () => {
          setState({
            isVisible: false,
            keyboardHeight: 0
          });
        });
      } catch (error) {
        console.warn('Failed to add keyboard listeners:', error);
      }
    };

    setupListeners();

    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, [isDespia]);

  return { ...state, hide };
}
