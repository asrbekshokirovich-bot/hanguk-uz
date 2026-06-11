import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Clock,
  Send,
  Edit,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Task, TaskComment } from '@/hooks/useTasks';

interface TaskDetailProps {
  task: Task;
  comments: TaskComment[];
  loadingComments: boolean;
  onBack: () => void;
  onEdit: () => void;
  onStatusChange: (status: Task['status']) => void;
  onAddComment: (content: string) => Promise<void>;
}

const priorityColors = {
  urgent: 'bg-destructive',
  high: 'bg-warning',
  normal: 'bg-info',
  low: 'bg-muted',
};

export function TaskDetail({ 
  task, 
  comments,
  loadingComments,
  onBack, 
  onEdit,
  onStatusChange,
  onAddComment 
}: TaskDetailProps) {
  const { t } = useTranslation();
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const isOverdue = task.due_date && 
    new Date(task.due_date) < new Date() && 
    task.status !== 'completed' && 
    task.status !== 'cancelled';

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await onAddComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          {t('common.edit')}
        </Button>
      </div>

      {/* Task Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className={task.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                {task.title}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge className={priorityColors[task.priority]}>
                  {task.priority}
                </Badge>
                <Badge variant="outline">
                  {task.status.replace('_', ' ')}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {task.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('common.description')}</p>
              <p>{task.description}</p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            {task.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t('tasks.dueDate')}</p>
                  <p className={isOverdue ? 'text-destructive font-medium' : ''}>
                    {new Date(task.due_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {task.assignee && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t('tasks.assignTo')}</p>
                  <p>{task.assignee.full_name || 'Unknown'}</p>
                </div>
              </div>
            )}

            {task.creator && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p>{task.creator.full_name || 'Unknown'}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p>{new Date(task.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Quick Status Actions */}
          <div className="flex flex-wrap gap-2">
            {task.status !== 'completed' && (
              <Button 
                size="sm" 
                onClick={() => onStatusChange('completed')}
                className="bg-success hover:bg-success"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            {task.status === 'todo' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onStatusChange('in_progress')}
              >
                Start Task
              </Button>
            )}
            {task.status === 'completed' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onStatusChange('todo')}
              >
                Reopen Task
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comments ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingComments ? (
            <div className="animate-pulse space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(comment.user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {comment.user?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Add Comment */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button 
              onClick={handleSendComment} 
              disabled={!newComment.trim() || sending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
