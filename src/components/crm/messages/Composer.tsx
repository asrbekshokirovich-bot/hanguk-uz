import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Mic, Paperclip, Square, StickyNote, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecorder, type VoiceRecording } from '@/hooks/useVoiceRecorder';
import { SavedRepliesPanel } from './SavedRepliesPanel';
import { SEND_LANGUAGES } from './languages';
import { SendLanguageChips } from './SendLanguageChips';
import type { SavedReply, SendLanguage } from './types';

interface ComposerProps {
  onSend: (
    text: string,
    options: {
      internal: boolean;
      language: SendLanguage;
      file?: File | null;
      durationSeconds?: number | null;
    },
  ) => Promise<boolean>;
}

/** mm:ss for the timer beside the stop button. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Telegram fetches an attachment from a URL and refuses documents over 20 MB
 * that way; Instagram's limit is higher. One cap, the lower one, so the
 * operator is told before the upload rather than by a relay failure after it.
 */
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/**
 * Reply composer.
 *
 * Enter sends, Shift+Enter inserts a newline, and typing "/" as the first
 * character opens the saved-replies panel — the shortcut operators reach for
 * dozens of times an hour.
 *
 * Internal-note mode paints the composer amber and switches the send path to a
 * note write, which is stored on the thread but never relayed to the channel.
 */
