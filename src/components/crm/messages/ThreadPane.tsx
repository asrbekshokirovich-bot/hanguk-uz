import { Composer } from './Composer';
import { MessageStream } from './MessageStream';
import { ThreadHeader } from './ThreadHeader';
import type { ConversationVM, MessageVM, SendLanguage } from './types';

interface ThreadPaneProps {
  conversation: ConversationVM;
  messages: MessageVM[];
  autoTranslate: boolean;
  contextOpen: boolean;
  claiming: boolean;
  sending: boolean;
  translatingId: string | null;
  isExpanded: (id: string, hasTranslation: boolean) => boolean;
  onToggleTranslation: (message: MessageVM, expanded: boolean) => void;
  onToggleAutoTranslate: () => void;
  onToggleContext: () => void;
  onClaim: () => void;
  onMarkDone: () => void;
  onSend: (text: string, options: { internal: boolean; language: SendLanguage }) => Promise<void> | void;
}

/** Centre pane: header, message stream, composer. */
export function ThreadPane({
  conversation,
  messages,
  autoTranslate,
  contextOpen,
  claiming,
  sending,
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
        isExpanded={isExpanded}
        translatingId={translatingId}
        onToggleTranslation={onToggleTranslation}
      />
      <Composer sending={sending} onSend={onSend} />
    </section>
  );
}
