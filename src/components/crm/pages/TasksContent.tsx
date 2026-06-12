import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, Task, TaskComment } from '@/hooks/useTasks';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TaskQuickAdd } from '@/components/tasks/TaskQuickAdd';
import { TaskKanbanBoard } from '@/components/tasks/TaskKanbanBoard';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useVoiceNotification } from '@/hooks/useVoiceNotification';
import { supabase } from '@/integrations/supabase/client';
import { LayoutList, Kanban, Plus } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban';

function ProgressRing({ percent }: { percent: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="stroke-accent transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-foreground">
        {percent}%
      </div>
    </div>
  );
}

export default function TasksContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifyTaskCreated } = useVoiceNotification();
  const {
    tasks,
    loading,
    stats,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    fetchComments,
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
  const [studentMap, setStudentMap] = useState<Map<string, string>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('taskViewMode', viewMode);
  }, [viewMode]);

  // Fetch staff members
  useEffect(() => {
    const fetchStaff = async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');

      if (roles) {
        const userIds = [...new Set(roles.map((r) => r.user_id))];
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

  // Display-only: resolve linked-student names (student_id references a profile user_id)
  const studentIdsKey = useMemo(
    () =>
      [...new Set(tasks.map((task) => task.student_id).filter(Boolean) as string[])]
        .sort()
        .join(','),
    [tasks],
  );

  useEffect(() => {
    const ids = studentIdsKey ? studentIdsKey.split(',') : [];
    if (ids.length === 0) {
      setStudentMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ids);
      if (cancelled || !data) return;
      const map = new Map<string, string>();
      for (const profile of data) {
        if (profile.full_name) map.set(profile.user_id, profile.full_name);
      }
      setStudentMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentIdsKey]);

  // Display-only: per-task comment counts for row/card indicators
  const taskIdsKey = useMemo(
    () => tasks.map((task) => task.id).sort().join(','),
    [tasks],
  );

  useEffect(() => {
    const ids = taskIdsKey ? taskIdsKey.split(',') : [];
    if (ids.length === 0) {
      setCommentCounts(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('task_comments')
        .select('task_id')
        .in('task_id', ids);
      if (cancelled || !data) return;
      const map = new Map<string, number>();
      for (const row of data) {
        map.set(row.task_id, (map.get(row.task_id) ?? 0) + 1);
      }
      setCommentCounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIdsKey]);

  // Load comments when task is selected
  useEffect(() => {
    if (selectedTask && detailSheetOpen) {
      setLoadingComments(true);
      fetchComments(selectedTask.id).then(({ data }) => {
        setComments(data || []);
        setLoadingComments(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask, detailSheetOpen]);

  const openNewTask = () => {
    setDefaultStatus('todo');
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailSheetOpen(true);
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    await updateTask(taskId, { status });
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
        description: t('tasks.taskDeleted'),
      });
      if (selectedTask?.id === taskId) {
        setDetailSheetOpen(false);
        setSelectedTask(null);
      }
    }
  };

  const handleSave = async (data: {
    title: string;
    description?: string;
    priority?: Task['priority'];
    status?: Task['status'];
    due_date?: string;
    assigned_to?: string;
  }) => {
    if (editingTask) {
      const { error } = await updateTask(editingTask.id, data);
      if (!error) {
        toast({ title: t('common.success'), description: t('tasks.taskUpdated') });
        if (selectedTask?.id === editingTask.id) {
          setSelectedTask({ ...selectedTask, ...data });
        }
      }
      return { error };
    } else {
      const { error } = await createTask({ ...data, status: defaultStatus });
      if (!error) {
        toast({ title: t('common.success'), description: t('tasks.taskCreated') });
        notifyTaskCreated();
      }
      return { error };
    }
  };

  const handleQuickAdd = async (title: string) => {
    const { error } = await createTask({ title });
    if (!error) {
      toast({ title: t('common.success'), description: t('tasks.taskCreated') });
      notifyTaskCreated();
    } else {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
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

  const completionPercentage =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const metrics: { label: string; value: number; dot: string }[] = [
    { label: t('tasks.overdue'), value: stats.overdue, dot: 'bg-destructive' },
    { label: t('tasks.inProgress'), value: stats.inProgress, dot: 'bg-warning' },
    { label: t('tasks.todo'), value: stats.todo, dot: 'bg-info' },
    { label: t('tasks.assignedToMe'), value: stats.myTasks, dot: 'bg-primary' },
  ];

  return (
    <div className="space-y-5">
      {/* Slim header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h2">{t('tasks.title')}</h1>
          <p className="body-sm mt-1">
            {stats.overdue > 0 ? (
              <span className="font-semibold text-destructive">
                {t('tasks.summaryOverdue', { n: stats.overdue })}
              </span>
            ) : (
              <span>{t('tasks.allOnTrack')}</span>
            )}
            {' · '}
            {t('tasks.summaryInProgress', { n: stats.inProgress })}
            {' · '}
            {t('tasks.summaryAssigned', { n: stats.myTasks })}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-md bg-muted p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors',
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">{t('tasks.focus')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors',
                viewMode === 'kanban'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Kanban className="h-4 w-4" />
              <span className="hidden sm:inline">{t('tasks.board')}</span>
            </button>
          </div>

          <Button
            onClick={openNewTask}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">{t('tasks.newTask')}</span>
          </Button>
        </div>
      </div>

      {/* Summary bar — one calm card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          <div className="flex items-center gap-4">
            <ProgressRing percent={completionPercentage} />
            <div>
              <p className="text-2xl font-extrabold leading-none text-foreground">
                {stats.completed}
                <span className="text-base font-medium text-muted-foreground"> / {stats.total}</span>
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {t('tasks.completed')}
              </p>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-border sm:block" />

          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex items-center gap-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-[3px]', metric.dot)} aria-hidden="true" />
                <div>
                  <p className="text-lg font-bold leading-none text-foreground">{metric.value}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">{metric.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Inline quick-add */}
      <TaskQuickAdd onQuickAdd={handleQuickAdd} onOpenFullForm={openNewTask} disabled={loading} />

      {/* Views */}
      {viewMode === 'list' ? (
        <TaskList
          tasks={tasks}
          loading={loading}
          currentUserId={user?.id}
          studentMap={studentMap}
          commentCounts={commentCounts}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      ) : (
        <TaskKanbanBoard
          tasks={tasks}
          currentUserId={user?.id}
          studentMap={studentMap}
          commentCounts={commentCounts}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onAddTask={handleAddTaskForStatus}
        />
      )}

      {/* Detail drawer */}
      <TaskDetailSheet
        task={selectedTask}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setSelectedTask(null);
        }}
        comments={comments}
        loadingComments={loadingComments}
        studentName={selectedTask?.student_id ? studentMap.get(selectedTask.student_id) : null}
        onEdit={() => {
          setEditingTask(selectedTask);
          setFormOpen(true);
        }}
        onDelete={handleDelete}
        onStatusChange={(status) => {
          if (selectedTask) {
            handleStatusChange(selectedTask.id, status);
          }
        }}
        onAddComment={handleAddComment}
        onOpenStudent={() => {
          setDetailSheetOpen(false);
          navigate('/crm/students');
        }}
      />

      {/* Form dialog */}
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
