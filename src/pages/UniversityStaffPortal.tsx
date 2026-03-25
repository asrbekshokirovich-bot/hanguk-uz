import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useUniversityStaffData } from '@/hooks/useUniversityStaffData';
import { useUniversityAnnouncements } from '@/hooks/useUniversityAnnouncements';
import { useUniversityRoom } from '@/hooks/useUniversityRoom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RoomChat } from '@/components/student/RoomChat';
import { AnnouncementFeed } from '@/components/student/AnnouncementFeed';
import { UniversityCalendar } from '@/components/student/UniversityCalendar';
import { ProcessTracker } from '@/components/student/ProcessTracker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  GraduationCap, Users, FileText, Megaphone, MessageSquare, CalendarDays,
  LogOut, Plus, Send, Phone, ChevronRight
} from 'lucide-react';

export default function UniversityStaffPortal() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole();
  const { assignment, university, applicants, roomId, loading } = useUniversityStaffData();
  const { createAnnouncement } = useUniversityAnnouncements(roomId);
  const { channels, getChannelByType } = useUniversityRoom(university?.id || null);

  const [activeTab, setActiveTab] = useState('applicants');
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState('normal');
  const [sending, setSending] = useState(false);

  const currentLang = i18n.language as 'uz' | 'ko' | 'ru' | 'en';

  useEffect(() => {
    if (!authLoading && !roleLoading && user && !hasRole('university_staff')) {
      navigate('/');
    }
  }, [user, authLoading, roleLoading, hasRole, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handlePostAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) return;
    setSending(true);
    const success = await createAnnouncement({
      title: annTitle,
      content: annContent,
      priority: annPriority,
    });
    if (success) {
      toast.success(t('announcements.posted', 'E\'lon joylandi'));
      setAnnTitle('');
      setAnnContent('');
      setAnnouncementOpen(false);
    } else {
      toast.error(t('common.error'));
    }
    setSending(false);
  };

  const getUniversityName = () => {
    if (!university) return '';
    const nameKey = `name_${currentLang}` as keyof typeof university;
    return (university[nameKey] as string) || university.name_uz || '';
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <GraduationCap className="h-16 w-16 text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!assignment || !university) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('uniStaff.noAssignment', 'Sizga universitet tayinlanmagan')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const discussionChannel = getChannelByType('discussion');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            {university.logo_url ? (
              <img src={university.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-primary">{getUniversityName()}</h1>
              <p className="text-xs text-muted-foreground">
                {assignment.title || t('uniStaff.representative', 'Universitet vakili')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('auth.logout')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{applicants.length}</p>
                <p className="text-xs text-muted-foreground">{t('uniStaff.totalApplicants', 'Arizachilar')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">
                  {applicants.reduce((sum, a) => sum + a.documents.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">{t('navigation.documents', 'Hujjatlar')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Megaphone className="h-5 w-5 mx-auto text-primary mb-1" />
                <Button size="sm" variant="outline" className="mt-1" onClick={() => setAnnouncementOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  {t('announcements.post', 'E\'lon')}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <MessageSquare className="h-5 w-5 mx-auto text-primary mb-1" />
                <Button size="sm" variant="outline" className="mt-1" onClick={() => setActiveTab('chat')}>
                  {t('room.discussion', 'Muhokama')}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="applicants" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('uniStaff.applicants', 'Arizachilar')}
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
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

            <TabsContent value="applicants">
              <div className="space-y-3">
                {applicants.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {t('uniStaff.noApplicants', 'Hali arizachilar yo\'q')}
                    </CardContent>
                  </Card>
                ) : (
                  applicants.map(({ application, profile, documents }) => (
                    <Card key={application.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {(profile?.full_name || '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                              {profile?.phone && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {profile.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {documents.length} {t('navigation.documents', 'hujjat')}
                          </Badge>
                        </div>

                        <ProcessTracker currentStatus={application.status} compact />

                        {documents.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              {t('navigation.documents', 'Hujjatlar')}:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {documents.slice(0, 4).map(doc => (
                                <Badge
                                  key={doc.id}
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-primary/20"
                                  onClick={async () => {
                                    const { data: signedData } = await supabase.storage
                                      .from('student-documents')
                                      .createSignedUrl(doc.file_path, 3600);
                                    if (signedData?.signedUrl) {
                                      window.open(signedData.signedUrl, '_blank');
                                    }
                                  }}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  {doc.name}
                                </Badge>
                              ))}
                              {documents.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{documents.length - 4}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="h-[60vh]">
              <Card className="h-full">
                <RoomChat
                  channelId={discussionChannel?.id || null}
                  isReadOnly={false}
                  channelName={t('room.discussion', 'Muhokama')}
                />
              </Card>
            </TabsContent>

            <TabsContent value="announcements" className="h-[60vh]">
              <Card className="h-full overflow-hidden flex flex-col">
                <CardHeader className="pb-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t('room.announcements', 'E\'lonlar')}</CardTitle>
                    <Button size="sm" onClick={() => setAnnouncementOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      {t('announcements.post', 'Yangi e\'lon')}
                    </Button>
                  </div>
                </CardHeader>
                <div className="flex-1 overflow-hidden">
                  <AnnouncementFeed roomId={roomId} />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="calendar">
              <Card>
                <UniversityCalendar roomId={roomId} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Announcement Dialog */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('announcements.newAnnouncement', 'Yangi e\'lon')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('announcements.title', 'Sarlavha')}</Label>
              <Input value={annTitle} onChange={e => setAnnTitle(e.target.value)} />
            </div>
            <div>
              <Label>{t('common.description', 'Tavsif')}</Label>
              <Textarea value={annContent} onChange={e => setAnnContent(e.target.value)} rows={4} />
            </div>
            <div>
              <Label>{t('announcements.priority', 'Muhimlik')}</Label>
              <Select value={annPriority} onValueChange={setAnnPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('tasks.low', 'Past')}</SelectItem>
                  <SelectItem value="normal">{t('tasks.normal', 'Oddiy')}</SelectItem>
                  <SelectItem value="high">{t('tasks.high', 'Yuqori')}</SelectItem>
                  <SelectItem value="urgent">{t('tasks.urgent', 'Shoshilinch')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePostAnnouncement} disabled={sending || !annTitle.trim() || !annContent.trim()} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {t('announcements.post', 'Joylash')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
