import { useTranslation } from 'react-i18next';
import { Check, Clock, MessageSquare, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import {
  DUE_TONE_CLASS,
  PRIORITY_META,
  getDueMeta,
  getInitials,
} from './taskUi';

interface TaskRowProps {
  task: Task;
  studentName?: string | null;
  commentCount?: number;
  isLast?: boolean;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

export function TaskRow({
  task,
  studentName,
  commentCount = 0,
  isLast = false,
  onTaskClick,
  onStatusChange,
}: TaskRowProps) {
  const { t } = useTranslation();
  const isCompleted = task.status === 'completed';
  const priority = PRIORITY_META[task.priority];
  const due = getDueMeta(task.due_date, t);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTaskClick(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTaskClick(task);
        }
      }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50',
        !isLast && 'border-b border-border',
      )}
    >
      {/* Complete toggle */}
      <button
        type="button"
        aria-label={t('tasks.markDone')}
        onClick={(e) => {
          e.stopPropagation();
          onStatusChange(task.id, isCompleted ? 'todo' : 'completed');
        }}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          isCompleted
            ? 'border-success bg-success text-success-foreground'
            : 'border-border hover:border-success',
        )}
      >
        {isCompleted && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      {/* Priority bar */}
      <span
        aria-hidden="true"
        className={cn('h-6 w-1 shrink-0 rounded-full', priority.bar)}
      />

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            isCompleted ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {task.title}
        </p>
        {(studentName || commentCount > 0) && (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {studentName && (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{studentName}</span>
              </span>
            )}
            {studentName && commentCount > 0 && <span aria-hidden="true">·</span>}
            {commentCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {commentCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* In-progress badge */}
      {task.status === 'in_progress' && (
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          {t('tasks.inProgress')}
        </span>
      )}

      {/* Due chip */}
      {due && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
            DUE_TONE_CLASS[due.tone],
          )}
        >
          <Clock className="h-3 w-3" />
          {due.label}
        </span>
      )}

      {/* Assignee avatar */}
      {task.assignee?.full_name && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {getInitials(task.assignee.full_name)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
