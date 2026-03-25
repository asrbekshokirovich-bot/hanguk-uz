import { useState } from 'react';
import { Bell, Check, CheckCheck, MessageSquare, ListTodo, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMentionNotifications, Mention } from '@/hooks/useMentionNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const contextTypeIcons: Record<string, React.ReactNode> = {
  task_comment: <ListTodo className="h-3 w-3" />,
  message: <MessageSquare className="h-3 w-3" />,
  room_chat: <Users className="h-3 w-3" />,
};

const contextTypeLabels: Record<string, string> = {
  task_comment: 'Task',
  message: 'Message',
  room_chat: 'Room',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { mentions, loading, unreadCount, markAsRead, markAllAsRead } = useMentionNotifications();

  const handleMentionClick = async (mention: Mention) => {
    await markAsRead(mention.id);
    setOpen(false);
    
    // Navigate based on context type
    switch (mention.context_type) {
      case 'task_comment':
        navigate(`/crm?page=tasks&task=${mention.context_id}`);
        break;
      case 'message':
        navigate(`/crm?page=messages&thread=${mention.context_id}`);
        break;
      case 'room_chat':
        // Room chat navigation would depend on how rooms are structured
        navigate(`/crm?page=communication`);
        break;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : mentions.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {mentions.map((mention) => (
                <button
                  key={mention.id}
                  onClick={() => handleMentionClick(mention)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted/50 transition-colors flex gap-3",
                    !mention.read_at && "bg-primary/5"
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={mention.mentioner?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {mention.mentioner?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium truncate">
                        {mention.mentioner?.full_name || 'Someone'}
                      </span>
                      <span className="text-muted-foreground">mentioned you</span>
                    </div>
                    
                    {mention.content_preview && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {mention.content_preview}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {contextTypeIcons[mention.context_type]}
                        {contextTypeLabels[mention.context_type] || mention.context_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(mention.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  
                  {!mention.read_at && (
                    <div className="flex-shrink-0 self-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
