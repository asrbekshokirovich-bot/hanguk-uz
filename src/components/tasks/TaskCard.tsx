import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Trash2, 
  Edit,
  Calendar,
  AlertTriangle,
  GripVertical
} from 'lucide-react';
import { Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { differenceInDays, format, isToday, isTomorrow, isPast } from 'date-fns';

interface TaskCardProps {
  task: Task;
  currentUserId?: string;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDelete: (taskId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}

const priorityConfig = {
  urgent: { color: 'bg-destructive', stripe: 'bg-destructive', label: 'Urgent' },
  high: { color: 'bg-warning', stripe: 'bg-warning', label: 'High' },
  normal: { color: 'bg-primary', stripe: 'bg-primary', label: 'Normal' },
  low: { color: 'bg-muted-foreground', stripe: 'bg-muted-foreground', label: 'Low' },
};

export function TaskCard({ 
  task, 
  currentUserId,
  onTaskClick, 
  onStatusChange, 
  onDelete,
  draggable = false,
  onDragStart
}: TaskCardProps) {
  const { t } = useTranslation();
  
  const isOverdue = task.due_date && 
    isPast(new Date(task.due_date)) && 
    task.status !== 'completed' && 
    task.status !== 'cancelled';

  const isCompleted = task.status === 'completed';
  const priority = priorityConfig[task.priority];

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDueDateLabel = () => {
    if (!task.due_date) return null;
    const date = new Date(task.due_date);
    
    if (isOverdue) {
      const daysOverdue = differenceInDays(new Date(), date);
      return daysOverdue === 0 ? 'Due today' : `${daysOverdue}d overdue`;
    }
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    
    const daysUntil = differenceInDays(date, new Date());
    if (daysUntil <= 7) return `In ${daysUntil}d`;
    return format(date, 'MMM d');
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, task);
    }
  };

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all cursor-pointer hover:shadow-md",
        isCompleted && "opacity-60",
        isOverdue && "ring-1 ring-destructive/50",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      onClick={() => onTaskClick(task)}
      draggable={draggable}
      onDragStart={handleDragStart}
    >
      {/* Priority Stripe */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", priority.stripe)} />
      
      <CardContent className="p-3 pl-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle (only in kanban) */}
          {draggable && (
            <div className="pt-0.5 opacity-0 group-hover:opacity-50 transition-opacity">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          
          {/* Checkbox */}
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isCompleted}
              onCheckedChange={(checked) => 
                onStatusChange(task.id, checked ? 'completed' : 'todo')
              }
              className="h-5 w-5"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title & Actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className={cn(
                  "font-medium text-sm leading-tight",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {task.description}
                  </p>
                )}
              </div>
              
              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100]">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('common.edit')}
                  </DropdownMenuItem>
                  {task.source !== 'command-center' && (
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Meta Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Priority Badge */}
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[10px] px-1.5 py-0 h-5 font-medium text-white",
                  priority.color
                )}
              >
                {priority.label}
              </Badge>
              
              {/* Due Date */}
              {task.due_date && (
                <Badge 
                  variant={isOverdue ? 'destructive' : 'outline'} 
                  className="text-[10px] px-1.5 py-0 h-5 gap-1"
                >
                  {isOverdue && <AlertTriangle className="h-2.5 w-2.5" />}
                  <Calendar className="h-2.5 w-2.5" />
                  {getDueDateLabel()}
                </Badge>
              )}

              {/* Assignee Avatar */}
              {task.assignee && (
                <div className="flex items-center gap-1">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                      {getInitials(task.assignee.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {task.assignee.full_name?.split(' ')[0]}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
