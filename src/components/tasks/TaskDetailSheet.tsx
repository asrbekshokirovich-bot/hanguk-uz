import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MentionInput } from '@/components/ui/mention-input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  Calendar, 
  User, 
  Clock,
  Send,
  Edit,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  X
} from 'lucide-react';
import { Task, TaskComment } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast } from 'date-fns';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: TaskComment[];
  loadingComments: boolean;
  onEdit: () => void;
  onStatusChange: (status: Task['status']) => void;
  onAddComment: (content: string) => Promise<void>;
}

const priorityConfig = {
  urgent: { color: 'bg-destructive', label: 'Urgent' },
  high: { color: 'bg-orange-500', label: 'High' },
  normal: { color: 'bg-primary', label: 'Normal' },
  low: { color: 'bg-muted-foreground', label: 'Low' },
};

export function TaskDetailSheet({ 
  task,
  open,
  onOpenChange,
  comments,
  loadingComments,
  onEdit,
  onStatusChange,
  onAddComment 
}: TaskDetailSheetProps) {
  const { t } = useTranslation();
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  if (!task) return null;

  const isOverdue = task.due_date && 
    isPast(new Date(task.due_date)) && 
    task.status !== 'completed' && 
    task.status !== 'cancelled';

  const priority = priorityConfig[task.priority];
  const isCompleted = task.status === 'completed';

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    await onAddComment(newComment.trim());
    setNewComment('');
    setSending(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className={cn(
                "text-left text-lg",
                isCompleted && "line-through text-muted-foreground"
              )}>
                {task.title}
              </SheetTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge 
                  className={cn("text-white text-xs", priority.color)}
                >
                  {priority.label}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {task.status.replace('_', ' ')}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Description */}
            {task.description && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {t('common.description')}
                </p>
                <p className="text-sm">{task.description}</p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {!isCompleted && (
                <Button 
                  size="sm" 
                  onClick={() => onStatusChange('completed')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
              {task.status === 'todo' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onStatusChange('in_progress')}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
              {isCompleted && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onStatusChange('todo')}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reopen
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                {t('common.edit')}
              </Button>
            </div>

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.due_date && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <Calendar className={cn(
                    "h-4 w-4 shrink-0",
                    isOverdue ? "text-destructive" : "text-muted-foreground"
                  )} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Due Date</p>
                    <p className={cn(
                      "font-medium truncate",
                      isOverdue && "text-destructive"
                    )}>
                      {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {task.assignee && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {getInitials(task.assignee.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Assigned to</p>
                    <p className="font-medium truncate">{task.assignee.full_name || 'Unknown'}</p>
                  </div>
                </div>
              )}

              {task.creator && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Created by</p>
                    <p className="font-medium truncate">{task.creator.full_name || 'Unknown'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Created</p>
                  <p className="font-medium truncate">
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Comments Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Comments ({comments.length})
                </p>
              </div>

              {loadingComments ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {getInitials(comment.user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {comment.user?.full_name || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Comment Input */}
        <div className="p-4 border-t bg-background shrink-0">
          <div className="flex gap-2">
            <MentionInput
              placeholder="Add a comment... (type @ to mention)"
              value={newComment}
              onChange={setNewComment}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
            />
            <Button 
              onClick={handleSendComment} 
              disabled={!newComment.trim() || sending}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
