import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useUniversityEvents, UniversityEvent, EventType } from '@/hooks/useUniversityEvents';
import { format } from 'date-fns';
import { uz, enUS, ru, ko } from 'date-fns/locale';
import { 
  CalendarDays, 
  DollarSign, 
  UserCheck, 
  Clock, 
  GraduationCap,
  Circle
} from 'lucide-react';

interface UniversityCalendarProps {
  roomId: string | null;
}

export function UniversityCalendar({ roomId }: UniversityCalendarProps) {
  const { t, i18n } = useTranslation();
  const { events, loading, getEventsForDate, getUpcomingEvents, getEventTypeColor, getEventTypeTextColor } = useUniversityEvents(roomId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const getLocale = () => {
    switch (i18n.language) {
      case 'uz': return uz;
      case 'ru': return ru;
      case 'ko': return ko;
      default: return enUS;
    }
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'tuition_payment':
        return <DollarSign className="h-4 w-4" />;
      case 'interview':
        return <UserCheck className="h-4 w-4" />;
      case 'deadline':
        return <Clock className="h-4 w-4" />;
      case 'orientation':
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getEventTypeLabel = (type: EventType) => {
    return t(`room.eventTypes.${type}`, type);
  };

  const getLocalizedTitle = (event: UniversityEvent) => {
    const lang = i18n.language;
    switch (lang) {
      case 'en': return event.title_en || event.title_uz;
      case 'ru': return event.title_ru || event.title_uz;
      case 'ko': return event.title_ko || event.title_uz;
      default: return event.title_uz;
    }
  };

  const getLocalizedDescription = (event: UniversityEvent) => {
    const lang = i18n.language;
    switch (lang) {
      case 'en': return event.description_en || event.description_uz;
      case 'ru': return event.description_ru || event.description_uz;
      case 'ko': return event.description_ko || event.description_uz;
      default: return event.description_uz;
    }
  };

  // Get dates with events for calendar highlighting
  const eventDates = events.map(e => new Date(e.event_date));

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const upcomingEvents = getUpcomingEvents(5);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t('room.calendar', 'Taqvim')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={getLocale()}
            className="rounded-md border"
            modifiers={{
              hasEvent: eventDates
            }}
            modifiersStyles={{
              hasEvent: {
                backgroundColor: 'hsl(var(--primary) / 0.1)',
                borderRadius: '50%',
                fontWeight: 'bold'
              }
            }}
          />
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(['tuition_payment', 'interview', 'deadline', 'orientation', 'other'] as EventType[]).map(type => (
              <div key={type} className="flex items-center gap-1 text-xs">
                <div className={`w-2 h-2 rounded-full ${getEventTypeColor(type)}`} />
                <span>{getEventTypeLabel(type)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Events panel */}
      <div className="space-y-6">
        {/* Selected date events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: getLocale() })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t('room.noEventsOnDate', 'Bu sanada voqealar yo\'q')}
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className={`p-2 rounded-full ${getEventTypeColor(event.event_type)} text-white`}>
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{getLocalizedTitle(event)}</h4>
                      {getLocalizedDescription(event) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getLocalizedDescription(event)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={getEventTypeTextColor(event.event_type)}>
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                        {!event.is_all_day && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.event_date), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('room.upcomingEvents', 'Kelayotgan voqealar')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              {upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t('room.noEvents', 'Voqealar yo\'q')}
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedDate(new Date(event.event_date))}
                    >
                      <div className={`w-1 h-10 rounded-full ${getEventTypeColor(event.event_type)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{getLocalizedTitle(event)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.event_date), 'd MMM, HH:mm', { locale: getLocale() })}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {getEventTypeLabel(event.event_type)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
