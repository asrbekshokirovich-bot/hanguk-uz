import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, Task, TaskComment } from '@/hooks/useTasks';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TaskQuickAdd } from '@/components/tasks/TaskQuickAdd';
import { TaskKanbanBoard } from '@/components/tasks/TaskKanbanBoard';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useVoiceNotification } from '@/hooks/useVoiceNotification';
import { supabase } from '@/integrations/supabase/client';
import { 
  LayoutList,
  Kanban,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Target
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban';

export default function TasksContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { notifyTaskCreated } = useVoiceNotification();
  const { 
    tasks, 
    loading, 
    stats,
    createTask, 
    updateTask, 
    deleteTask,
    addComment,
    fetchComments 
  } = useTasks();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('taskViewMode') as ViewMode) || 'list';
    }
    return 'list';
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [staffMembers, setStaffMembers] = useState<(Tables<'profiles'> & { user_id: string })[]>([]);
  const [defaultStatus, setDefaultStatus] = useState<Task['status']>('todo');

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('taskViewMode', viewMode);
  }, [viewMode]);

  // Fetch staff members
  useEffect(() => {
    const fetchStaff = async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id');

      if (roles) {
        const userIds = [...new Set(roles.map(r => r.user_id))];
        const profiles: (Tables<'profiles'> & { user_id: string })[] = [];

        for (const userId of userIds) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (data) {
            profiles.push(data);
          }
        }
        setStaffMembers(profiles);
      }
    };

    fetchStaff();
  }, []);

  // Load comments when task is selected
  useEffect(() => {
    if (selectedTask && detailSheetOpen) {
      setLoadingComments(true);
      fetchComments(selectedTask.id).then(({ data }) => {
        setComments(data || []);
        setLoadingComments(false);
      });
    }
  }, [selectedTask, detailSheetOpen]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailSheetOpen(true);
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    await updateTask(taskId, { status });
    // Update selected task if it's the one being changed
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, status });
    }
  };

  const handleDelete = async (taskId: string) => {
    const { error } = await deleteTask(taskId);
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: 'Task deleted',
      });
      if (selectedTask?.id === taskId) {
        setDetailSheetOpen(false);
        setSelectedTask(null);
      }
    }
  };

  const handleSave = async (data: any) => {
    if (editingTask) {
      const { error } = await updateTask(editingTask.id, data);
      if (!error) {
        toast({ title: t('common.success'), description: 'Task updated' });
        if (selectedTask?.id === editingTask.id) {
          setSelectedTask({ ...selectedTask, ...data });
        }
      }
      return { error };
    } else {
      const { error } = await createTask({ ...data, status: defaultStatus });
      if (!error) {
        toast({ title: t('common.success'), description: 'Task created' });
        notifyTaskCreated();
      }
      return { error };
    }
  };

  const handleQuickAdd = async (title: string) => {
    const { error } = await createTask({ title });
    if (!error) {
      toast({ title: t('common.success'), description: 'Task created' });
      notifyTaskCreated();
    } else {
      toast({ 
        title: t('common.error'), 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleAddComment = async (content: string) => {
    if (!selectedTask) return;
    const { error } = await addComment(selectedTask.id, content);
    if (!error) {
      const { data } = await fetchComments(selectedTask.id);
      setComments(data || []);
    }
  };

  const handleAddTaskForStatus = (status: Task['status']) => {
    setDefaultStatus(status);
    setEditingTask(null);
    setFormOpen(true);
  };

  const completionPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Enhanced Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Completion Progress */}
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <svg className="h-12 w-12 -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${completionPercentage * 1.26} 126`}
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold">{completionPercentage}%</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('common.all')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-warning/10 dark:bg-warning/30 rounded-lg shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">{t('tasks.inProgress')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-success/10 dark:bg-success/30 rounded-lg shrink-0">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">{t('tasks.completed')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(stats.overdue > 0 && "border-destructive/50")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              stats.overdue > 0 
                ? "bg-destructive/10 animate-pulse" 
                : "bg-destructive/10 dark:bg-destructive/30"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                stats.overdue > 0 ? "text-destructive" : "text-destructive"
              )} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 dark:bg-primary/30 rounded-lg shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.myTasks}</p>
              <p className="text-xs text-muted-foreground">My Tasks</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <TaskQuickAdd
            onQuickAdd={handleQuickAdd}
            onOpenFullForm={() => {
              setDefaultStatus('todo');
              setEditingTask(null);
              setFormOpen(true);
            }}
            disabled={loading}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1 bg-muted/50">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="px-3"
            >
              <LayoutList className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="px-3"
            >
              <Kanban className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Board</span>
            </Button>
          </div>
          
          <Button onClick={() => {
            setDefaultStatus('todo');
            setEditingTask(null);
            setFormOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t('tasks.addTask')}</span>
          </Button>
        </div>
      </div>

      {/* Task Views */}
      {viewMode === 'list' ? (
        <TaskList
          tasks={tasks}
          loading={loading}
          currentUserId={user?.id}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      ) : (
        <TaskKanbanBoard
          tasks={tasks}
          currentUserId={user?.id}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onAddTask={handleAddTaskForStatus}
        />
      )}

      {/* Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setSelectedTask(null);
        }}
        comments={comments}
        loadingComments={loadingComments}
        onEdit={() => {
          setEditingTask(selectedTask);
          setFormOpen(true);
        }}
        onStatusChange={(status) => {
          if (selectedTask) {
            handleStatusChange(selectedTask.id, status);
          }
        }}
        onAddComment={handleAddComment}
      />

      {/* Form Dialog */}
      <TaskForm
        task={editingTask}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingTask(null);
            setDefaultStatus('todo');
          }
        }}
        onSave={handleSave}
        staffMembers={staffMembers}
      />
    </div>
  );
}
