import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { MessageThread } from '@/hooks/useMessages';

interface ThreadListProps {
  threads: MessageThread[];
  selectedThread: MessageThread | null;
  loading: boolean;
  onSelectThread: (thread: MessageThread) => void;
}

const sourceIcons: Record<string, string> = {
  telegram: '✈️',
  instagram: '📷',
  whatsapp: '💬',
  manual: '✉️',
};

const sourceColors: Record<string, string> = {
  telegram: 'bg-blue-500',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  whatsapp: 'bg-green-500',
  manual: 'bg-gray-500',
};

export function ThreadList({ threads, selectedThread, loading, onSelectThread }: ThreadListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const filteredThreads = threads.filter(thread => {
    const matchesSearch = !searchQuery || 
      thread.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSource = !sourceFilter || thread.source === sourceFilter;
    
    return matchesSearch && matchesSource && thread.status === 'active';
  });

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t('common.search')}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Source Filters */}
        <div className="flex gap-1 mt-2">
          <Badge 
            variant={sourceFilter === null ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setSourceFilter(null)}
          >
            {t('common.all')}
          </Badge>
          {['telegram', 'instagram'].map((source) => (
            <Badge
              key={source}
              variant={sourceFilter === source ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSourceFilter(source)}
            >
              {sourceIcons[source]} {source}
            </Badge>
          ))}
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('common.none')} {t('messages.title').toLowerCase()}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedThread?.id === thread.id ? 'bg-muted' : ''
                }`}
                onClick={() => onSelectThread(thread)}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={thread.sender_avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(thread.sender_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${sourceColors[thread.source]}`}>
                      {sourceIcons[thread.source]}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {thread.sender_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(thread.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {thread.lastMessage?.direction === 'outgoing' && '↩ '}
                      {thread.lastMessage?.content || 'No messages'}
                    </p>
                  </div>

                  {thread.unread_count > 0 && (
                    <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center">
                      {thread.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
