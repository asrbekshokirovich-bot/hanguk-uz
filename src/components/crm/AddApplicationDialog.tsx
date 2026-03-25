import { useState, useMemo } from 'react';
import { GraduationCap, Search, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUniversities } from '@/hooks/useUniversities';
import { supabase } from '@/integrations/supabase/client';

interface AddApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  existingApplicationUniversityIds: string[];
  onSuccess: () => void;
}

export function AddApplicationDialog({
  open,
  onOpenChange,
  studentId,
  existingApplicationUniversityIds,
  onSuccess,
}: AddApplicationDialogProps) {
  const { toast } = useToast();
  const { universities, loading: loadingUniversities } = useUniversities();

  const [search, setSearch] = useState('');
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredUniversities = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return universities;
    return universities.filter(
      (u) =>
        u.name_en?.toLowerCase().includes(q) ||
        u.name_uz?.toLowerCase().includes(q) ||
        u.name_ko?.toLowerCase().includes(q)
    );
  }, [universities, search]);

  const selectedUniversity = universities.find((u) => u.id === selectedUniversityId);
  const isDuplicate = selectedUniversityId
    ? existingApplicationUniversityIds.includes(selectedUniversityId)
    : false;

  const handleSave = async () => {
    if (!selectedUniversityId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('applications').insert({
        student_id: studentId,
        university_id: selectedUniversityId,
        status: 'documents_collection',
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Application added successfully' });
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Failed to add application',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelectedUniversityId(null);
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Add Application
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* University Search */}
          <div className="space-y-2">
            <Label>University</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* University list */}
            <div className="border border-border rounded-md max-h-52 overflow-y-auto">
              {loadingUniversities ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading universities…
                </div>
              ) : filteredUniversities.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No universities found
                </div>
              ) : (
                filteredUniversities.map((uni) => {
                  const isSelected = selectedUniversityId === uni.id;
                  const alreadyApplied = existingApplicationUniversityIds.includes(uni.id);
                  return (
                    <button
                      key={uni.id}
                      type="button"
                      onClick={() => setSelectedUniversityId(uni.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0 ${
                        isSelected ? 'bg-primary/10 text-primary font-medium' : ''
                      }`}
                    >
                      <div>
                        <span className="block">{uni.name_en || uni.name_uz}</span>
                        {uni.name_uz && uni.name_en && (
                          <span className="block text-xs text-muted-foreground">{uni.name_uz}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {uni.is_partner && (
                          <Badge variant="secondary" className="text-xs">Partner</Badge>
                        )}
                        {alreadyApplied && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                            Applied
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Duplicate warning */}
          {isDuplicate && selectedUniversity && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{selectedUniversity.name_en || selectedUniversity.name_uz}</strong> already has an active
                application for this student. Adding another will create a duplicate.
              </span>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Any notes about this application…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedUniversityId || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              'Add Application'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
