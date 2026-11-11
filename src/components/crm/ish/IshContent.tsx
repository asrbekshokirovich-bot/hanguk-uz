import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Briefcase, Loader2, LogOut, PlugZap, ShieldAlert } from 'lucide-react';
import { ishClient } from '@/lib/ish/client';
import { ishApi } from '@/lib/ish/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IshApiProvider, ishKeys } from './context';
import { IshBoard } from './IshBoard';
import { IshEmployers } from './IshEmployers';
import { IshJobDetail } from './IshJobDetail';

/**
 * CRM → «Hanguk Ish» (P41): Hanguk's staff keep employers found outside the
 * app (Telegram groups and channels), post their jobs, offer them to workers
 * who fit, confirm after the call with the employer, mark who came and that
 * they were paid. Plan: hanguk_ish/docs/operator-reja.md.
 */
export default function IshContent() {
  const client = ishClient();
  if (!client) return <IshNotConfigured />;
  return <IshSection client={client} />;
}

export function IshNotConfigured() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <PlugZap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">{t('ish.notConfigured.title')}</h2>
        <p className="text-muted-foreground">{t('ish.notConfigured.text')}</p>
      </CardContent>
    </Card>
  );
}

/** The section on [client]: sign-in, the staff check, then the work. */
export function IshSection({ client }: { client: SupabaseClient }) {
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
  if (!session) return <IshLogin client={client} />;
  return <IshStaffGate client={client} session={session} />;
}

function IshStaffGate({ client, session }: { client: SupabaseClient; session: Session }) {
  const { t } = useTranslation();
  const api = useMemo(() => ishApi(client), [client]);
  const staff = useQuery({ queryKey: [...ishKeys.staff, session.user.id], queryFn: api.isStaff });
  const signOut = () => void client.auth.signOut();
  const phone = session.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : session.user.email ?? '';

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
          <p className="text-muted-foreground">{staff.isError ? t('ish.errors.UNKNOWN') : t('ish.notStaff', { phone })}</p>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('ish.signOut')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <IshApiProvider api={api}>
      <IshWorkspace phone={phone} onSignOut={signOut} />
    </IshApiProvider>
  );
}

function IshWorkspace({ phone, onSignOut }: { phone: string; onSignOut: () => void }) {
  const { t } = useTranslation();
  const [jobId, setJobId] = useState<string | null>(null);
  const [tab, setTab] = useState('jobs');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('ish.title')}</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('ish.signedInAs', { phone })}</span>
          <Button size="sm" variant="ghost" onClick={onSignOut}>
            <LogOut className="mr-1 h-4 w-4" />
            {t('ish.signOut')}
          </Button>
        </div>
      </div>
      {jobId ? (
        <IshJobDetail jobId={jobId} onBack={() => setJobId(null)} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="jobs">{t('ish.tabs.jobs')}</TabsTrigger>
            <TabsTrigger value="employers">{t('ish.tabs.employers')}</TabsTrigger>
          </TabsList>
          <TabsContent value="jobs" className="mt-4">
            <IshBoard onOpen={setJobId} />
          </TabsContent>
          <TabsContent value="employers" className="mt-4">
            <IshEmployers />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** Phone and SMS code, as in the apps. */
export function IshLogin({ client }: { client: SupabaseClient }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('+998');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = `+${phone.replace(/\D/g, '')}`;
  const phoneOk = /^\+\d{9,15}$/.test(normalized);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (e) setError(t('ish.login.failed', { error: e.message }));
    else setSentTo(normalized);
  };

  const verify = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.verifyOtp({ phone: sentTo, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (e) setError(t('ish.login.failed', { error: e.message }));
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t('ish.login.title')}</CardTitle>
        <CardDescription>{t('ish.login.text')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sentTo === null ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (phoneOk && !busy) void send();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ish-phone">{t('ish.login.phone')}</Label>
              <Input id="ish-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('ish.login.phoneHint')}</p>
            </div>
            <Button type="submit" className="w-full" disabled={!phoneOk || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ish.login.sendCode')}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length >= 4 && !busy) void verify();
            }}
          >
            <p className="text-sm text-muted-foreground">{t('ish.login.codeSent', { phone: sentTo })}</p>
            <div className="space-y-1.5">
              <Label htmlFor="ish-code">{t('ish.login.code')}</Label>
              <Input
                id="ish-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={code.trim().length < 4 || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ish.login.verify')}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setSentTo(null);
                setCode('');
              }}
            >
              {t('ish.login.change')}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
