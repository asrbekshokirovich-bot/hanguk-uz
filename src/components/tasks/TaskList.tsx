import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  CheckCircle,
  Filter
} from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Task } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  currentUserId?: string;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDelete: (taskId: string) => void;
}

export function TaskList({ 
  tasks, 
  loading, 
  currentUserId,
  onTaskClick, 
  onStatusChange,
  onDelete 
}: TaskListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesPriority = !priorityFilter || task.priority === priorityFilter;
    const matchesMy = !showMyTasks || task.assigned_to === currentUserId;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesMy;
  });

  const activeFiltersCount = [
    statusFilter,
    priorityFilter,
    showMyTasks
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t('common.search')}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  variant="destructive"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t('common.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="todo">{t('tasks.todo')}</SelectItem>
                    <SelectItem value="in_progress">{t('tasks.inProgress')}</SelectItem>
                    <SelectItem value="completed">{t('tasks.completed')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={priorityFilter || 'all'} onValueChange={(v) => setPriorityFilter(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t('tasks.priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="urgent">{t('tasks.urgent')}</SelectItem>
                    <SelectItem value="high">{t('tasks.high')}</SelectItem>
                    <SelectItem value="normal">{t('tasks.normal')}</SelectItem>
                    <SelectItem value="low">{t('tasks.low')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="my-tasks" 
                  checked={showMyTasks} 
                  onCheckedChange={(checked) => setShowMyTasks(!!checked)} 
                />
                <label htmlFor="my-tasks" className="text-sm cursor-pointer">
                  My Tasks Only
                </label>
              </div>

              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setStatusFilter(null);
                    setPriorityFilter(null);
                    setShowMyTasks(false);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Task Count */}
      <p className="text-sm text-muted-foreground">
        {filteredTasks.length} {t('tasks.title').toLowerCase()}
      </p>

      {/* Task Cards */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('common.none')} {t('tasks.title').toLowerCase()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              onTaskClick={onTaskClick}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
