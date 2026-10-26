import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BASE, TABS, tabOf } from '@/components/crm/appAnalytics/helpers';

const MarketingTab = lazy(() => import('@/components/crm/appAnalytics/MarketingTab'));
const AppActivityContent = lazy(() => import('@/components/crm/pages/AppActivityContent'));
const PeopleTab = lazy(() => import('@/components/crm/appAnalytics/PeopleTab'));
const LiveTab = lazy(() => import('@/components/crm/appAnalytics/LiveTab'));
const QualityTab = lazy(() => import('@/components/crm/appAnalytics/QualityTab'));
const SettingsTab = lazy(() => import('@/components/crm/appAnalytics/SettingsTab'));

/**
 * "Ilova analitikasi" — the student app's analytics, in place of "Ilova
 * faolligi". Every staff member sees it (S6); investors do not. Test devices
 * are left out unless a page is asked to include them (S10).
 */
export default function AppAnalyticsContent() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabOf(location.pathname);

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">{t('appAnalytics.title')}</h1>
        <p className="text-[12.5px] text-muted-foreground">{t('appAnalytics.subtitle')}</p>
      </header>
      <Tabs value={tab} onValueChange={(v) => navigate(v === 'marketing' ? BASE : `${BASE}/${v}`)}>
        <TabsList>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`appAnalytics.tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <Suspense fallback={<p className="p-4 text-[13px] text-muted-foreground">{t('appActivity.loading')}</p>}>
          <TabsContent value="marketing">
            <MarketingTab />
          </TabsContent>
          <TabsContent value="overview">
            <AppActivityContent embedded />
          </TabsContent>
          <TabsContent value="people">
            <PeopleTab />
          </TabsContent>
          <TabsContent value="live">
            <LiveTab />
          </TabsContent>
          <TabsContent value="quality">
            <QualityTab />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
