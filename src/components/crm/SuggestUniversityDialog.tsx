import { useState, useMemo } from 'react';
import { Lightbulb, Search, AlertTriangle, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUniversities } from '@/hooks/useUniversities';
import { supabase } from '@/integrations/supabase/client';

interface SuggestUniversityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  existingSuggestedUniversityIds: string[];
  existingApplicationUniversityIds: string[];
  onSuccess: () => void;
}

export function SuggestUniversityDialog({
  open,
  onOpenChange,
  studentId,
  existingSuggestedUniversityIds,
  existingApplicationUniversityIds,
  onSuccess,
}: SuggestUniversityDialogProps) {
  const { toast } = useToast();
  const { universities, loading: loadingUniversities } = useUniversities();

  const [search, setSearch] = useState('');
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
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
  const isDuplicateSuggestion = selectedUniversityId
    ? existingSuggestedUniversityIds.includes(selectedUniversityId)
    : false;
  const isDuplicateApplication = selectedUniversityId
    ? existingApplicationUniversityIds.includes(selectedUniversityId)
    : false;
  const isDuplicate = isDuplicateSuggestion || isDuplicateApplication;

  const handleSave = async () => {
    if (!selectedUniversityId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('student_suggestions').insert({
        student_id: studentId,
        university_id: selectedUniversityId,
      });

      if (error) throw error;

      toast({ title: 'University suggested successfully' });
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Failed to suggest university',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedUniversityId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('student_suggestions')
        .delete()
        .eq('student_id', studentId)
        .eq('university_id', selectedUniversityId);

      if (error) throw error;

      toast({ title: 'Suggestion removed successfully' });
      setSelectedUniversityId(null);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Failed to remove suggestion',
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Suggest University
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>University to Suggest</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

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
                  const alreadySuggested = existingSuggestedUniversityIds.includes(uni.id);
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
                        {alreadyApplied ? (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                            Applied
                          </Badge>
                        ) : alreadySuggested ? (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">
                            Suggested
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {isDuplicateSuggestion && selectedUniversity && (
            <div className="flex items-start gap-2 rounded-md bg-blue-500/10 border border-blue-400/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{selectedUniversity.name_en || selectedUniversity.name_uz}</strong> has already been suggested to this student.
              </span>
            </div>
          )}

          {isDuplicateApplication && selectedUniversity && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{selectedUniversity.name_en || selectedUniversity.name_uz}</strong> already has an active application.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          {isDuplicateSuggestion ? (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing…
                </>
              ) : (
                'Remove Suggestion'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!selectedUniversityId || isDuplicateApplication || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Suggesting…
                </>
              ) : (
                'Suggest University'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
