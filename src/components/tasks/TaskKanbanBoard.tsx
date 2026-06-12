import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

interface TaskKanbanBoardProps {
  tasks: Task[];
  currentUserId?: string;
  studentMap?: Map<string, string>;
  commentCounts?: Map<string, number>;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDelete: (taskId: string) => void;
  onAddTask: (status: Task['status']) => void;
}

type KanbanColumn = {
  id: Extract<Task['status'], 'todo' | 'in_progress' | 'completed'>;
  labelKey: string;
  dot: string;
};

const columns: KanbanColumn[] = [
  { id: 'todo', labelKey: 'tasks.todo', dot: 'bg-muted-foreground' },
  { id: 'in_progress', labelKey: 'tasks.inProgress', dot: 'bg-warning' },
  { id: 'completed', labelKey: 'tasks.done', dot: 'bg-success' },
];

export function TaskKanbanBoard({
  tasks,
  studentMap,
  commentCounts,
  onTaskClick,
  onStatusChange,
  onAddTask,
}: TaskKanbanBoardProps) {
  const { t } = useTranslation();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('opacity-50');
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Task['status']) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== targetStatus) {
      onStatusChange(draggedTask.id, targetStatus);
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);
        const isDragOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, column.id)}
            className={cn(
              'rounded-lg border border-border bg-muted/40 p-3 transition-all',
              isDragOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
          >
            {/* Column header */}
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={cn('h-2 w-2 rounded-full', column.dot)} aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">{t(column.labelKey)}</span>
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2.5">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  studentName={task.student_id ? studentMap?.get(task.student_id) : null}
                  commentCount={commentCounts?.get(task.id) ?? 0}
                  onTaskClick={onTaskClick}
                  draggable
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}

              <button
                type="button"
                onClick={() => onAddTask(column.id)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                {t('tasks.addTask')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
