import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Instagram,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';

type ConnectionState = 'checking' | 'connected' | 'partial' | 'not_configured' | 'unknown';

interface IntegrationStatus {
  state: ConnectionState;
  detail?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function webhookUrl(fn: string) {
  return `${SUPABASE_URL}/functions/v1/${fn}`;
}

async function probe(fn: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(webhookUrl(fn), {
      headers: PUBLISHABLE_KEY ? { apikey: PUBLISHABLE_KEY } : undefined,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status.state === 'checking') {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
      </Badge>
    );
  }
  if (status.state === 'connected') {
    return (
      <Badge className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/10">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
    );
  }
  if (status.state === 'partial') {
    return (
      <Badge className="gap-1 bg-amber-500/10 text-amber-600 hover:bg-amber-500/10">
        <AlertTriangle className="h-3 w-3" /> Needs setup
      </Badge>
    );
  }
  if (status.state === 'not_configured') {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <AlertTriangle className="h-3 w-3" /> Not configured
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <HelpCircle className="h-3 w-3" /> Unknown
    </Badge>
  );
}

export default function IntegrationsSettings() {
  const { toast } = useToast();
  const [instagram, setInstagram] = useState<IntegrationStatus>({ state: 'checking' });
  const [telegram, setTelegram] = useState<IntegrationStatus>({ state: 'checking' });
  const [refreshing, setRefreshing] = useState(false);

  const check = useCallback(async () => {
    setRefreshing(true);
    setInstagram({ state: 'checking' });
    setTelegram({ state: 'checking' });

    const [ig, tg] = await Promise.all([probe('instagram-webhook'), probe('telegram-webhook')]);

    if (!ig) {
      setInstagram({ state: 'unknown', detail: 'Could not reach the webhook function.' });
    } else {
      const hasToken = !!ig.access_token_configured;
      const hasVerify = !!ig.verify_token_configured;
      if (hasToken && hasVerify) setInstagram({ state: 'connected' });
      else if (hasToken || hasVerify) setInstagram({ state: 'partial', detail: 'One secret is still missing.' });
      else setInstagram({ state: 'not_configured' });
    }

    if (!tg) {
      setTelegram({ state: 'unknown', detail: 'Could not reach the webhook function.' });
    } else {
      setTelegram({ state: tg.configured ? 'connected' : 'not_configured' });
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied', description: 'Webhook URL copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: value, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Connect messaging channels so client conversations land in your CRM inbox.
        </p>
        <Button variant="outline" size="sm" onClick={check} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Recheck
        </Button>
      </div>

      {/* Instagram */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 text-white">
                <Instagram className="h-5 w-5" />
              </span>
              Instagram Direct
            </CardTitle>
            <StatusBadge status={instagram} />
          </div>
          <CardDescription>
            Receive Instagram DMs in the inbox and reply to clients without leaving the CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Webhook callback URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-xs">
                {webhookUrl('instagram-webhook')}
              </code>
              <Button variant="outline" size="icon" onClick={() => copy(webhookUrl('instagram-webhook'))}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {instagram.detail && (
              <p className="text-xs text-amber-600">{instagram.detail}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <p className="font-medium">Setup steps</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Connect an Instagram Professional account to your Meta app (Instagram → API setup with Instagram login).</li>
              <li>
                Add the URL above as the webhook callback and subscribe to the <code className="text-xs">messages</code> field.
              </li>
              <li>
                Set the Supabase secrets <code className="text-xs">INSTAGRAM_VERIFY_TOKEN</code>,{' '}
                <code className="text-xs">INSTAGRAM_ACCESS_TOKEN</code> and{' '}
                <code className="text-xs">INSTAGRAM_APP_SECRET</code>.
              </li>
              <li>Use the same verify token in Meta as the one set in the secret, then press “Verify and save”.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
                <Send className="h-5 w-5" />
              </span>
              Telegram
            </CardTitle>
            <StatusBadge status={telegram} />
          </div>
          <CardDescription>
            Route Telegram bot messages into the same unified inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Webhook callback URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-xs">
                {webhookUrl('telegram-webhook')}
              </code>
              <Button variant="outline" size="icon" onClick={() => copy(webhookUrl('telegram-webhook'))}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {telegram.detail && <p className="text-xs text-amber-600">{telegram.detail}</p>}
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Set the <code className="text-xs">TELEGRAM_BOT_TOKEN</code> secret, then register the URL above with
            BotFather’s <code className="text-xs">setWebhook</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
