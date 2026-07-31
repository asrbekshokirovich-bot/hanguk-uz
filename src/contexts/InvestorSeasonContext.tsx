import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useInvestorIntakes, type InvestorIntake } from '@/hooks/useInvestor';

/**
 * Season scope for the investor portal.
 *
 * Deliberately NOT IntakeContext. That one reads public.intakes directly, which
 * migration 0005 denies to an investor session - it would resolve to an empty
 * list and every screen would render blank. This provider reads
 * v_investor_intakes instead, which already has her visibility floor applied,
 * so anything in `intakes` here is a season she is entitled to.
 */

const STORAGE_KEY = 'hanguk-investor-intake';

interface InvestorSeasonValue {
  intakes: InvestorIntake[];
  activeIntake: InvestorIntake | null;
  activeIntakeId: string | null;
  setActiveIntakeId: (id: string) => void;
  isLoading: boolean;
  /** ms timestamp of the last successful fetch - drives "updated 2 hours ago". */
  updatedAt: number;
}

const InvestorSeasonContext = createContext<InvestorSeasonValue | undefined>(undefined);

function pickDefault(intakes: InvestorIntake[]): InvestorIntake | null {
  if (intakes.length === 0) return null;
  // The view already sorts newest first; prefer the flagged default, then the
  // open season, then the newest she can see.
  return intakes.find((i) => i.is_default) ?? intakes.find((i) => i.is_open) ?? intakes[0];
}

export function InvestorSeasonProvider({ children }: { children: React.ReactNode }) {
  const { data: intakes = [], isLoading, dataUpdatedAt } = useInvestorIntakes();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // A stored id from an earlier session may name a season she can no longer
  // see, so it is validated against the list rather than trusted.
  const activeIntake = useMemo(() => {
    const stored = selectedId ? intakes.find((i) => i.intake_id === selectedId) : undefined;
    return stored ?? pickDefault(intakes);
  }, [intakes, selectedId]);

  useEffect(() => {
    if (!activeIntake) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, activeIntake.intake_id);
    } catch {
      /* private mode - the selection just will not persist */
    }
  }, [activeIntake]);

  const value = useMemo<InvestorSeasonValue>(
    () => ({
      intakes,
      activeIntake: activeIntake ?? null,
      activeIntakeId: activeIntake?.intake_id ?? null,
      setActiveIntakeId: setSelectedId,
      isLoading,
      updatedAt: dataUpdatedAt,
    }),
    [intakes, activeIntake, isLoading, dataUpdatedAt],
  );

  return <InvestorSeasonContext.Provider value={value}>{children}</InvestorSeasonContext.Provider>;
}

export function useInvestorSeason() {
  const ctx = useContext(InvestorSeasonContext);
  if (!ctx) throw new Error('useInvestorSeason must be used within an InvestorSeasonProvider');
  return ctx;
}
