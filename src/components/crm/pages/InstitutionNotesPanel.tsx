import { useState } from 'react';
import { Loader2, Plus, Trash2, Lightbulb, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useInstitutionNotes,
  useInstitutionNoteActions,
  type InstitutionNoteType,
} from '@/hooks/useInstitutionNotes';

/**
 * Staff-editable "insider tips" for one institution. These are NOT shown to
 * students directly — the compare-universities edge function reads them
 * server-side to enrich the AI comparison. Writes are gated by RLS
 * (owner/admin/document_handler); non-staff simply get an error toast.
 */

const TYPE_META: Record<InstitutionNoteType, { label: string; icon: typeof Info; variant: 'secondary' | 'warning' }> = {
  tip: { label: 'Tip', icon: Lightbulb, variant: 'secondary' },
  general: { label: 'General', icon: Info, variant: 'secondary' },
  warning: { label: 'Warning', icon: AlertTriangle, variant: 'warning' },
};

export function InstitutionNotesPanel({ institutionId }: { institutionId: string | null }) {
  const { data: notes = [], isLoading, error } = useInstitutionNotes(institutionId);
  const { add, remove } = useInstitutionNoteActions(institutionId);
  const [noteType, setNoteType] = useState<InstitutionNoteType>('tip');
  const [content, setContent] = useState('');

  const submit = () => {
    if (!institutionId || !content.trim()) return;
    add.mutate(
      { institutionId, noteType, content },
      {
        onSuccess: () => {
          setContent('');
          toast.success('Note added');
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Staff-only insider notes. Students never see these directly — the AI comparison uses them to
        give better, personalized advice.
      </p>

      <div className="space-y-2 rounded-md border border-border/60 p-3">
        <div className="flex items-center gap-2">
          <Select value={noteType} onValueChange={(v) => setNoteType(v as InstitutionNoteType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tip">Tip</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder="e.g. Strong scholarship for TOPIK 5+; dorm places are limited, apply early."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!content.trim() || add.isPending}>
            {add.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add note
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Could not load notes: {error.message}</p>
      ) : notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const meta = TYPE_META[n.note_type] ?? TYPE_META.general;
            const Icon = meta.icon;
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-md border border-border/60 p-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Badge variant={meta.variant} className="mb-1">
                    {meta.label}
                  </Badge>
                  <p className="whitespace-pre-wrap break-words text-sm">{n.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    remove.mutate(n.id, {
                      onSuccess: () => toast.success('Note removed'),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InstitutionNotesPanel;
