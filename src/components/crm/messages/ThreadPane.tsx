import { Composer } from './Composer';
import { MessageStream } from './MessageStream';
import { ThreadHeader } from './ThreadHeader';
import type { ConversationVM, MessageVM, SendLanguage } from './types';

interface ThreadPaneProps {
  conversation: ConversationVM;
  messages: MessageVM[];
  messagesLoading: boolean;
  hasMore: boolean;
  autoTranslate: boolean;
  contextOpen: boolean;
  claiming: boolean;
  translatingId: string | null;
  isExpanded: (id: string, hasTranslation: boolean) => boolean;
  onLoadOlder: () => Promise<void>;
  onRetry: (messageId: string) => void;
  onToggleTranslation: (message: MessageVM, expanded: boolean) => void;
  onToggleAutoTranslate: () => void;
  onToggleContext: () => void;
  onClaim: () => void;
  onMarkDone: () => void;
  onLinkContact?: () => void;
  onSend: (text: string, options: { internal: boolean; language: SendLanguage }) => Promise<boolean>;
}

/** Centre pane: header, message stream, composer. */
export function ThreadPane({
  conversation,
  messages,
  messagesLoading,
  hasMore,
  autoTranslate,
  contextOpen,
  claiming,
  translatingId,
  isExpanded,
  onLoadOlder,
  onRetry,
  onToggleTranslation,
  onToggleAutoTranslate,
  onToggleContext,
  onClaim,
  onMarkDone,
  onLinkContact,
  onSend,
}: ThreadPaneProps) {
  return (
    <section className="flex min-h-0 min-w-[520px] flex-1 flex-col bg-background">
      <ThreadHeader
        conversation={conversation}
        autoTranslate={autoTranslate}
        contextOpen={contextOpen}
        claiming={claiming}
        onClaim={onClaim}
        onToggleAutoTranslate={onToggleAutoTranslate}
        onMarkDone={onMarkDone}
        onToggleContext={onToggleContext}
        onLinkContact={onLinkContact}
      />
      <MessageStream
        messages={messages}
        loading={messagesLoading}
        hasMore={hasMore}
        onLoadOlder={onLoadOlder}
        onRetry={onRetry}
        isExpanded={isExpanded}
        translatingId={translatingId}
        onToggleTranslation={onToggleTranslation}
      />
      <Composer onSend={onSend} />
    </section>
  );
}
