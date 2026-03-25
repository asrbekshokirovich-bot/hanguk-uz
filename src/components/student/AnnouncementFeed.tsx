import { useTranslation } from 'react-i18next';
import { useUniversityAnnouncements } from '@/hooks/useUniversityAnnouncements';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, Paperclip, Megaphone, AlertTriangle, Info, Bell } from 'lucide-react';
import { format } from 'date-fns';

interface AnnouncementFeedProps {
  roomId: string | null;
}

// Issue 11: priority labels are now translated via i18n keys
const getPriorityConfig = (t: (key: string, fallback: string) => string) => ({
  urgent: { color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle, label: t('tasks.urgent', 'Urgent') },
  high: { color: 'bg-orange-500 text-white', icon: Bell, label: t('tasks.high', 'High') },
  normal: { color: 'bg-primary text-primary-foreground', icon: Info, label: t('tasks.normal', 'Normal') },
  low: { color: 'bg-muted text-muted-foreground', icon: Info, label: t('tasks.low', 'Low') },
});

export function AnnouncementFeed({ roomId }: AnnouncementFeedProps) {
  const { t } = useTranslation();
  const { announcements, loading } = useUniversityAnnouncements(roomId);
  const priorityConfig = getPriorityConfig(t);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
        <Megaphone className="h-12 w-12 mb-4 opacity-50" />
        <p>{t('announcements.none', 'Hali e\'lonlar yo\'q')}</p>
      </div>
    );
  }

  // Issue 13: removed duplicate sort - already sorted by hook

  return (
    <div className="p-4 space-y-3 overflow-auto h-full">
      {announcements.map((announcement) => {
        const priority = priorityConfig[announcement.priority as keyof typeof priorityConfig] || priorityConfig.normal;
        const PriorityIcon = priority.icon;

        return (
          <Card
            key={announcement.id}
            className={`overflow-hidden ${announcement.is_pinned ? 'border-primary/50 bg-primary/5' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {announcement.is_pinned && (
                    <Pin className="h-3 w-3 text-primary" />
                  )}
                  <Badge className={priority.color}>
                    <PriorityIcon className="h-3 w-3 mr-1" />
                    {priority.label}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(announcement.created_at), 'dd.MM.yyyy HH:mm')}
                </span>
              </div>

              <h4 className="font-semibold text-sm mb-1">{announcement.title}</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{announcement.content}</p>

              {announcement.attachment_url && (
                <a
                  href={announcement.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                >
                  <Paperclip className="h-3 w-3" />
                  {announcement.attachment_name || t('announcements.attachment', 'Fayl')}
                </a>
              )}

              {announcement.poster_name && (
                <p className="text-xs text-muted-foreground mt-2">
                  — {announcement.poster_name}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
