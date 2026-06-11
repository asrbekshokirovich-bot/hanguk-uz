import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import { useCommandCenterSync } from '@/hooks/useCommandCenterSync';
import { useStaffMentions } from '@/hooks/useStaffMentions';
import { extractMentions, getContentPreview, getUniqueMentionedUserIds } from '@/lib/mentionParser';
import { createMention } from '@/hooks/useMentionNotifications';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  student_id: string | null;
  application_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  source: string;
  assignee?: {
    full_name: string | null;
  };
  creator?: {
    full_name: string | null;
  };
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    full_name: string | null;
  };
}

export function useTasks() {
  const { user } = useAuth();
  const { activeIntakeId } = useActiveIntake();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { syncTask } = useCommandCenterSync();
  const { staffList } = useStaffMentions();

  const fetchTasks = async () => {
    const { data, error } = await applyIntake(
      supabase.from('tasks').select('*'),
      activeIntakeId,
    ).order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch profiles for assignees and creators
      const tasksWithProfiles = await Promise.all(
        data.map(async (task) => {
          let assignee = null;
          let creator = null;

          if (task.assigned_to) {
            const { data: assigneeData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', task.assigned_to)
              .maybeSingle();
            assignee = assigneeData;
          }

          if (task.created_by) {
            const { data: creatorData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', task.created_by)
              .maybeSingle();
            creator = creatorData;
          }

          return {
            ...task,
            assignee,
            creator,
          };
        })
      );
      setTasks(tasksWithProfiles as Task[]);
    }
    setLoading(false);
  };

  const createTask = async (task: {
    title: string;
    description?: string;
    priority?: Task['priority'];
    due_date?: string;
    assigned_to?: string;
    student_id?: string;
    application_id?: string;
  }) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error, data } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        description: task.description || null,
        priority: task.priority || 'normal',
        due_date: task.due_date || null,
        assigned_to: task.assigned_to || null,
        student_id: task.student_id || null,
        application_id: task.application_id || null,
        created_by: user.id,
        intake_id: activeIntakeId,
      })
      .select()
      .single();

    if (!error && data) {
      // Sync to Command Center
      syncTask({
        id: data.id,
        title: data.title,
        description: data.description || undefined,
        status: mapStatusToCommandCenter(data.status),
        priority: data.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: data.due_date || undefined,
        assigned_to: data.assigned_to ? { id: data.assigned_to, name: '' } : undefined,
      });
      await fetchTasks();
    }
    return { error, data };
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const updateData: any = { ...updates };
    
    if (updates.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (updates.status) {
      updateData.completed_at = null;
    }

    const { error, data } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      // Sync to Command Center
      syncTask({
        id: data.id,
        title: data.title,
        description: data.description || undefined,
        status: mapStatusToCommandCenter(data.status),
        priority: data.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: data.due_date || undefined,
        assigned_to: data.assigned_to ? { id: data.assigned_to, name: '' } : undefined,
      });
      await fetchTasks();
    }
    return { error };
  };

  const mapStatusToCommandCenter = (status: string): 'todo' | 'in_progress' | 'done' => {
    const statusMap: Record<string, 'todo' | 'in_progress' | 'done'> = {
      'todo': 'todo',
      'pending': 'todo',
      'in_progress': 'in_progress',
      'completed': 'done',
      'cancelled': 'done',
    };
    return statusMap[status] || 'todo';
  };

  const deleteTask = async (id: string) => {
    // Note: with RLS, PostgREST may return 0 deleted rows without throwing an error.
    // So we request the deleted row back and treat "0 rows" as a permission/visibility issue.
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      return { error };
    }

    if (!data || data.length === 0) {
      return { error: new Error('You do not have permission to delete this task.') };
    }

    await fetchTasks();
    return { error: null };
  };

  const addComment = async (taskId: string, content: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error, data } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: user.id,
        content,
      })
      .select()
      .single();

    // Process mentions in the comment
    if (!error && data) {
      const mentions = extractMentions(content, staffList);
      const mentionedUserIds = getUniqueMentionedUserIds(mentions);
      const contentPreview = getContentPreview(content);

      // Create mention records for each mentioned user
      for (const mentionedUserId of mentionedUserIds) {
        await createMention(
          mentionedUserId,
          user.id,
          'task_comment',
          data.id,
          contentPreview
        );
      }
    }

    return { error };
  };

  const fetchComments = async (taskId: string) => {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const commentsWithUsers = await Promise.all(
        data.map(async (comment) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', comment.user_id)
            .maybeSingle();

          return {
            ...comment,
            user: userData,
          };
        })
      );
      return { data: commentsWithUsers as TaskComment[], error: null };
    }
    return { data: [], error };
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntakeId]);

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      t.status !== 'completed' && 
      t.status !== 'cancelled'
    ).length,
    myTasks: tasks.filter(t => t.assigned_to === user?.id).length,
  };

  return {
    tasks,
    loading,
    stats,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    fetchComments,
  };
}
