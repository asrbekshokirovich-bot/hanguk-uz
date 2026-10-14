import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';

// Internal notes go straight into `messages` from MessagesContent.handleSend.
// The note branch used to read `text`, which is declared further down the same
// function with `let` — a temporal-dead-zone ReferenceError, so no note was
// ever saved. These mocks reduce the page to that one callback.

const thread = {
  id: 'th-1',
  source: 'telegram',
  sender_id: 'tg-1',
  student_id: 'stu-1',
};
const conversation = {
  threadId: 'th-1',
  channel: 'telegram',
  senderId: 'tg-1',
  name: 'A',
  initials: 'A',
  avatarUrl: null,
  handle: '@a',
  studentId: 'stu-1',
  stage: '',
  preview: '',
  lastAt: '2026-01-01T00:00:00Z',
  waitingMinutes: 0,
  isMine: false,
  isAssigned: false,
  isDone: false,
};

const inserted: Record<string, unknown>[] = [];
const appendLocalMessage = vi.fn();
const sendMessage = vi.fn();
const translateTexts = vi.fn(async (texts: string[]) => texts.map((x) => `translated:${x}`));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({ single: async () => ({ data: { id: 'm-1', ...row }, error: null }) }),
        };
      },
    }),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'uz' } }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'op-1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useMessages', () => ({
  useMessages: () => ({
    threads: [thread],
    messages: [],
    selectedThread: thread,
    setSelectedThread: vi.fn(),
    sendMessage,
    retryMessage: vi.fn(),
    appendLocalMessage,
    archiveThread: vi.fn(),
    assignThread: vi.fn(),
    hasMoreMessages: false,
    loadOlderMessages: vi.fn(),
  }),
}));
vi.mock('@/components/crm/messages/useMessagesQueue', () => ({
  useMessagesQueue: () => ({ conversations: [conversation], loading: false, refreshAssignments: vi.fn() }),
}));
vi.mock('@/components/crm/messages/useThreadMessages', () => ({ useThreadMessages: () => [] }));
vi.mock('@/components/crm/messages/useThreadTranslation', () => ({
  useThreadTranslation: () => ({ autoTranslate: false, toggleAuto: vi.fn(), isExpanded: () => false, toggleMessage: vi.fn() }),
}));
vi.mock('@/components/crm/messages/useStudentContext', () => ({
  useStudentContext: () => ({ student: null, loading: false }),
}));
vi.mock('@/components/crm/messages/translateMessage', () => ({
  translateMessage: vi.fn(),
  translateTexts: (texts: string[], lang: string) => translateTexts(texts, lang),
}));
vi.mock('@/components/crm/messages/MessagesQueue', () => ({ MessagesQueue: () => null }));
vi.mock('@/components/crm/messages/QueueClearState', () => ({ QueueClearState: () => null }));
vi.mock('@/components/crm/messages/StudentContextRail', () => ({ StudentContextRail: () => null }));
vi.mock('@/components/calls/LinkContactDialog', () => ({ LinkContactDialog: () => null }));

type OnSend = (text: string, o: { internal: boolean; language: string }) => Promise<boolean>;
let onSend: OnSend | null = null;
vi.mock('@/components/crm/messages/ThreadPane', () => ({
  ThreadPane: (props: { onSend: OnSend }) => {
    onSend = props.onSend;
    return null;
  },
}));

import MessagesContent from '../MessagesContent';

describe('MessagesContent internal note', () => {
  it('saves the note exactly as typed, untranslated, without relaying it', async () => {
    render(<MessagesContent />);
    expect(onSend).not.toBeNull();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await onSend!('Ota-onasi qo‘ng‘iroq qildi', { internal: true, language: 'KO' });
    });

    expect(ok).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      content: 'Ota-onasi qo‘ng‘iroq qildi',
      message_type: 'note',
      student_id: 'stu-1',
    });
    expect(translateTexts).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(appendLocalMessage).toHaveBeenCalledTimes(1);
  });
});
