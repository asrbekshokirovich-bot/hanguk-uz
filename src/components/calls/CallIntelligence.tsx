import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Flag,
} from 'lucide-react';

interface CallIntelligenceProps {
  callId: string;
}

interface TranscriptSegment {
  speaker: string;
  start: number | null;
  end: number | null;
  text: string;
}

interface Transcript {
  provider: string;
  language_code: string | null;
  full_text: string | null;
  segments: TranscriptSegment[] | null;
  word_count: number | null;
}

interface Analysis {
  summary_uz: string | null;
  summary_en: string | null;
  intent: string | null;
  sentiment: string | null;
  topics: string[] | null;
  action_items: { text: string; owner?: string; due?: string }[] | null;
  promises: { text: string; by?: string }[] | null;
  risk_flags: string[] | null;
  follow_up_needed: boolean;
  follow_up_reason: string | null;
}

interface Job {
  status: 'pending' | 'processing' | 'done' | 'error';
  last_error: string | null;
}

const sentimentColor: Record<string, string> = {
  positive: 'bg-success/15 text-success dark:text-success',
  neutral: 'bg-muted text-muted-foreground',
  negative: 'bg-destructive/15 text-destructive dark:text-destructive',
  frustrated: 'bg-destructive/15 text-destructive dark:text-destructive',
  confused: 'bg-warning/15 text-warning dark:text-warning',
};

// The DB types are regenerated out-of-band; cast to reach the new tables.
const db = supabase as unknown as {
  from: (t: string) => any;
  functions: typeof supabase.functions;
};

export function CallIntelligence({ callId }: CallIntelligenceProps) {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const load = useCallback(async () => {
    const [t, a, j] = await Promise.all([
      db.from('call_transcripts').select('*').eq('call_id', callId).maybeSingle(),
      db.from('call_analyses').select('*').eq('call_id', callId).maybeSingle(),
      db.from('comm_processing_jobs').select('status, last_error')
        .eq('job_type', 'call_transcribe_analyze').eq('ref_table', 'calls').eq('ref_id', callId)
        .maybeSingle(),
    ]);
    setTranscript(t.data ?? null);
    setAnalysis(a.data ?? null);
    setJob(j.data ?? null);
    setLoading(false);
  }, [callId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Poll only while it's actually being worked on (our request in flight, or the
  // worker is processing). A 'pending' job with no worker is stuck — don't spin
  // forever; let the user kick it with the Analyze button.
  useEffect(() => {
    if (!running && job?.status !== 'processing') return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [running, job?.status, load]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const { data, error } = await db.functions.invoke('request-call-analysis', {
        body: { call_id: callId, force: true },
      });
      if (error || (data && data.ok === false)) {
        throw new Error(error?.message || data?.error || 'Analysis failed');
      }
      await load();
      toast({ title: 'Analysis complete', description: 'Transcript and summary are ready.' });
    } catch (e) {
      toast({
        title: 'Could not analyze call',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  // Only the active worker spins; a queued/stuck job must stay clickable.
  const activelyRunning = running || job?.status === 'processing';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Analysis
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={runAnalysis} disabled={running}>
            {activelyRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{analysis ? 'Re-analyze' : 'Analyze'}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !analysis && !transcript ? (
          <div className="text-sm text-muted-foreground space-y-3">
            {activelyRunning ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transcribing &amp; analyzing the call… this can take a moment.
              </div>
            ) : job?.status === 'error' ? (
              <div className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Analysis failed: {job.last_error || 'unknown error'}. Click Analyze to retry.</span>
              </div>
            ) : (
              <p>
                {job?.status === 'pending' ? 'This call is queued. ' : 'Not analyzed yet. '}
                Click <strong>Analyze</strong> to transcribe &amp; summarize it now.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {analysis?.intent && <Badge variant="outline">{analysis.intent}</Badge>}
              {analysis?.sentiment && (
                <Badge className={sentimentColor[analysis.sentiment] || 'bg-muted text-muted-foreground'}>
                  {analysis.sentiment}
                </Badge>
              )}
              {analysis?.follow_up_needed && (
                <Badge className="bg-warning/15 text-warning dark:text-warning">
                  <Flag className="h-3 w-3 mr-1" /> Follow-up
                </Badge>
              )}
              {transcript?.language_code && (
                <Badge variant="secondary" className="uppercase">{transcript.language_code}</Badge>
              )}
              {(analysis?.risk_flags || []).map((r) => (
                <Badge key={r} variant="destructive">{r}</Badge>
              ))}
            </div>

            {/* Summaries */}
            {analysis?.summary_uz && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Xulosa (UZ)</p>
                <p className="text-sm whitespace-pre-wrap">{analysis.summary_uz}</p>
              </div>
            )}
            {analysis?.summary_en && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Summary (EN)</p>
                <p className="text-sm whitespace-pre-wrap">{analysis.summary_en}</p>
              </div>
            )}

            {analysis?.follow_up_needed && analysis.follow_up_reason && (
              <div className="text-sm">
                <span className="font-semibold">Why follow up: </span>
                {analysis.follow_up_reason}
              </div>
            )}

            {/* Action items */}
            {analysis?.action_items && analysis.action_items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" /> Action items
                </p>
                <ul className="space-y-1">
                  {analysis.action_items.map((it, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>
                        {it.text}
                        {it.owner && <span className="text-muted-foreground"> — {it.owner}</span>}
                        {it.due && <span className="text-muted-foreground"> (by {it.due})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics */}
            {analysis?.topics && analysis.topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.topics.map((tp) => (
                  <Badge key={tp} variant="secondary" className="text-xs">{tp}</Badge>
                ))}
              </div>
            )}

            {/* Transcript (collapsible) */}
            {transcript && (
              <>
                <Separator />
                <button
                  type="button"
                  className="flex items-center justify-between w-full text-sm font-medium"
                  onClick={() => setShowTranscript((s) => !s)}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Transcript
                    {transcript.word_count ? (
                      <span className="text-xs text-muted-foreground">({transcript.word_count} words)</span>
                    ) : null}
                  </span>
                  {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showTranscript && (
                  <div className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 space-y-2">
                    {transcript.segments && transcript.segments.length > 0 ? (
                      transcript.segments.map((seg, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-semibold text-muted-foreground mr-2">{seg.speaker}:</span>
                          <span className="whitespace-pre-wrap">{seg.text}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{transcript.full_text}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
