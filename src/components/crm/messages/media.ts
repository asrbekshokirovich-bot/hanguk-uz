/**
 * Attachment extraction for the message stream.
 *
 * The two ingest paths store media differently and both have to render:
 *
 * - Telegram (`telegram-ingest`, `telegram-webhook`) downloads the bytes into
 *   the private `chat-media` bucket and records `metadata.media_path` plus
 *   `media_mime` / `media_duration` / `media_size`.
 * - Instagram (`instagram-webhook`) does NOT download anything; it keeps the
 *   raw `metadata.attachments` array, where each entry carries a remote
 *   `payload.url` served by Meta's CDN.
 *
 * `messages.message_type` is the discriminator both paths agree on:
 * `text` | `image` | `voice` | `file`.
 */

export type MediaKind = 'image' | 'voice' | 'file';

export interface MessageMedia {
  kind: MediaKind;
  /** Path inside the private `chat-media` bucket (Telegram). */
  storagePath: string | null;
  /** Direct remote URL (Instagram CDN). */
  remoteUrl: string | null;
  mime: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  filename: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Pulls the first usable attachment URL out of an Instagram payload. */
function remoteUrlFrom(metadata: Record<string, unknown>): string | null {
  const attachments = metadata.attachments;
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const first = asRecord(attachments[0]);
  if (!first) return null;
  const payload = asRecord(first.payload);
  return str(payload?.url) ?? str(first.url);
}

export function extractMedia(messageType: string, metadata: unknown): MessageMedia | null {
  const kind: MediaKind | null =
    messageType === 'voice' || messageType === 'image' || messageType === 'file'
      ? messageType
      : null;
  if (!kind) return null;

  const meta = asRecord(metadata) ?? {};
  return {
    kind,
    storagePath: str(meta.media_path),
    remoteUrl: remoteUrlFrom(meta),
    mime: str(meta.media_mime),
    durationSeconds: num(meta.media_duration),
    sizeBytes: num(meta.media_size),
    filename: str(meta.media_filename),
  };
}

/**
 * True when `content` is only the placeholder the ingest functions write for a
 * media message that carried no caption — "🎤 Voice message", "[document]",
 * "📷 [Image]", "[Empty message]". Rendering those as body text under a real
 * player is noise, so the bubble drops them.
 */
export function isMediaPlaceholder(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;
  // Strip leading emoji / punctuation so "📷 [Image]" reduces to "[Image]".
  const stripped = trimmed.replace(/^[^\p{L}\p{N}[]+/u, '').trim();
  if (/^\[[^\]]+\]$/.test(stripped)) return true;
  return /^(voice message|empty)$/i.test(stripped);
}

/** "1.4 MB" / "812 KB" — nothing smaller is worth showing. */
export function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** i18n key for the one-line label a media message shows in the queue preview. */
export function mediaPreviewKey(messageType: string): string | null {
  switch (messageType) {
    case 'voice':
      return 'messages.media.voice';
    case 'image':
      return 'messages.media.image';
    case 'file':
      return 'messages.media.file';
    default:
      return null;
  }
}
