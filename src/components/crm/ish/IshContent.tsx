import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Briefcase, Loader2, ShieldAlert } from 'lucide-react';
import { ishClient } from '@/lib/ish/client';
import { ishApi } from '@/lib/ish/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IshApiProvider, ishKeys, useIshApi } from './context';
import { IshAppBusinesses } from './IshAppBusinesses';
import { IshBoard } from './IshBoard';
import { IshEmployers } from './IshEmployers';
import { IshJobDetail } from './IshJobDetail';
import { IshReports } from './IshReports';

/**
 * CRM → «Hanguk Ish» (P41): Hanguk's staff keep employers found outside the
 * app (Telegram groups and channels), post their jobs, offer them to workers
 * who fit, confirm after the call with the employer, mark who came and that
 * they were paid. Plan: hanguk_ish/docs/operator-reja.md.
 *
 * Hanguk Ish is the schema `ish` of hanguk.uz's own project (P48): the staff
 * work with their hanguk.uz session; the database says who is staff.
 */
export default function IshContent() {
  return <IshSection client={ishClient()} />;
}

/** The section on [client] (hanguk.uz's): the staff check, then the work. */
export function IshSection({ client }: { client: SupabaseClient }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    client.auth.getSession().then(({ data }) => live && setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  if (session === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">{t('ish.errors.NOT_AUTHENTICATED')}</CardContent>
      </Card>
    );
  }
  return <IshStaffGate client={client} session={session} />;
}

function IshStaffGate({ client, session }: { client: SupabaseClient; session: Session }) {
  const { t } = useTranslation();
  const api = useMemo(() => ishApi(client), [client]);
  const staff = useQuery({ queryKey: [...ishKeys.staff, session.user.id], queryFn: api.isStaff });
  const account =
    session.user.email || (session.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : session.user.id);

  if (staff.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (staff.data !== true) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{staff.isError ? t('ish.errors.UNKNOWN') : t('ish.notStaff', { account })}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <IshApiProvider api={api}>
      <IshWorkspace account={account} />
    </IshApiProvider>
  );
}

const TABS = ['jobs', 'employers', 'appBusinesses', 'reports'] as const;

/** «/crm/ish?tab=reports»: a Hanguk Ish message to the staff (P57) opens its tab. */
function initialTab(): string {
  const wanted = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tab');
  return wanted && (TABS as readonly string[]).includes(wanted) ? wanted : 'jobs';
}

function IshWorkspace({ account }: { account: string }) {
  const { t } = useTranslation();
  const api = useIshApi();
  const [jobId, setJobId] = useState<string | null>(null);
  const [tab, setTab] = useState(initialTab);
  // The complaints not closed yet, on the tab (P52).
  const reports = useQuery({ queryKey: ishKeys.reports, queryFn: api.reports });
  const open = (reports.data ?? []).filter((r) => r.status !== 'closed').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('ish.title')}</h2>
        </div>
        <div className="text-sm text-muted-foreground">{t('ish.signedInAs', { account })}</div>
      </div>
      {jobId ? (
        <IshJobDetail jobId={jobId} onBack={() => setJobId(null)} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="jobs">{t('ish.tabs.jobs')}</TabsTrigger>
            <TabsTrigger value="employers">{t('ish.tabs.employers')}</TabsTrigger>
            <TabsTrigger value="appBusinesses">{t('ish.tabs.appBusinesses')}</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              {t('ish.tabs.reports')}
              {open > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {open}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="jobs" className="mt-4">
            <IshBoard onOpen={setJobId} />
          </TabsContent>
          <TabsContent value="employers" className="mt-4">
            <IshEmployers />
          </TabsContent>
          <TabsContent value="appBusinesses" className="mt-4">
            <IshAppBusinesses />
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
            <IshReports />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
