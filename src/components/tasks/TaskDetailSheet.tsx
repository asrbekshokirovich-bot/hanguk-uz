import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/ui/mention-input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Check,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  RotateCcw,
  Send,
  ArrowUpRight,
} from 'lucide-react';
import { Task, TaskComment } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  DUE_TONE_CLASS,
  PRIORITY_META,
  STATUS_META,
  getDueMeta,
  getInitials,
} from './taskUi';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: TaskComment[];
  loadingComments: boolean;
  studentName?: string | null;
  onEdit: () => void;
  onDelete?: (taskId: string) => void;
  onStatusChange: (status: Task['status']) => void;
  onAddComment: (content: string) => Promise<void>;
  onOpenStudent?: () => void;
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  comments,
  loadingComments,
  studentName,
  onEdit,
  onDelete,
  onStatusChange,
  onAddComment,
  onOpenStudent,
}: TaskDetailSheetProps) {
  const { t } = useTranslation();
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  if (!task) return null;

  const isCompleted = task.status === 'completed';
  const priority = PRIORITY_META[task.priority];
  const status = STATUS_META[task.status];
  const due = getDueMeta(task.due_date, t);
  const canDelete = task.source !== 'command-center';

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await onAddComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* Header */}
        <SheetHeader className="space-y-0 border-b border-border p-5 pr-12 text-left">
          <span className="mb-3.5 block font-mono text-xs uppercase text-muted-foreground">
            #{task.id.slice(0, 6)}
          </span>

          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label={t('tasks.markDone')}
              onClick={() => onStatusChange(isCompleted ? 'todo' : 'completed')}
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                isCompleted
                  ? 'border-success bg-success text-success-foreground'
                  : 'border-border hover:border-success',
              )}
            >
              {isCompleted && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <SheetTitle
              className={cn(
                'text-lg leading-snug',
                isCompleted && 'text-muted-foreground line-through',
              )}
            >
              {task.title}
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">{t('tasks.title')}</SheetDescription>

          <div className="flex gap-2 pt-4">
            {isCompleted ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onStatusChange('todo')}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('tasks.reopen')}
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onStatusChange('completed')}
              >
                <Check className="mr-2 h-4 w-4" />
                {t('tasks.markDone')}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100]">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t('common.edit')}
                </DropdownMenuItem>
                {task.status === 'todo' && (
                  <DropdownMenuItem onClick={() => onStatusChange('in_progress')}>
                    <Play className="mr-2 h-4 w-4" />
                    {t('tasks.start')}
                  </DropdownMenuItem>
                )}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(task.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-5">
            {/* Properties */}
            <div className="text-sm">
              <PropertyRow label={t('common.status')}>
                <MetaBadge className={status.badge} dot>
                  {t(status.labelKey)}
                </MetaBadge>
              </PropertyRow>
              <PropertyRow label={t('tasks.priority')}>
                <MetaBadge className={priority.badge} dot>
                  {t(priority.labelKey)}
                </MetaBadge>
              </PropertyRow>
              <PropertyRow label={t('tasks.dueDate')}>
                {due ? (
                  <MetaBadge className={DUE_TONE_CLASS[due.tone]}>
                    <Clock className="h-3 w-3" />
                    {due.label}
                  </MetaBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label={t('tasks.assignee')}>
                {task.assignee?.full_name ? (
                  <span className="flex items-center gap-2 text-foreground">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                        {getInitials(task.assignee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {task.assignee.full_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('tasks.unassigned')}</span>
                )}
              </PropertyRow>
              {task.creator?.full_name && (
                <PropertyRow label={t('tasks.createdBy')} last>
                  <span className="text-foreground">{task.creator.full_name}</span>
                </PropertyRow>
              )}
            </div>

            {/* Linked student */}
            {studentName && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-info/10 text-xs font-semibold text-info">
                    {getInitials(studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{studentName}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks.linkedStudent')}</p>
                </div>
                {onOpenStudent && (
                  <Button variant="ghost" size="sm" onClick={onOpenStudent}>
                    {t('common.open')}
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('common.description')}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {task.description}
                </p>
              </div>
            )}

            {/* Activity / comments */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('tasks.activity')}
              </p>

              {loadingComments ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
                      <div className="h-10 flex-1 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t('tasks.noComments')}</p>
              ) : (
                <div className="space-y-3.5">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {getInitials(comment.user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {comment.user?.full_name || '—'}
                          </span>{' '}
                          {comment.content}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Comment composer */}
        <div className="flex items-end gap-2 border-t border-border bg-background p-4">
          <MentionInput
            placeholder={t('tasks.addCommentPlaceholder')}
            value={newComment}
            onChange={setNewComment}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
              }
            }}
          />
          <Button
            onClick={handleSendComment}
            disabled={!newComment.trim() || sending}
            size="icon"
            className="shrink-0"
            aria-label={t('common.send', 'Send')}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PropertyRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5',
        !last && 'border-b border-border',
      )}
    >
      <span className="w-24 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function MetaBadge({
  children,
  className,
  dot = false,
}: {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
