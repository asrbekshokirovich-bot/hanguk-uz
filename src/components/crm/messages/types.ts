import type { MessageMedia } from './media';

/**
 * View-model types for the CRM Messages shared-queue inbox.
 *
 * Nothing here is persisted directly — these are the shapes the UI renders.
 * The adapters in `useMessagesQueue` / `useStudentContext` map Supabase rows
 * (`message_threads`, `messages`, `profiles`, `applications`, `documents`,
 * `payments`) onto them. See `docs` note in each field for the source column.
 */

/**
 * Queue segment.
 *
 * `waiting` — the person wrote and no PERSON on our side has answered since
 * (an automatic reply does not count). Newest first. This is the operator's
 * work list and the default tab since the 2026-10-29 audit; the old
 * "Unassigned" tab put a 141-day-old conversation on top because nobody who
 * answers from the phone ever pressed Claim.
 */
export type QueueTab = 'waiting' | 'mine' | 'all' | 'done';

/** Supported inbound channels. `app` = the Hanguk App in-app student chat. */
export type ChannelId = 'telegram' | 'instagram' | 'app';

/**
 * Channel filter chip value — channels plus the "all" pseudo-value and
 * `internal`, which shows the conversations that are not leads at all
 * (our own staff, partner universities, Telegram's service account).
 */
export type ChannelFilter = ChannelId | 'all' | 'internal';

/** What a conversation is; only `lead` threads are in the operator queue. */
export type ThreadKind = 'lead' | 'staff' | 'partner' | 'service';

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
  /** "@username" when the person has one; empty otherwise (never a numeric id). */
  handle: string;
  /** `message_threads.student_id` → `profiles.user_id`, or null for cold leads. */
  studentId: string | null;
  /** The lead behind this conversation, when one exists. */
  leadId: string | null;
  /** `message_threads.kind` */
  kind: ThreadKind;
  /** Pipeline stage label, derived from `applications.status`. */
  stage: string;
  /** Last message body, one line. */
  preview: string;
  /** `message_threads.last_message_at` */
  lastAt: string;
  /**
   * True while the person's latest message has not been answered by a
   * PERSON on our side. Automatic replies (bot, after-hours text, Meta's
   * instant reply) and internal notes do not end the wait.
   */
  isWaiting: boolean;
  /** ISO time of the message the person is waiting on; null when answered. */
  waitingSince: string | null;
  /**
   * Minutes the person has been waiting for a reply. 0 when answered.
   * Floored, so a message that arrived seconds ago reads 0 while
   * `isWaiting` is already true.
   */
  waitingMinutes: number;
  /** Nothing has happened in this conversation for STALE_AFTER_DAYS. */
  isStale: boolean;
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
  /**
   * Delivery lifecycle for `out` bubbles: 'sending' | 'sent' | 'failed'
   * (`messages.delivery_status`). Rendered as clock / tick / red retry.
   */
  deliveryStatus: string | null;
  /** Why delivery failed (`messages.delivery_error`), shown under the bubble. */
  deliveryError?: string | null;
  /** Cached translation, or null when none has been produced yet. */
  translation: MessageTranslation | null;
  /** True when the body is not English and a translation is offerable. */
  translatable: boolean;
  /** Voice note / image / file attachment, or null for a plain text message. */
  media: MessageMedia | null;
  /** True while the server has not yet confirmed delivery. */
  pending?: boolean;
  /** Changed after it was sent; `originalText` is the first version. */
  edited?: boolean;
  originalText?: string | null;
  /** Taken back by the person on Instagram; the text stays for the record. */
  deleted?: boolean;
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
