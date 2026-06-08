import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from './TaskCard';
import { Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import {
  Circle,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TaskKanbanBoardProps {
  tasks: Task[];
  currentUserId?: string;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDelete: (taskId: string) => void;
  onAddTask: (status: Task['status']) => void;
}

type KanbanColumn = {
  id: Task['status'];
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
};

const columns: KanbanColumn[] = [
  {
    id: 'todo',
    title: 'To Do',
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10 dark:bg-warning/20'
  },
  {
    id: 'completed',
    title: 'Completed',
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success/10 dark:bg-success/20'
  },
];

export function TaskKanbanBoard({
  tasks,
  currentUserId,
  onTaskClick,
  onStatusChange,
  onDelete,
  onAddTask
}: TaskKanbanBoardProps) {
  const { t } = useTranslation();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);

  const getTasksByStatus = (status: Task['status']) =>
    tasks.filter(task => task.status === status);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay for visual feedback
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTask(null);
    setDragOverColumn(null);
    (e.target as HTMLElement).classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100dvh-20rem)] min-h-[400px]">
      {columns.map((column) => {
        const columnTasks = getTasksByStatus(column.id);
        const Icon = column.icon;
        const isCompleted = column.id === 'completed';
        const isDragOver = dragOverColumn === column.id;

        const ColumnContent = (
          <div
            className={cn(
              "flex flex-col h-full rounded-lg border transition-all",
              column.bgColor,
              isDragOver && "ring-2 ring-primary ring-offset-2"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 border-b bg-background/50">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", column.color)} />
                <span className="font-medium text-sm">{column.title}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {columnTasks.length}
                </Badge>
              </div>
              {isCompleted && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    {completedCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>

            {/* Column Content */}
            {isCompleted ? (
              <CollapsibleContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-2">
                  <div className="space-y-2">
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        currentUserId={currentUserId}
                        onTaskClick={onTaskClick}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                        draggable
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            ) : (
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      currentUserId={currentUserId}
                      onTaskClick={onTaskClick}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                      draggable
                      onDragStart={handleDragStart}
                    />
                  ))}

                  {/* Add Task Button */}
                  {column.id === 'todo' && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground hover:text-foreground"
                      onClick={() => onAddTask(column.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('tasks.addTask')}
                    </Button>
                  )}

                  {columnTasks.length === 0 && column.id !== 'todo' && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {t('common.none')}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        );

        if (isCompleted) {
          return (
            <Collapsible
              key={column.id}
              open={!completedCollapsed}
              onOpenChange={(open) => setCompletedCollapsed(!open)}
              className="h-full"
            >
              {ColumnContent}
            </Collapsible>
          );
        }

        return <div key={column.id} className="h-full">{ColumnContent}</div>;
      })}
    </div>
  );
}
