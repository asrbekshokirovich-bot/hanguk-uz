import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMessages } from '@/hooks/useMessages';
import { useLeads, type CreateLeadData } from '@/hooks/useLeads';
import { ThreadList } from '@/components/messages/ThreadList';
import { ChatView } from '@/components/messages/ChatView';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Mail
} from 'lucide-react';

const LEAD_SOURCES = new Set<CreateLeadData['source']>(['manual', 'telegram', 'instagram', 'call', 'ai_detected']);

export default function MessagesContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { leads, createLead } = useLeads();
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

  const [converting, setConverting] = useState(false);

  // A thread is "already a client" when a lead exists for the same channel +
  // sender id. We reuse the leads.source / source_id linkage (no extra schema).
  const linkedLead = useMemo(() => {
    if (!selectedThread) return null;
    return leads.find(
      (l) => l.source === selectedThread.source && l.source_id === selectedThread.sender_id,
    ) ?? null;
  }, [leads, selectedThread]);

  const handleSendMessage = async (content: string) => {
    if (!selectedThread) return;
    const { error } = await sendMessage(content, selectedThread.source, selectedThread.sender_id);
    if (error) {
      toast({
        title: t('common.error'),
        description: 'Could not send the message. Check that the Instagram/Telegram integration is configured.',
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

  const handleConvertToLead = async () => {
    if (!selectedThread || linkedLead || converting) return;
    setConverting(true);
    try {
      const source = (LEAD_SOURCES.has(selectedThread.source as CreateLeadData['source'])
        ? selectedThread.source
        : 'manual') as CreateLeadData['source'];
      await createLead({
        full_name: selectedThread.sender_name || `Instagram user ${selectedThread.sender_id.slice(-6)}`,
        source,
        source_id: selectedThread.sender_id,
        status: 'new',
        notes: `Created from ${selectedThread.source} conversation`,
      });
      // createLead surfaces its own success toast and refreshes the leads list,
      // which flips this thread to the "linked" state.
    } catch {
      toast({
        title: t('common.error'),
        description: 'Could not create the lead.',
        variant: 'destructive',
      });
    } finally {
      setConverting(false);
    }
  };

  const handleViewLead = () => {
    navigate('/crm/leads');
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
                <div className="p-1.5 bg-destructive/10 rounded">
                  <Mail className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.unread}</p>
                  <p className="text-[10px] text-muted-foreground">{t('messages.unread')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="p-1.5 bg-info/10 rounded">
                  <MessageSquare className="h-4 w-4 text-info" />
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
              hasLead={!!linkedLead}
              converting={converting}
              onConvertToLead={handleConvertToLead}
              onViewLead={handleViewLead}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>{t('common.select')} a conversation</p>
                <p className="text-sm mt-2">Connect Instagram or Telegram in Settings → Integrations</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
