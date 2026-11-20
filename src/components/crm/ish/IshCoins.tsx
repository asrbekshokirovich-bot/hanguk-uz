import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Coins, Search } from 'lucide-react';
import type { IshCoinWorker } from '@/lib/ish/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ishErrorText, ishKeys, useIshApi } from './context';

/**
 * «Puyl»: a worker pays Hanguk outside the app, the staff add the puyl here;
 * opening a job's phone and address spends it (never refunded).
 * Find the worker by name or phone, see the balance and the last moves.
 */
export function IshCoins() {
  const { t } = useTranslation();
  const api = useIshApi();
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const list = useQuery({ queryKey: ishKeys.coins(query), queryFn: () => api.coinWorkers(query) });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('ish.coins.intro')}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(typed);
        }}
      >
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('ish.coins.search')}
          aria-label={t('ish.coins.search')}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline" aria-label={t('ish.coins.search')}>
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : list.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{ishErrorText(t, list.error)}</CardContent>
        </Card>
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{t('ish.coins.empty')}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(list.data ?? []).map((w) => (
            <CoinWorkerCard key={w.id} worker={w} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

function CoinWorkerCard({ worker, query }: { worker: IshCoinWorker; query: string }) {
  const { t, i18n } = useTranslation();
  const api = useIshApi();
  const client = useQueryClient();
  const [amount, setAmount] = useState('1');
  const [note, setNote] = useState('');
  const name = `${worker.first_name} ${worker.last_name}`.trim() || '–';

  const change = useMutation({
    mutationFn: (delta: number) => api.addCoins(worker.id, delta, note),
    onSuccess: (balance) => {
      toast.success(t('ish.coins.done', { balance }));
      setNote('');
      void client.invalidateQueries({ queryKey: ishKeys.coins(query) });
    },
    onError: (error) => toast.error(ishErrorText(t, error)),
  });
  const n = Number.parseInt(amount, 10);
  const valid = Number.isInteger(n) && n > 0 && n <= 1000;

  return (
    <Card data-testid={`ish-coins-${worker.id}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">{name}</div>
            <div className="text-sm text-muted-foreground">{worker.phone || '–'}</div>
          </div>
          <div className="flex items-center gap-1.5 text-lg font-bold" aria-label={t('ish.coins.balance')}>
            <Coins className="h-5 w-5 text-primary" />
            {worker.balance}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="number"
            min={1}
            max={1000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t('ish.coins.amount')}
            className="w-24"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={t('ish.coins.note')}
            aria-label={t('ish.coins.note')}
            className="min-w-40 flex-1"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={!valid || change.isPending} onClick={() => change.mutate(n)}>
            {t('ish.coins.add')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!valid || change.isPending || worker.balance < n}
            onClick={() => change.mutate(-n)}
          >
            {t('ish.coins.take')}
          </Button>
        </div>
        {worker.history.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{t('ish.coins.last')}</div>
            {worker.history.map((m, i) => (
              <div key={i} className="flex justify-between gap-2 text-xs">
                <span>
                  {new Date(m.created_at).toLocaleDateString(i18n.language, { timeZone: 'Asia/Seoul' })} ·{' '}
                  {t(`ish.coins.reasons.${m.reason}`)}
                  {m.note ? ` · ${m.note}` : ''}
                </span>
                <span className={m.delta > 0 ? 'font-semibold text-green-600' : 'font-semibold text-destructive'}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
