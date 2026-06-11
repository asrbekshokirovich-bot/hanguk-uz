import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { intakeSlug, parseIntakeSlug, type Season } from '@/lib/intakeQuery';

export type Intake = Tables<'intakes'>;
export type { Season };

const STORAGE_KEY = 'hanguk-active-intake';

interface IntakeContextValue {
  /** All intakes, newest year first. */
  intakes: Intake[];
  /** The currently active intake (the one every query is scoped to). */
  activeIntake: Intake | null;
  /** Shorthand id used by `applyIntake` / query keys. */
  activeIntakeId: string | null;
  season: Season | null;
  year: number | null;
  isLoading: boolean;
  /** Switch by intake id. */
  setActiveIntakeId: (id: string) => void;
  /** Switch by season + year (the switcher's segmented control). */
  selectSeasonYear: (season: Season, year: number) => void;
  /** Distinct years present, ascending — powers the year stepper. */
  availableYears: number[];
  /** Look up an intake (may be undefined if that season/year doesn't exist). */
  intakeFor: (season: Season, year: number) => Intake | undefined;
}

const IntakeContext = createContext<IntakeContextValue | undefined>(undefined);

export function IntakeProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: intakes = [], isLoading } = useQuery({
    queryKey: ['intakes'],
    queryFn: async (): Promise<Intake[]> => {
      const { data, error } = await supabase
        .from('intakes')
        .select('*')
        .order('year', { ascending: false })
        .order('season', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [activeIntakeId, setActiveIntakeIdState] = useState<string | null>(null);

  // Resolve the active intake once the list loads: URL ?intake= -> localStorage -> default -> first open.
  useEffect(() => {
    if (!intakes.length) return;
    if (activeIntakeId && intakes.some((i) => i.id === activeIntakeId)) return;

    const bySeasonYear = (s: { season: Season; year: number } | null) =>
      s ? intakes.find((i) => i.season === s.season && i.year === s.year) : undefined;

    const pick =
      bySeasonYear(parseIntakeSlug(searchParams.get('intake'))) ||
      bySeasonYear(parseIntakeSlug(localStorage.getItem(STORAGE_KEY))) ||
      intakes.find((i) => i.is_default) ||
      intakes.find((i) => i.is_open) ||
      intakes[0];

    if (pick) setActiveIntakeIdState(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakes]);

  const activeIntake = useMemo(
    () => intakes.find((i) => i.id === activeIntakeId) ?? null,
    [intakes, activeIntakeId],
  );

  // Persist the choice to localStorage + URL so refreshes and deep links keep the season.
  useEffect(() => {
    if (!activeIntake) return;
    const slug = intakeSlug(activeIntake);
    localStorage.setItem(STORAGE_KEY, slug);
    if (searchParams.get('intake') !== slug) {
      const next = new URLSearchParams(searchParams);
      next.set('intake', slug);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntake]);

  const setActiveIntakeId = useCallback((id: string) => setActiveIntakeIdState(id), []);

  const intakeFor = useCallback(
    (season: Season, year: number) => intakes.find((i) => i.season === season && i.year === year),
    [intakes],
  );

  const selectSeasonYear = useCallback(
    (season: Season, year: number) => {
      const found = intakes.find((i) => i.season === season && i.year === year);
      if (found) setActiveIntakeIdState(found.id);
    },
    [intakes],
  );

  const availableYears = useMemo(
    () => Array.from(new Set(intakes.map((i) => i.year))).sort((a, b) => a - b),
    [intakes],
  );

  const value = useMemo<IntakeContextValue>(
    () => ({
      intakes,
      activeIntake,
      activeIntakeId,
      season: (activeIntake?.season as Season) ?? null,
      year: activeIntake?.year ?? null,
      isLoading,
      setActiveIntakeId,
      selectSeasonYear,
      availableYears,
      intakeFor,
    }),
    [intakes, activeIntake, activeIntakeId, isLoading, setActiveIntakeId, selectSeasonYear, availableYears, intakeFor],
  );

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) throw new Error('useActiveIntake must be used within an IntakeProvider');
  return ctx;
}
