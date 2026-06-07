import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks } from '@/hooks/useTasks';
import { usePayments } from '@/hooks/usePayments';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isSameMonth, parseISO } from 'date-fns';
import { uz, enUS, ru, ko } from 'date-fns/locale';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight,
  ClipboardList,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'task' | 'payment';
  priority?: string;
  status?: string;
  amount?: number;
  currency?: string;
  assignee?: string;
}

export default function CalendarContent() {
  const { t, i18n } = useTranslation();
  const { tasks, loading: tasksLoading } = useTasks();
  const { payments, loading: paymentsLoading } = usePayments();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const loading = tasksLoading || paymentsLoading;

  const getLocale = () => {
    switch (i18n.language) {
      case 'uz': return uz;
      case 'ru': return ru;
      case 'ko': return ko;
      default: return enUS;
    }
  };

  // Combine tasks and payments into calendar events
  const events: CalendarEvent[] = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    // Add tasks with due dates
    tasks.forEach(task => {
      if (task.due_date) {
        allEvents.push({
          id: task.id,
          title: task.title,
          date: parseISO(task.due_date),
          type: 'task',
          priority: task.priority,
          status: task.status,
          assignee: task.assigned_to || undefined,
        });
      }
    });

    // Add payment due dates
    payments.forEach(payment => {
      if (payment.due_date) {
        allEvents.push({
          id: payment.id,
          title: `Payment: ${payment.student?.full_name || 'Unknown'}`,
          date: parseISO(payment.due_date),
          type: 'payment',
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
        });
      }
    });

    return allEvents;
  }, [tasks, payments]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding for the first week
    const startDayOfWeek = getDay(start);
    const paddingDays: (Date | null)[] = Array(startDayOfWeek).fill(null);
    
    return [...paddingDays, ...days];
  }, [currentMonth]);

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-primary';
    }
  };

  // Get status icon
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'in_progress': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'overdue': return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Week day headers
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            {t('navigation.calendar')}
          </h1>
          <p className="text-muted-foreground">
            View tasks and payment deadlines
          </p>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="w-40 text-center font-semibold">
            {format(currentMonth, 'MMMM yyyy', { locale: getLocale() })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentMonth(new Date());
              setSelectedDate(new Date());
            }}
          >
            Today
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Big Calendar */}
        <Card className="lg:col-span-3">
          <CardContent className="p-4">
            {/* Week Headers */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="h-24 bg-muted/30 rounded-lg" />;
                }

                const dayEvents = getEventsForDate(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "h-24 p-1 rounded-lg border transition-all text-left flex flex-col",
                      isToday(day) && "border-primary",
                      isSelected && "ring-2 ring-primary bg-primary/5",
                      !isCurrentMonth && "opacity-50",
                      "hover:bg-accent"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Event indicators */}
                    <div className="flex-1 overflow-hidden space-y-0.5 mt-1">
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event.id}
                          className={cn(
                            "text-xs truncate px-1 py-0.5 rounded",
                            event.type === 'task' && getPriorityColor(event.priority),
                            event.type === 'payment' && "bg-green-500",
                            "text-white"
                          )}
                        >
                          {event.type === 'task' ? (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="h-2.5 w-2.5 flex-shrink-0" />
                              <span className="truncate">{event.title}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-2.5 w-2.5 flex-shrink-0" />
                              <span className="truncate">{event.amount?.toLocaleString()}</span>
                            </span>
                          )}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>Urgent</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span>High</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>Payment</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Details */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d', { locale: getLocale() }) : 'Select a day'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('common.noEventsForDay')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map(event => (
                    <div
                      key={event.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        event.type === 'task' && "border-l-4",
                        event.type === 'task' && event.priority === 'urgent' && "border-l-red-500",
                        event.type === 'task' && event.priority === 'high' && "border-l-orange-500",
                        event.type === 'task' && event.priority === 'normal' && "border-l-blue-500",
                        event.type === 'task' && event.priority === 'low' && "border-l-gray-400",
                        event.type === 'payment' && "border-l-4 border-l-green-500"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {event.type === 'task' ? (
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <DollarSign className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium text-sm">{event.title}</span>
                        </div>
                        {getStatusIcon(event.status)}
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-1">
                        {event.type === 'task' && event.priority && (
                          <Badge variant="outline" className="text-xs">
                            {event.priority}
                          </Badge>
                        )}
                        {event.status && (
                          <Badge 
                            variant={event.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {event.status}
                          </Badge>
                        )}
                        {event.type === 'payment' && event.amount && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                            {event.amount.toLocaleString()} {event.currency}
                          </Badge>
                        )}
                      </div>

                      {event.assignee && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>Assigned</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ClipboardList className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status !== 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Urgent Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{payments.filter(p => p.status === 'pending').length}</p>
                <p className="text-xs text-muted-foreground">Pending Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {events.filter(e => {
                    const today = new Date();
                    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return e.date >= today && e.date <= weekFromNow;
                  }).length}
                </p>
                <p className="text-xs text-muted-foreground">Due This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}