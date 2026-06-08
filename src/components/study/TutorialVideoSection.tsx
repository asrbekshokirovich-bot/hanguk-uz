import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PlayCircle,
  ChevronDown,
  Clock,
  Video,
  BookOpen,
  Lightbulb,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { TutorialVideo, getVideosByDocumentType } from '@/data/tutorialVideos';
import { cn } from '@/lib/utils';

interface TutorialVideoSectionProps {
  documentType: 'study_plan' | 'personal_statement';
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  introduction: BookOpen,
  structure: FileText,
  grammar: GraduationCap,
  examples: Video,
  tips: Lightbulb,
};

const categoryColors: Record<string, string> = {
  introduction: 'bg-info/10 text-info dark:bg-info dark:text-info',
  structure: 'bg-success/10 text-success dark:bg-success dark:text-success',
  grammar: 'bg-primary/10 text-primary dark:bg-primary dark:text-primary',
  examples: 'bg-warning/10 text-warning dark:bg-warning dark:text-warning',
  tips: 'bg-primary/10 text-primary dark:bg-primary dark:text-primary',
};

export function TutorialVideoSection({ documentType }: TutorialVideoSectionProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'en' | 'uz' | 'ru' | 'ko';
  
  const [isOpen, setIsOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);

  const videos = useMemo(() => getVideosByDocumentType(documentType), [documentType]);

  const getLocalizedText = (textMap: Record<string, string>) => {
    return textMap[currentLang] || textMap.en || Object.values(textMap)[0];
  };

  const groupedVideos = useMemo(() => {
    const groups: Record<string, TutorialVideo[]> = {};
    videos.forEach(video => {
      if (!groups[video.category]) {
        groups[video.category] = [];
      }
      groups[video.category].push(video);
    });
    return groups;
  }, [videos]);

  return (
    <>
      <Card className="border-primary/20">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('study.videoTutorials', 'Video Tutorials')}</CardTitle>
                    <CardDescription className="text-xs">
                      {t('study.watchAndLearn', 'Watch tutorials to improve your writing')}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{videos.length} {t('study.videos', 'videos')}</Badge>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {Object.entries(groupedVideos).map(([category, categoryVideos]) => {
                const Icon = categoryIcons[category] || Video;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={cn('capitalize', categoryColors[category])}>
                        <Icon className="h-3 w-3 mr-1" />
                        {t(`study.category.${category}`, category)}
                      </Badge>
                    </div>
                    <ScrollArea className="w-full">
                      <div className="flex gap-3 pb-3">
                        {categoryVideos.map(video => (
                          <VideoCard
                            key={video.id}
                            video={video}
                            currentLang={currentLang}
                            onClick={() => setSelectedVideo(video)}
                          />
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              {selectedVideo && getLocalizedText(selectedVideo.title)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {/* Privacy-enhanced YouTube embed */}
                {selectedVideo.youtubeId.startsWith('placeholder') ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Video className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">{t('study.videoComingSoon', 'Video coming soon')}</p>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?rel=0`}
                    title={getLocalizedText(selectedVideo.title)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {getLocalizedText(selectedVideo.description)}
              </p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {selectedVideo.duration}
                </span>
                <span>
                  {selectedVideo.language === 'ko' ? '🇰🇷 Korean' : '🇺🇸 English'}
                </span>
                {selectedVideo.subtitles.length > 0 && (
                  <span>
                    {t('study.subtitles', 'Subtitles')}: {selectedVideo.subtitles.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface VideoCardProps {
  video: TutorialVideo;
  currentLang: string;
  onClick: () => void;
}

function VideoCard({ video, currentLang, onClick }: VideoCardProps) {
  const getLocalizedText = (textMap: Record<string, string>) => {
    return textMap[currentLang] || textMap.en || Object.values(textMap)[0];
  };

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-64 group text-left"
    >
      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2">
        {video.youtubeId.startsWith('placeholder') ? (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <img
            src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
            alt={getLocalizedText(video.title)}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <PlayCircle className="h-12 w-12 text-white" />
        </div>
        <Badge className="absolute bottom-2 right-2 bg-black/70 text-white">
          {video.duration}
        </Badge>
      </div>
      <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
        {getLocalizedText(video.title)}
      </h4>
      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
        {getLocalizedText(video.description)}
      </p>
    </button>
  );
}
