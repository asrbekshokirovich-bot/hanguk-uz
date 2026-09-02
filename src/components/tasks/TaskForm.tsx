import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateField } from '@/components/ui/date-field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Task } from '@/hooks/useTasks';
import { Tables } from '@/integrations/supabase/types';

interface TaskFormProps {
  task?: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    title: string;
    description?: string;
    priority?: Task['priority'];
    status?: Task['status'];
    due_date?: string;
    assigned_to?: string;
  }) => Promise<{ error: unknown }>;
  staffMembers: (Tables<'profiles'> & { user_id: string })[];
}

export function TaskForm({ task, open, onOpenChange, onSave, staffMembers }: TaskFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal' as Task['priority'],
    status: 'todo' as Task['status'],
    due_date: '',
    assigned_to: '',
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        assigned_to: task.assigned_to || '',
      });
    } else {
      setForm({
        title: '',
        description: '',
        priority: 'normal',
        status: 'todo',
        due_date: '',
        assigned_to: '',
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setLoading(true);
    const { error } = await onSave({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      assigned_to: form.assigned_to || undefined,
    });

    setLoading(false);
    if (!error) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {task ? t('common.edit') : t('tasks.addTask')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('common.name')} *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={`${t('common.name')}…`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('common.description')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={`${t('common.description')}…`}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('tasks.priority')}</Label>
              <Select 
                value={form.priority} 
                onValueChange={(v: Task['priority']) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">{t('tasks.urgent')}</SelectItem>
                  <SelectItem value="high">{t('tasks.high')}</SelectItem>
                  <SelectItem value="normal">{t('tasks.normal')}</SelectItem>
                  <SelectItem value="low">{t('tasks.low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Select 
                value={form.status} 
                onValueChange={(v: Task['status']) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{t('tasks.todo')}</SelectItem>
                  <SelectItem value="in_progress">{t('tasks.inProgress')}</SelectItem>
                  <SelectItem value="completed">{t('tasks.completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('tasks.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('tasks.dueDate')}</Label>
            <DateField
              value={form.due_date}
              onChange={(v) => setForm({ ...form, due_date: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('tasks.assignTo')}</Label>
            <Select 
              value={form.assigned_to || 'unassigned'} 
              onValueChange={(v) => setForm({ ...form, assigned_to: v === 'unassigned' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.select')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{t('tasks.unassigned')}</SelectItem>
                {staffMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.full_name || member.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !form.title.trim()}>
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
