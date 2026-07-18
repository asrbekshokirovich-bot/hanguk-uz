import { Button } from '@/components/ui/button';

// Hanguk AI can ask a multiple-choice clarifying question instead of guessing
// on an ambiguous request. It does that by emitting a small JSON envelope as its
// whole reply:  {"type":"clarify","question":"…","options":["…","…"]}
// We detect that envelope here and render the options as clickable chips; picking
// one sends it back as the next message so the AI can answer accordingly.

type Clarify = { question: string; options: string[] };

export function parseClarify(raw: string): Clarify | null {
  let s = (raw || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith('{')) return null;
  try {
    const o = JSON.parse(s);
    if (o && o.type === 'clarify' && Array.isArray(o.options) && o.options.length) {
      return {
        question: String(o.question || ''),
        options: o.options.map((x: unknown) => String(x)).filter(Boolean).slice(0, 6),
      };
    }
  } catch {
    /* partial stream or not a clarify block */
  }
  return null;
}

interface Props {
  content: string;
  /** Send the chosen option back as the next user message. */
  onPick?: (value: string) => void;
  /** Only the latest message's options stay clickable. */
  interactive?: boolean;
}

export function AIMessageContent({ content, onPick, interactive = true }: Props) {
  const clarify = parseClarify(content);

  if (clarify) {
    return (
      <div className="space-y-3">
        {clarify.question && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{clarify.question}</p>
        )}
        <div className="flex flex-col gap-2">
          {clarify.options.map((opt, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="justify-start h-auto py-2 whitespace-normal text-left"
              disabled={!interactive || !onPick}
              onClick={() => onPick?.(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Hide a clarify envelope that's still streaming in, so raw JSON never flashes.
  const s = content.trimStart();
  if (s.startsWith('{') || /^```(?:json)?/i.test(s)) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>;
}
