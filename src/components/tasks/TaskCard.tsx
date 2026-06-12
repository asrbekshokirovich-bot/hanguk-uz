import { useTranslation } from 'react-i18next';
import { Clock, MessageSquare, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import {
  DUE_TONE_CLASS,
  PRIORITY_META,
  getDueMeta,
  getInitials,
} from './taskUi';

interface TaskCardProps {
  task: Task;
  studentName?: string | null;
  commentCount?: number;
  onTaskClick: (task: Task) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function TaskCard({
  task,
  studentName,
  commentCount = 0,
  onTaskClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const { t } = useTranslation();
  const isCompleted = task.status === 'completed';
  const priority = PRIORITY_META[task.priority];
  const due = getDueMeta(task.due_date, t);

  return (
    <Card
      onClick={() => onTaskClick(task)}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onDragEnd={onDragEnd}
      className={cn(
        'cursor-pointer space-y-2.5 p-3 transition-shadow hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* Priority + id */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            priority.badge,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t(priority.labelKey)}
        </span>
        <span className="ml-auto font-mono text-[11px] uppercase text-muted-foreground">
          #{task.id.slice(0, 6)}
        </span>
      </div>

      {/* Title */}
      <p
        className={cn(
          'text-sm font-medium leading-snug',
          isCompleted ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {task.title}
      </p>

      {/* Linked student */}
      {studentName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{studentName}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        {due ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              DUE_TONE_CLASS[due.tone],
            )}
          >
            <Clock className="h-3 w-3" />
            {due.label}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}
          {task.assignee?.full_name && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                {getInitials(task.assignee.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );
}
