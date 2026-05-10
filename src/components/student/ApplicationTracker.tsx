import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProcessTracker } from './ProcessTracker';
import { UniversityRoom } from './UniversityRoom';
import { Tables } from '@/integrations/supabase/types';
import { GraduationCap, MessageSquare, Megaphone, CalendarDays, MapPin } from 'lucide-react';

type Application = Tables<'applications'> & {
  university?: Tables<'universities'>;
};

interface ApplicationTrackerProps {
  applications: Application[];
  loading?: boolean;
  hideRoomEntry?: boolean;
  onShowOnMap?: (universityId: string) => void;
}

export function ApplicationTracker({ applications, loading, hideRoomEntry = false, onShowOnMap }: ApplicationTrackerProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'uz' | 'ko' | 'ru' | 'en';
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('status');

  const getUniversityName = (university?: Tables<'universities'>) => {
    if (!university) return 'Unknown University';
    const nameKey = `name_${currentLang}` as keyof Tables<'universities'>;
    return (university[nameKey] as string) || university.name_uz || 'Unknown University';
  };

  const getCityName = (university?: Tables<'universities'>) => {
    if (!university) return '';
    const cityKey = `city_${currentLang}` as keyof Tables<'universities'>;
    return (university[cityKey] as string) || university.city_uz || '';
  };

  const handleOpenRoom = (application: Application, tab = 'status') => {
    setSelectedApplication(application);
    setInitialTab(tab);
    setRoomOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><div className="h-6 bg-muted rounded w-1/2" /></CardHeader>
            <CardContent><div className="h-20 bg-muted rounded w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('student.pending')}...</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('navigation.applications')} {t('common.none').toLowerCase()}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <Card key={application.id} className="overflow-hidden">
          {/* Header */}
          <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div 
                  className={cn("flex items-center gap-3", onShowOnMap && "cursor-pointer hover:opacity-80 transition-opacity")}
                  onClick={() => onShowOnMap && application.institution_id && onShowOnMap(application.institution_id)}
                >
                  {application.university?.logo_url ? (
                    <img
                      src={application.university.logo_url}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base">
                      {getUniversityName(application.university)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {getCityName(application.university)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onShowOnMap && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => application.institution_id && onShowOnMap(application.institution_id)}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  )}
                  {application.university?.is_partner && (
                    <Badge variant="highlight" className="text-[10px]">
                      {t('universities.partner', 'Hamkor')}
                    </Badge>
                  )}
                </div>
              </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Process Tracker - delivery style */}
            <ProcessTracker currentStatus={application.status} compact />

            {/* Quick Access Buttons */}
            {!hideRoomEntry && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => handleOpenRoom(application, 'discussion')}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  {t('room.discussion', 'Muhokama')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => handleOpenRoom(application, 'announcements')}
                >
                  <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                  {t('room.announcements', 'E\'lonlar')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => handleOpenRoom(application, 'calendar')}
                >
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                  {t('room.calendar', 'Taqvim')}
                </Button>
              </div>
            )}

            {hideRoomEntry && (
              <div className="pt-2 border-t">
                {application.notes && (
                  <p className="text-sm text-muted-foreground">{application.notes}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* University Room Dialog */}
      {selectedApplication && (
        <UniversityRoom
          open={roomOpen}
          onOpenChange={setRoomOpen}
          application={selectedApplication}
          initialTab={initialTab}
        />
      )}
    </div>
  );
}
