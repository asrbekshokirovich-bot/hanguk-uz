import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Segment } from './marketing';

/**
 * «Oqim» (plan v2, stage 4): the screens visits go through, step by step
 * (analytics_paths, drawn as a Sankey), and a funnel from any steps
 * (analytics_funnel_custom). Both for a period and a cut.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface Paths {
  from: string;
  to: string;
  depth: number;
  sessions: number;
  nodes: { step: number; screen: string; sessions: number }[];
  links: { step: number; from: string; to: string; sessions: number }[];
}

export interface CustomFunnel {
  from: string;
  to: string;
  steps: { key: string; devices: number }[];
}

function useRpc<T>(fn: string, args: Record<string, unknown> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = args ? JSON.stringify(args) : '';
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setLoading(true);
    db.rpc(fn, JSON.parse(key)).then(({ data, error }: { data: T | null; error: { message: string } | null }) => {
      if (!alive) return;
      setError(error ? error.message : null);
      setData(error ? null : data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fn, key]);
  return { data, loading, error };
}

export function usePaths(from: string, to: string, includeTest: boolean, seg: Segment, depth = 4) {
  return useRpc<Paths>('analytics_paths', { p_from: from, p_to: to, p_include_test: includeTest, p_seg: seg, p_depth: depth, p_top: 6 });
}

export function useCustomFunnel(from: string, to: string, steps: string[], includeTest: boolean, seg: Segment) {
  const ok = steps.length >= 2 && steps.every(Boolean);
  return useRpc<CustomFunnel>(
    'analytics_funnel_custom',
    ok ? { p_from: from, p_to: to, p_steps: steps, p_include_test: includeTest, p_seg: seg } : null,
  );
}

export interface FlowNode {
  key: string;
  step: number;
  screen: string;
  sessions: number;
  x: number;
  y: number;
  h: number;
  exit: boolean;
}

export interface FlowLink {
  from: FlowNode;
  to: FlowNode;
  sessions: number;
  /** The band's top at the source and at the target, and its thickness. */
  y0: number;
  y1: number;
  h: number;
}

/**
 * The paths laid out for drawing (a Sankey with fixed columns — one per
 * step, so a visit that ended after step 1 shows its «exit» in column 2, not
 * at the far right as a general Sankey would put every end): nodes stacked
 * by size in their column, the exits last and red, bands stacked in order.
 */
export function layoutFlow(p: Paths, width: number, height: number, opts = { nodeWidth: 10, pad: 14, labelSpace: 170 }) {
  const { nodeWidth, pad, labelSpace } = opts;
  const depth = Math.max(1, p.depth);
  const exits = new Map<number, number>();
  for (const l of p.links) if (l.to === '__exit__' && l.sessions > 0) exits.set(l.step + 1, (exits.get(l.step + 1) ?? 0) + l.sessions);

  const columns: FlowNode[][] = [];
  for (let c = 1; c <= depth; c++) {
    const col = p.nodes
      .filter((n) => n.step === c && n.sessions > 0)
      .sort((a, b) => Number(a.screen === '__other__') - Number(b.screen === '__other__') || b.sessions - a.sessions)
      .map((n) => ({ key: `${c}|${n.screen}`, step: c, screen: n.screen, sessions: n.sessions, x: 0, y: 0, h: 0, exit: false }));
    const e = exits.get(c);
    if (e) col.push({ key: `${c}|__exit__`, step: c, screen: '__exit__', sessions: e, x: 0, y: 0, h: 0, exit: true });
    if (col.length) columns.push(col);
  }
  const k = Math.min(
    ...columns.map((col) => (height - pad * (col.length - 1)) / Math.max(1, col.reduce((a, n) => a + n.sessions, 0))),
  );
  const span = columns.length > 1 ? (width - labelSpace - nodeWidth) / (columns.length - 1) : 0;
  const byKey = new Map<string, FlowNode>();
  columns.forEach((col, ci) => {
    let y = 0;
    for (const n of col) {
      n.x = ci * span;
      n.y = y;
      n.h = Math.max(1, n.sessions * k);
      y += n.h + pad;
      byKey.set(n.key, n);
    }
  });

  const raw = p.links
    .filter((l) => l.sessions > 0)
    .map((l) => ({ from: byKey.get(`${l.step}|${l.from}`), to: byKey.get(`${l.step + 1}|${l.to}`), sessions: l.sessions }))
    .filter((l): l is { from: FlowNode; to: FlowNode; sessions: number } => !!l.from && !!l.to);
  const outY = new Map<string, number>();
  const inY = new Map<string, number>();
  const links: FlowLink[] = [];
  // stacked by the other end's position, so bands don't cross inside a node
  for (const l of [...raw].sort((a, b) => a.from.y - b.from.y || a.to.y - b.to.y)) {
    const h = l.sessions * k;
    const y0 = l.from.y + (outY.get(l.from.key) ?? 0);
    outY.set(l.from.key, (outY.get(l.from.key) ?? 0) + h);
    links.push({ from: l.from, to: l.to, sessions: l.sessions, y0, y1: 0, h });
  }
  for (const l of [...links].sort((a, b) => a.to.y - b.to.y || a.from.y - b.from.y || a.y0 - b.y0)) {
    l.y1 = l.to.y + (inY.get(l.to.key) ?? 0);
    inY.set(l.to.key, (inY.get(l.to.key) ?? 0) + l.h);
  }
  const used = Math.max(0, ...columns.map((col) => (col.length ? col[col.length - 1].y + col[col.length - 1].h : 0)));
  return { nodes: columns.flat(), links, height: used, nodeWidth };
}
