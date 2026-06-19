import { lazy, Suspense, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, Search, Bot, Loader2 } from 'lucide-react';

const UniversitiesManageTab = lazy(() => import('./UniversitiesManageTab'));
const ProgramFinderContent = lazy(() => import('./ProgramFinderContent'));
const AiCrawlMonitorContent = lazy(() => import('./AiCrawlMonitorContent'));

const Fallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

interface Props {
  isOwner?: boolean;
  isAdmin?: boolean;
}

export default function UniversitiesContent({ isOwner, isAdmin }: Props) {
  const canSeeCrawl = isOwner || isAdmin;
  const [tab, setTab] = useState('search');

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-4 w-4" />
            Dastur Qidiruv
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Boshqaruv
          </TabsTrigger>
          {canSeeCrawl && (
            <TabsTrigger value="ai-crawl" className="gap-1.5">
              <Bot className="h-4 w-4" />
              AI Crawl
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <Suspense fallback={<Fallback />}>
            <ProgramFinderContent />
          </Suspense>
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <Suspense fallback={<Fallback />}>
            <UniversitiesManageTab />
          </Suspense>
        </TabsContent>

        {canSeeCrawl && (
          <TabsContent value="ai-crawl" className="mt-4">
            <Suspense fallback={<Fallback />}>
              <AiCrawlMonitorContent />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
