import { MentionableStaff } from '@/hooks/useStaffMentions';

export interface ParsedMention {
  userId: string;
  username: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extract @mentions from text content
 * Matches the format used by MentionInput component: @[username](userId)
 */
export function extractMentions(text: string, staffList: MentionableStaff[]): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  
  // Match @[display name](user_id) format from MentionInput
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      userId: match[2],
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  
  // Also match simple @username format (fallback)
  const simpleRegex = /@(\w+)/g;
  while ((match = simpleRegex.exec(text)) !== null) {
    const username = match[1];
    // Check if this is already captured by the formatted regex
    const alreadyCaptured = mentions.some(
      m => m.startIndex <= match!.index && m.endIndex > match!.index
    );
    
    if (!alreadyCaptured) {
      // Try to find the user in staffList
      const staff = staffList.find(
        s => s.full_name.toLowerCase() === username.toLowerCase() ||
             (s.username && s.username.toLowerCase() === username.toLowerCase())
      );
      
      if (staff) {
        mentions.push({
          userId: staff.user_id,
          username: staff.full_name,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }
  }
  
  return mentions;
}

/**
 * Get unique user IDs from mentions
 */
export function getUniqueMentionedUserIds(mentions: ParsedMention[]): string[] {
  return [...new Set(mentions.map(m => m.userId))];
}

/**
 * Strip mention formatting for display
 * Converts @[username](userId) to @username
 */
export function stripMentionFormatting(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

/**
 * Get a preview of the content (first 100 chars)
 */
export function getContentPreview(text: string): string {
  const stripped = stripMentionFormatting(text);
  if (stripped.length <= 100) return stripped;
  return stripped.substring(0, 97) + '...';
}
