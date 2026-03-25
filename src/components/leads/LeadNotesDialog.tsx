import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLeadNotes, LeadNote } from '@/hooks/useLeadNotes';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { 
  Phone, 
  Send, 
  Pencil, 
  Trash2, 
  Loader2,
  X,
  Check,
  CalendarIcon
} from 'lucide-react';

interface LeadNotesDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTACT_TEMPLATES = [
  { label: '📞 No answer', text: 'Called but no answer. Will try again later.' },
  { label: '✅ Interested', text: 'Spoke with lead. They are interested in studying in Korea. Requested more info about programs.' },
  { label: '📅 Callback', text: 'Lead requested callback at a different time.' },
  { label: '📝 Docs needed', text: 'Discussed requirements. Lead needs to prepare documents.' },
  { label: '❌ Not interested', text: 'Lead is no longer interested in studying abroad.' },
  { label: '💬 Left message', text: 'Left voice message. Waiting for callback.' },
  { label: '🤔 Thinking', text: 'Lead needs time to think/discuss with family. Will follow up later.' },
  { label: '💰 Price inquiry', text: 'Lead asked about tuition fees and total costs. Sent pricing info.' },
];

export function LeadNotesDialog({ lead, open, onOpenChange }: LeadNotesDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notes, loading, fetchNotes, addNote, updateNote, deleteNote } = useLeadNotes(lead?.id || null);
  const [newNote, setNewNote] = useState('');
  const [contactDate, setContactDate] = useState<Date | undefined>(new Date());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editContactDate, setEditContactDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && lead) {
      fetchNotes();
      setContactDate(new Date());
    }
  }, [open, lead, fetchNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setSubmitting(true);
    try {
      await addNote(
        newNote.trim(), 
        contactDate ? format(contactDate, 'yyyy-MM-dd') : undefined
      );
      setNewNote('');
      setContactDate(new Date());
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;
    
    setSubmitting(true);
    try {
      await updateNote(
        noteId, 
        editContent.trim(),
        editContactDate ? format(editContactDate, 'yyyy-MM-dd') : undefined
      );
      setEditingNote(null);
      setEditContent('');
      setEditContactDate(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this contact log?')) {
      await deleteNote(noteId);
    }
  };

  const startEditing = (note: LeadNote) => {
    setEditingNote(note.id);
    setEditContent(note.content);
    setEditContactDate(note.contacted_at ? new Date(note.contacted_at) : undefined);
  };

  const cancelEditing = () => {
    setEditingNote(null);
    setEditContent('');
    setEditContactDate(undefined);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Log - {lead?.full_name}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4">
          {/* Quick Templates - Always visible at top */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_TEMPLATES.map((template) => (
                <Button
                  key={template.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setNewNote(template.text)}
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No contact logs yet</p>
                <p className="text-sm">Log your first contact below</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    {editingNote === note.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Contact Date
                          </label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !editContactDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editContactDate ? format(editContactDate, 'PPP') : 'Select date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={editContactDate}
                                onSelect={setEditContactDate}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          placeholder="Notes about this contact..."
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={submitting}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={submitting}
                          >
                            {submitting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {note.contacted_at && (
                          <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                            <CalendarIcon className="h-4 w-4" />
                            Contacted: {format(new Date(note.contacted_at), 'PPP')}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px]">
                                {getInitials(note.author?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{note.author?.full_name || 'Unknown'}</span>
                            <span>•</span>
                            <span>{format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                          {note.created_by === user?.id && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => startEditing(note)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Add Contact Log Form */}
          <div className="pt-4 border-t mt-auto space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Contact Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !contactDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {contactDate ? format(contactDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={contactDate}
                    onSelect={setContactDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Notes about this contact..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAddNote();
                  }
                }}
              />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || submitting}
                className="shrink-0"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
