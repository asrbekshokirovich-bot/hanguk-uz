/**
 * View-model types for the CRM Messages shared-queue inbox.
 *
 * Nothing here is persisted directly — these are the shapes the UI renders.
 * The adapters in `useMessagesQueue` / `useStudentContext` map Supabase rows
 * (`message_threads`, `messages`, `profiles`, `applications`, `documents`,
 * `payments`) onto them. See `docs` note in each field for the source column.
 */

/** Queue segment. Mirrors the mockup's segmented control. */
export type QueueTab = 'unassigned' | 'mine' | 'all' | 'done';

/** Supported inbound channels. `app` = the Hanguk App in-app student chat. */
export type ChannelId = 'telegram' | 'instagram' | 'app';

/** Channel filter chip value — channels plus the "all" pseudo-value. */
export type ChannelFilter = ChannelId | 'all';

/** Language the operator composes in; the outbound text is translated on send. */
export type SendLanguage = 'UZ' | 'RU' | 'KO' | 'EN';

/** A cached translation, read from / written to `messages.metadata.translation`. */
export interface MessageTranslation {
  /** Translated body (always English in the current design). */
  text: string;
  /** Human-readable source language, e.g. "Uzbek". */
  sourceLang: string;
  /** Human-readable target language, e.g. "English". */
  targetLang: string;
}

/** One row in the queue pane. */
export interface ConversationVM {
  /** `message_threads.id` */
  threadId: string;
  /** `message_threads.source` narrowed to a known channel. */
  channel: ChannelId;
  /** `message_threads.sender_id` — the external chat id. */
  senderId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  /** "@handle" for social channels, product name for the app channel. */
  handle: string;
  /** `message_threads.student_id` → `profiles.user_id`, or null for cold leads. */
  studentId: string | null;
  /** Pipeline stage label, derived from `applications.status`. */
  stage: string;
  /** Last message body, one line. */
  preview: string;
  /** `message_threads.last_message_at` */
  lastAt: string;
  /**
   * Minutes the student has been waiting for a reply. 0 when the last message
   * was outbound — i.e. the operator has already answered.
   */
  waitingMinutes: number;
  /** True when the thread is assigned to the signed-in operator. */
  isMine: boolean;
  /** True when any operator owns it (used to split Unassigned from All). */
  isAssigned: boolean;
  /** `message_threads.status === 'archived'` */
  isDone: boolean;
  /** `message_threads.unread_count` */
  unreadCount: number;
}

/** One entry in the message stream. */
export interface MessageVM {
  id: string;
  /**
   * `in`    — inbound student message
   * `out`   — outbound operator reply
   * `note`  — internal note (`message_type = 'note'`), never sent
   * `event` — day divider / system line, rendered as a centred rule
   */
  kind: 'in' | 'out' | 'note' | 'event';
  text: string;
  /** ISO timestamp; `event` rows carry the day they introduce. */
  createdAt: string;
  /** Display name of the staff member, for `out` and `note`. */
  senderLabel: string | null;
  /** `messages.status` rendered as "Sent" / "Read". */
  deliveryStatus: string | null;
  /** Cached translation, or null when none has been produced yet. */
  translation: MessageTranslation | null;
  /** True when the body is not English and a translation is offerable. */
  translatable: boolean;
}

/** A `/slash` reply the operator can insert into the draft. */
export interface SavedReply {
  /** Mono key chip, e.g. "/docs". */
  key: string;
  /** i18n key for the human title. */
  titleKey: string;
  /** Body inserted into the draft. Real operator language (UZ), not English. */
  body: string;
}

/** Application-progress step in the context rail. */
export interface ProgressStepVM {
  label: string;
  note: string;
  state: 'done' | 'current' | 'todo';
}

/** Document checklist row in the context rail. */
export interface DocumentVM {
  label: string;
  state: 'received' | 'review' | 'missing';
}

/** Recent-activity entry in the context rail. */
export interface ActivityVM {
  id: string;
  text: string;
  at: string;
}

/** Everything the context rail renders for the selected conversation. */
export interface StudentContextVM {
  name: string;
  initials: string;
  phone: string | null;
  /** `profiles.payment_plan` */
  plan: string | null;
  /** `profiles.magic_code` */
  magicCode: string | null;
  steps: ProgressStepVM[];
  documents: DocumentVM[];
  payment: {
    paid: number;
    total: number;
    currency: string;
    /** ISO date of the next instalment, or null. */
    nextDue: string | null;
  } | null;
  activity: ActivityVM[];
}
