import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useUniversityRoom } from '@/hooks/useUniversityRoom';
import { RoomChat } from './RoomChat';
import { UniversityCalendar } from './UniversityCalendar';
import { ProcessTracker } from './ProcessTracker';
import { AnnouncementFeed } from './AnnouncementFeed';
import { Tables } from '@/integrations/supabase/types';
import { Info, MessageSquare, Megaphone, CalendarDays, Users } from 'lucide-react';

type Application = Tables<'applications'> & {
  university?: Tables<'universities'>;
};

interface UniversityRoomProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application;
  initialTab?: string;
}

export function UniversityRoom({ open, onOpenChange, application, initialTab = 'status' }: UniversityRoomProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Issue 6: keep activeTab in sync with initialTab prop
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const { room, channels, members, loading, getChannelByType } = useUniversityRoom(
    application.university_id
  );

  const discussionChannel = getChannelByType('discussion');

  const getUniversityName = () => {
    const uni = application.university;
    if (!uni) return 'Unknown University';
    switch (i18n.language) {
      case 'en': return uni.name_en || uni.name_uz;
      case 'ru': return uni.name_ru || uni.name_uz;
      case 'ko': return uni.name_ko || uni.name_uz;
      default: return uni.name_uz;
    }
  };

  const getChannelName = (type: 'discussion' | 'announcement') => {
    const channel = getChannelByType(type);
    if (!channel) return type;
    switch (i18n.language) {
      case 'en': return channel.name_en || channel.name_uz;
      case 'ru': return channel.name_ru || channel.name_uz;
      case 'ko': return channel.name_ko || channel.name_uz;
      default: return channel.name_uz;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {application.university?.logo_url ? (
                <img 
                  src={application.university.logo_url} 
                  alt={getUniversityName()}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">
                    {getUniversityName().charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <DialogTitle className="text-lg">{getUniversityName()}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{members.length} {t('room.members', 'a\'zo')}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start px-4 shrink-0">
              <TabsTrigger value="status" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('room.status', 'Holat')}
              </TabsTrigger>
              <TabsTrigger value="discussion" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('room.discussion', 'Muhokama')}
              </TabsTrigger>
              <TabsTrigger value="announcements" className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                {t('room.announcements', 'E\'lonlar')}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {t('room.calendar', 'Taqvim')}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="status" className="h-full m-0 overflow-auto p-4">
                <ProcessTracker currentStatus={application.status} />
                {application.notes && (
                  <p className="text-sm text-muted-foreground mt-4">{application.notes}</p>
                )}
              </TabsContent>

              <TabsContent value="discussion" className="h-full m-0">
                <RoomChat 
                  channelId={discussionChannel?.id || null} 
                  isReadOnly={false}
                  channelName={getChannelName('discussion')}
                />
              </TabsContent>

              <TabsContent value="announcements" className="h-full m-0">
                <AnnouncementFeed roomId={room?.id || null} />
              </TabsContent>

              <TabsContent value="calendar" className="h-full m-0 overflow-auto">
                <UniversityCalendar roomId={room?.id || null} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
