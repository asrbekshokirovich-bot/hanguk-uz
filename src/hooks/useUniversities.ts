import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type University = Tables<'universities'>;

export function useUniversities() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUniversities = async (visibleOnly = false) => {
    let query = supabase
      .from('universities')
      .select('*')
      .order('ranking', { ascending: true, nullsFirst: false });

    if (visibleOnly) {
      query = query.eq('is_visible_on_map', true);
    }

    const { data, error } = await query;

    if (!error && data) {
      setUniversities(data);
    }
    setLoading(false);
  };

  const createUniversity = async (university: Omit<University, 'id' | 'created_at' | 'updated_at'>) => {
    const { error, data } = await supabase
      .from('universities')
      .insert(university)
      .select()
      .single();

    if (!error) {
      await fetchUniversities();
    }
    return { error, data };
  };

  const updateUniversity = async (id: string, updates: Partial<University>) => {
    const { error, data } = await supabase
      .from('universities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchUniversities();
    }
    return { error, data };
  };

  const deleteUniversity = async (id: string) => {
    const { error } = await supabase
      .from('universities')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchUniversities();
    }
    return { error };
  };

  const togglePartner = async (id: string, isPartner: boolean) => {
    return updateUniversity(id, { is_partner: isPartner });
  };

  const toggleMapVisibility = async (id: string, isVisible: boolean) => {
    const { error, data } = await supabase
      .from('universities')
      .update({ is_visible_on_map: isVisible })
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchUniversities();
    }
    return { error, data };
  };

  useEffect(() => {
    fetchUniversities();
  }, []);

  const stats = {
    total: universities.length,
    partners: universities.filter(u => u.is_partner).length,
    withPrograms: universities.filter(u => u.programs && u.programs.length > 0).length,
    visibleOnMap: universities.filter(u => (u as any).is_visible_on_map !== false).length,
    withWebsite: universities.filter(u => u.website && u.website.trim() !== '').length,
    noWebsite: universities.filter(u => !u.website || u.website.trim() === '').length,
  };

  return {
    universities,
    loading,
    stats,
    fetchUniversities,
    createUniversity,
    updateUniversity,
    deleteUniversity,
    togglePartner,
    toggleMapVisibility,
  };
}
