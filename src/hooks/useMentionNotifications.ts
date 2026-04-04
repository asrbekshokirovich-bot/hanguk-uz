import { supabase } from '@/integrations/supabase/client';
import { useMentionNotificationsContext } from '@/contexts/MentionNotificationsContext';
export type { Mention } from '@/contexts/MentionNotificationsContext';

export function useMentionNotifications() {
  return useMentionNotificationsContext();
}

// Helper function to create a mention record
export async function createMention(
  mentionedUserId: string,
  mentionedBy: string,
  contextType: 'task_comment' | 'message' | 'room_chat',
  contextId: string,
  contentPreview: string
): Promise<boolean> {
  // Don't create self-mentions
  if (mentionedUserId === mentionedBy) return true;

  const { error } = await supabase
    .from('mentions')
    .insert({
      mentioned_user_id: mentionedUserId,
      mentioned_by: mentionedBy,
      context_type: contextType,
      context_id: contextId,
      content_preview: contentPreview,
    });

  return !error;
}
