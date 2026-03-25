import { useState, useRef, useEffect, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStaffMentions, MentionableStaff } from '@/hooks/useStaffMentions';
import { cn } from '@/lib/utils';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 2,
  className,
  disabled,
}: MentionInputProps) {
  const { staffList, searchStaff } = useStaffMentions();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredStaff = searchStaff(mentionQuery);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space between @ and cursor (means mention was completed or cancelled)
      const hasSpaceAfterAt = textAfterAt.includes(' ');
      
      if (!hasSpaceAfterAt && (lastAtIndex === 0 || /\s/.test(newValue[lastAtIndex - 1]))) {
        setShowDropdown(true);
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        setSelectedIndex(0);
      } else {
        setShowDropdown(false);
        setMentionQuery('');
        setMentionStart(null);
      }
    } else {
      setShowDropdown(false);
      setMentionQuery('');
      setMentionStart(null);
    }
  };

  const insertMention = useCallback((staff: MentionableStaff) => {
    if (mentionStart === null) return;

    const beforeMention = value.slice(0, mentionStart);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);
    
    const mentionText = `@${staff.username || staff.full_name.replace(/\s+/g, '_')} `;
    const newValue = beforeMention + mentionText + afterMention;
    
    onChange(newValue);
    setShowDropdown(false);
    setMentionQuery('');
    setMentionStart(null);

    // Focus and set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [value, mentionStart, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredStaff.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredStaff.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredStaff.length) % filteredStaff.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredStaff[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    // Pass through other key events
    onKeyDown?.(e);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn("resize-none", className)}
        disabled={disabled}
      />
      
      {showDropdown && filteredStaff.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50"
        >
          <ScrollArea className="max-h-48">
            <div className="p-1">
              {filteredStaff.map((staff, index) => (
                <button
                  key={staff.user_id}
                  type="button"
                  onClick={() => insertMention(staff)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left",
                    "hover:bg-accent hover:text-accent-foreground",
                    selectedIndex === index && "bg-accent text-accent-foreground"
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={staff.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(staff.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{staff.full_name}</p>
                    {staff.username && (
                      <p className="text-xs text-muted-foreground truncate">
                        @{staff.username}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {showDropdown && filteredStaff.length === 0 && mentionQuery && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50 p-3"
        >
          <p className="text-sm text-muted-foreground text-center">
            No staff found
          </p>
        </div>
      )}
    </div>
  );
}
