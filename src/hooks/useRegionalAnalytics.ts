import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';

// Uzbekistan regions with standardized names for mapping
export const UZBEKISTAN_REGIONS = [
  { id: 'tashkent_city', name: "Toshkent shahri", nameEn: "Tashkent City" },
  { id: 'tashkent', name: "Toshkent viloyati", nameEn: "Tashkent Region" },
  { id: 'andijan', name: "Andijon viloyati", nameEn: "Andijan" },
  { id: 'bukhara', name: "Buxoro viloyati", nameEn: "Bukhara" },
  { id: 'fergana', name: "Farg'ona viloyati", nameEn: "Fergana" },
  { id: 'jizzakh', name: "Jizzax viloyati", nameEn: "Jizzakh" },
  { id: 'khorezm', name: "Xorazm viloyati", nameEn: "Khorezm" },
  { id: 'namangan', name: "Namangan viloyati", nameEn: "Namangan" },
  { id: 'navoiy', name: "Navoiy viloyati", nameEn: "Navoiy" },
  { id: 'kashkadarya', name: "Qashqadaryo viloyati", nameEn: "Kashkadarya" },
  { id: 'samarkand', name: "Samarqand viloyati", nameEn: "Samarkand" },
  { id: 'sirdarya', name: "Sirdaryo viloyati", nameEn: "Sirdarya" },
  { id: 'surkhandarya', name: "Surxondaryo viloyati", nameEn: "Surkhandarya" },
  { id: 'karakalpakstan', name: "Qoraqalpog'iston", nameEn: "Karakalpakstan" },
];

// Map city values to region IDs
function normalizeToRegionId(city: string | null): string | null {
  if (!city) return null;
  
  const cityLower = city.toLowerCase().trim();
  
  // Mapping patterns
  const patterns: Record<string, string[]> = {
    tashkent_city: ['toshkent shahri', 'tashkent city', 'toshkent sh', 'ташкент'],
    tashkent: ['toshkent viloyati', 'tashkent region', 'toshkent v', 'тошкент в'],
    andijan: ['andijon', 'andijan', 'андижон'],
    bukhara: ['buxoro', 'bukhara', 'бухоро'],
    fergana: ["farg'ona", 'fergana', 'фаргона', 'fargona'],
    jizzakh: ['jizzax', 'jizzakh', 'жиззах'],
    khorezm: ['xorazm', 'khorezm', 'хоразм'],
    namangan: ['namangan', 'наманган'],
    navoiy: ['navoiy', 'navoi', 'навоий'],
    kashkadarya: ['qashqadaryo', 'kashkadarya', 'қашқадарё', 'kashkadaryo'],
    samarkand: ['samarqand', 'samarkand', 'самарканд'],
    sirdarya: ['sirdaryo', 'sirdarya', 'сирдарё'],
    surkhandarya: ['surxondaryo', 'surkhandarya', 'сурхондарё'],
    karakalpakstan: ["qoraqalpog'iston", 'karakalpakstan', 'қорақалпоғистон', 'nukus', 'nukis'],
  };
  
  for (const [regionId, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => cityLower.includes(kw))) {
      return regionId;
    }
  }
  
  return null;
}

export interface RegionalData {
  regionId: string;
  regionName: string;
  regionNameEn: string;
  leadsCount: number;
  studentsCount: number;
  total: number;
}

export function useRegionalAnalytics() {
  const { activeIntakeId } = useActiveIntake();
  const [data, setData] = useState<RegionalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ leads: 0, students: 0 });

  const fetchData = async () => {
    setLoading(true);

    try {
      // Get staff user IDs to exclude from student count
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id');

      const staffUserIds = new Set((staffRoles ?? []).map((r) => r.user_id));

      // Fetch leads, profiles and this season's membership in parallel.
      // Leads and students are scoped to the active intake so the map matches
      // the rest of the CRM.
      const [leadsRes, profilesRes, membersRes] = await Promise.all([
        applyIntake(supabase.from('leads').select('id, city'), activeIntakeId),
        supabase.from('profiles').select('user_id, city, office_location'),
        applyIntake(supabase.from('student_intakes').select('student_id'), activeIntakeId),
      ]);

      const leads = leadsRes.data || [];
      const profiles = profilesRes.data || [];
      const memberIds = new Set((membersRes.data ?? []).map((m) => m.student_id));

      // Students = this season's members, excluding staff.
      const students = profiles.filter((p) => memberIds.has(p.user_id) && !staffUserIds.has(p.user_id));

      // Count by region
      const regionCounts: Record<string, { leads: number; students: number }> = {};
      
      // Initialize all regions
      UZBEKISTAN_REGIONS.forEach(r => {
        regionCounts[r.id] = { leads: 0, students: 0 };
      });

      // Count leads
      leads.forEach(lead => {
        const regionId = normalizeToRegionId(lead.city);
        if (regionId && regionCounts[regionId]) {
          regionCounts[regionId].leads++;
        }
      });

      // Count students (try city first, then office_location)
      students.forEach(student => {
        const regionId = normalizeToRegionId(student.city) || normalizeToRegionId(student.office_location);
        if (regionId && regionCounts[regionId]) {
          regionCounts[regionId].students++;
        }
      });

      // Build result array
      const result: RegionalData[] = UZBEKISTAN_REGIONS.map(region => ({
        regionId: region.id,
        regionName: region.name,
        regionNameEn: region.nameEn,
        leadsCount: regionCounts[region.id]?.leads || 0,
        studentsCount: regionCounts[region.id]?.students || 0,
        total: (regionCounts[region.id]?.leads || 0) + (regionCounts[region.id]?.students || 0),
      }));

      // Sort by total descending
      result.sort((a, b) => b.total - a.total);

      setData(result);
      setTotals({
        leads: leads.length,
        students: students.length,
      });
    } catch (error) {
      console.error('Error fetching regional analytics:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntakeId]);

  return { data, loading, totals, refetch: fetchData };
}
