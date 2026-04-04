import { useMessagesContext } from '@/contexts/MessagesContext';

export type { Message, MessageThread } from '@/contexts/MessagesContext';

export function useMessages() {
  return useMessagesContext();
}