export function Composer({ onSend }: ComposerProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [noteMode, setNoteMode] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [language, setLanguage] = useState<SendLanguage>('UZ');
  // The send path has handled attachments for weeks — upload to chat-media,
  // relay through both channels, the two-message split Instagram needs because
  // its DMs have no captions. The only missing piece was this input.
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A finished recording waiting to be sent. It travels the same path as an
  // attachment — upload to chat-media, then relay — and carries its measured
  // length so the bubble's player has a bar to draw.
  const [voice, setVoice] = useState<VoiceRecording | null>(null);
  const recorder = useVoiceRecorder();

  // Revoking is deliberately explicit rather than tied to the `voice` state.
  // An effect keyed on it would fire between the optimistic clear and the
  // restore that a failed send performs, killing the URL of the very recording
  // it just handed back — the preview would go silent on the one path where
  // the operator most needs to hear it again.
  const voiceUrlRef = useRef<string | null>(null);

  /** Drop a staged recording and release its object URL. */
  const clearVoice = () => {
    if (voiceUrlRef.current) {
      URL.revokeObjectURL(voiceUrlRef.current);
      voiceUrlRef.current = null;
    }
    setVoice(null);
  };

  const stageVoice = (recording: VoiceRecording) => {
    voiceUrlRef.current = recording.url;
    setVoice(recording);
  };

  // Leaving the thread must not leak the blob of a recording never sent.
  useEffect(() => {
    return () => {
      if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current);
    };
  }, []);

  const beginRecording = async () => {
    setFileError(null);
    clearVoice();
    const ok = await recorder.start();
    if (!ok) {
      setFileError(
        recorder.error === 'unsupported'
          ? t('messages.composer.voiceUnsupported')
          : t('messages.composer.micDenied'),
      );
    }
  };

  const endRecording = async () => {
    const result = await recorder.stop();
    if (!result) {
      setFileError(t('messages.composer.voiceFailed'));
      return;
    }
    // Replaces any picked file: one attachment per message, and the operator
    // just chose which one by recording it.
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    stageVoice(result);
  };

  const pickFile = (chosen: File | null) => {
    if (chosen && chosen.size > MAX_ATTACHMENT_BYTES) {
      setFileError(t('messages.composer.fileTooLarge', { limit: '20 MB' }));
      setFile(null);
      return;
    }
    setFileError(null);
    clearVoice();
    setFile(chosen);
  };

  const submit = async () => {
    const text = draft.trim();
    // An attachment on its own is a complete message; requiring text would
    // make sending a photo mean typing something first.
    if (!text && !file && !voice) return;
    // Clear FIRST. Waiting for the insert, the channel relay and two refetches
    // before emptying the box made Enter feel like it had not registered; the
    // operator would sit staring at their own text for seconds. The draft is
    // put back only if the send actually failed.
    const wasNote = noteMode;
    const wasVoice = voice;
    const wasFile = wasVoice ? wasVoice.file : file;
    setDraft('');
    setNoteMode(false);
    setShowSnippets(false);
    setFile(null);
    setVoice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const ok = await onSend(text, {
      internal: wasNote,
      language,
      file: wasFile,
      durationSeconds: wasVoice?.durationSeconds ?? null,
    });
    if (ok) {
      // Only now is the local copy safe to release: the bubble in the thread
      // plays from storage, not from this URL.
      if (wasVoice) clearVoice();
      return;
    }
    // Put everything back exactly as it was, recording included: re-recording a
    // reply because the relay failed is the one thing nobody wants to do twice.
    setDraft(text);
    setNoteMode(wasNote);
    if (wasVoice) stageVoice(wasVoice);
    else setFile(wasFile);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
    if (e.key === 'Escape' && showSnippets) {
      e.preventDefault();
      setShowSnippets(false);
    }
  };

  const pickReply = (reply: SavedReply) => {
    setDraft(reply.body);
    setShowSnippets(false);
    textareaRef.current?.focus();
  };

  const languageName = t(SEND_LANGUAGES.find((l) => l.code === language)?.nameKey ?? 'messages.languages.uz');

  return (
    <div className="shrink-0 border-t border-border bg-card px-6 pb-4 pt-3">
      {showSnippets && <SavedRepliesPanel onPick={pickReply} />}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card focus-within:ring-2 focus-within:ring-ring">
        {noteMode && (
          <p className="bg-warning/10 px-3.5 py-1.5 text-[11px] font-semibold text-warning">
            {t('messages.composer.noteBanner')}
          </p>
        )}

        {file && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{file.name}</span>
            <button
              type="button"
              onClick={() => pickFile(null)}
              title={t('messages.composer.removeAttachment')}
              className="flex h-6 w-6 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('messages.composer.removeAttachment')}</span>
            </button>
          </div>
        )}

        {recorder.isRecording && (
          <div className="flex items-center gap-2.5 border-b border-border bg-destructive/10 px-3.5 py-2">
            <span
              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive"
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-destructive">
              {t('messages.composer.recording')}
            </span>
            <span className="font-mono text-xs tabular-nums text-destructive/80">
              {clock(recorder.elapsedSeconds)}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  recorder.cancel();
                  setFileError(null);
                }}
                className="flex h-7 min-h-0 items-center rounded-sm px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('messages.composer.cancelRecording')}
              </button>
              <button
                type="button"
                onClick={() => void endRecording()}
                className="flex h-7 min-h-0 items-center gap-1.5 rounded-sm bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                {t('messages.composer.stopRecording')}
              </button>
            </div>
          </div>
        )}

        {voice && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2">
            <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <audio controls preload="metadata" src={voice.url} className="h-8 max-w-[260px]" />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {clock(voice.durationSeconds)}
            </span>
            <button
              type="button"
              onClick={() => clearVoice()}
              title={t('messages.composer.removeVoice')}
              className="ml-auto flex h-6 w-6 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('messages.composer.removeVoice')}</span>
            </button>
          </div>
        )}

        {fileError && (
          <p className="bg-destructive/10 px-3.5 py-1.5 text-[11px] font-semibold text-destructive">
            {fileError}
          </p>
        )}

        <textarea
          ref={textareaRef}
          rows={3}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            setDraft(value);
            if (value.trim() === '/') setShowSnippets(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('messages.composer.placeholder')}
          aria-label={t('messages.composer.label')}
          className="w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm leading-[1.55] text-foreground outline-none placeholder:text-muted-foreground"
        />

        <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 pt-2">
          <button
            type="button"
            onClick={() => setShowSnippets((v) => !v)}
            aria-expanded={showSnippets}
            className="flex h-8 min-h-0 items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 text-xs font-semibold text-foreground/75 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            {t('messages.composer.savedReplies')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={noteMode}
            title={t('messages.composer.attach')}
            className="flex h-8 min-h-0 items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 text-xs font-semibold text-foreground/75 transition-colors hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('messages.composer.attach')}</span>
          </button>

          {/* An internal note is never relayed, so recording one would send the
              audio nowhere. Hidden outright where the browser cannot encode
              Opus, rather than offered and then failing on the click. */}
          {recorder.supported && !noteMode && (
            <button
              type="button"
              onClick={() => void beginRecording()}
              disabled={recorder.isRecording}
              title={t('messages.composer.recordVoice')}
              className="flex h-8 min-h-0 items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 text-xs font-semibold text-foreground/75 transition-colors hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('messages.composer.recordVoice')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setNoteMode((v) => !v)}
            aria-pressed={noteMode}
            className={cn(
              'flex h-8 min-h-0 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              noteMode
                ? 'border-warning bg-warning/10 text-warning'
                : 'border-border bg-card text-foreground/75 hover:bg-muted',
            )}
          >
            <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
            {t('messages.composer.internalNote')}
          </button>

          {!noteMode && <SendLanguageChips value={language} onChange={setLanguage} />}

          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-[11.5px] text-muted-foreground">
              {noteMode
                ? t('messages.composer.hintNote')
                : t('messages.composer.hintSend', { language: languageName })}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={(!draft.trim() && !file && !voice) || recorder.isRecording}
              className="flex h-10 min-h-0 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {noteMode ? t('messages.composer.saveNote') : t('messages.composer.send')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
