import { Composer } from './Composer';
import { MessageStream } from './MessageStream';
import { ThreadHeader } from './ThreadHeader';
import type { ConversationVM, MessageVM, SendLanguage } from './types';

interface ThreadPaneProps {
  conversation: ConversationVM;
  messages: MessageVM[];
  messagesLoading: boolean;
  autoTranslate: boolean;
  contextOpen: boolean;
  claiming: boolean;
  translatingId: string | null;
  isExpanded: (id: string, hasTranslation: boolean) => boolean;
  onToggleTranslation: (message: MessageVM, expanded: boolean) => void;
  onToggleAutoTranslate: () => void;
  onToggleContext: () => void;
  onClaim: () => void;
  onMarkDone: () => void;
  onSend: (text: string, options: { internal: boolean; language: SendLanguage }) => Promise<boolean>;
}

/** Centre pane: header, message stream, composer. */
export function ThreadPane({
  conversation,
  messages,
  messagesLoading,
  autoTranslate,
  contextOpen,
  claiming,
  translatingId,
  isExpanded,
  onToggleTranslation,
  onToggleAutoTranslate,
  onToggleContext,
  onClaim,
  onMarkDone,
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
      />
      <MessageStream
        messages={messages}
        loading={messagesLoading}
        isExpanded={isExpanded}
        translatingId={translatingId}
        onToggleTranslation={onToggleTranslation}
      />
      <Composer onSend={onSend} />
    </section>
  );
}
