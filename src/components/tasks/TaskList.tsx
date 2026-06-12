import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListTodo } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskRow } from './TaskRow';
import { Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { FocusBucket, getFocusBucket } from './taskUi';

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  currentUserId?: string;
  studentMap?: Map<string, string>;
  commentCounts?: Map<string, number>;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDelete: (taskId: string) => void;
}

const BUCKETS: { key: FocusBucket; dot: string; labelKey: string }[] = [
  { key: 'overdue', dot: 'bg-destructive', labelKey: 'tasks.overdue' },
  { key: 'today', dot: 'bg-warning', labelKey: 'tasks.today' },
  { key: 'upcoming', dot: 'bg-info', labelKey: 'tasks.upcoming' },
  { key: 'completed', dot: 'bg-success', labelKey: 'tasks.completed' },
];

export function TaskList({
  tasks,
  loading,
  studentMap,
  commentCounts,
  onTaskClick,
  onStatusChange,
}: TaskListProps) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const map: Record<FocusBucket, Task[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      completed: [],
    };
    for (const task of tasks) {
      const bucket = getFocusBucket(task);
      if (bucket) map[bucket].push(task);
    }
    return map;
  }, [tasks]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[0, 1].map((g) => (
          <div key={g} className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Card className="divide-y divide-border p-0">
              {[0, 1, 2].map((r) => (
                <div key={r} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-6 w-1 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    );
  }

  const visibleBuckets = BUCKETS.filter((b) => grouped[b.key].length > 0);

  if (visibleBuckets.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ListTodo}
          title={t('tasks.emptyTitle')}
          description={t('tasks.emptyDescription')}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {visibleBuckets.map((bucket) => {
        const items = grouped[bucket.key];
        return (
          <section key={bucket.key} className="space-y-2.5">
            <div className="flex items-center gap-2 px-0.5">
              <span className={cn('h-2 w-2 rounded-full', bucket.dot)} aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">{t(bucket.labelKey)}</h3>
              <span className="text-xs font-medium text-muted-foreground">{items.length}</span>
            </div>
            <Card className="p-0">
              {items.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  studentName={task.student_id ? studentMap?.get(task.student_id) : null}
                  commentCount={commentCounts?.get(task.id) ?? 0}
                  isLast={i === items.length - 1}
                  onTaskClick={onTaskClick}
                  onStatusChange={onStatusChange}
                />
              ))}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
