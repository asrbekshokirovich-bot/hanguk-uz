import { useTranslation } from 'react-i18next';
import { useMessages } from '@/hooks/useMessages';
import { ThreadList } from '@/components/messages/ThreadList';
import { ChatView } from '@/components/messages/ChatView';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Mail
} from 'lucide-react';

export default function MessagesContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    threads,
    messages,
    selectedThread,
    loading,
    stats,
    setSelectedThread,
    sendMessage,
    archiveThread
  } = useMessages();

  const handleSendMessage = async (content: string) => {
    if (!selectedThread) return;
    const { error } = await sendMessage(content, selectedThread.source, selectedThread.sender_id);
    if (error) {
      toast({
        title: t('common.error'),
        description: 'Message sending is not yet configured. Set up Telegram/Instagram integration.',
        variant: 'destructive',
      });
    }
  };

  const handleArchive = async () => {
    if (!selectedThread) return;
    await archiveThread(selectedThread.id);
    setSelectedThread(null);
    toast({
      title: t('common.success'),
      description: 'Conversation archived',
    });
  };

  return (
    <div className="h-[calc(100dvh-8rem)] flex flex-col">
      <div className="flex-1 flex overflow-hidden rounded-lg border">
        {/* Stats & Thread List - Hidden on mobile when chat is open */}
        <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col bg-card ${selectedThread ? 'hidden md:flex' : 'flex'}`}>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2 p-3 border-b">
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded">
                  <Mail className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.unread}</p>
                  <p className="text-[10px] text-muted-foreground">{t('messages.unread')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">{t('common.all')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-hidden">
            <ThreadList
              threads={threads}
              selectedThread={selectedThread}
              loading={loading}
              onSelectThread={setSelectedThread}
            />
          </div>
        </div>

        {/* Chat View */}
        <div className={`flex-1 flex flex-col bg-card ${!selectedThread ? 'hidden md:flex' : 'flex'}`}>
          {selectedThread ? (
            <ChatView
              thread={selectedThread}
              messages={messages}
              onSendMessage={handleSendMessage}
              onArchive={handleArchive}
              onBack={() => setSelectedThread(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>{t('common.select')} a conversation</p>
                <p className="text-sm mt-2">or set up Telegram/Instagram integration</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
