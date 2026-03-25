import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { X, Plus } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type University = Tables<'universities'>;

interface UniversityFormProps {
  university?: University | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<University>) => Promise<{ error: any }>;
}

const emptyForm = {
  name_uz: '',
  name_ko: '',
  name_ru: '',
  name_en: '',
  city_uz: '',
  city_ko: '',
  city_ru: '',
  city_en: '',
  description_uz: '',
  description_ko: '',
  description_ru: '',
  description_en: '',
  requirements_uz: '',
  requirements_ko: '',
  requirements_ru: '',
  requirements_en: '',
  website: '',
  logo_url: '',
  ranking: '',
  acceptance_rate: '',
  tuition_min: '',
  tuition_max: '',
  latitude: '',
  longitude: '',
  is_partner: false,
  programs: [] as string[],
};

export function UniversityForm({ university, open, onOpenChange, onSave }: UniversityFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newProgram, setNewProgram] = useState('');

  useEffect(() => {
    if (university) {
      setForm({
        name_uz: university.name_uz || '',
        name_ko: university.name_ko || '',
        name_ru: university.name_ru || '',
        name_en: university.name_en || '',
        city_uz: university.city_uz || '',
        city_ko: university.city_ko || '',
        city_ru: university.city_ru || '',
        city_en: university.city_en || '',
        description_uz: university.description_uz || '',
        description_ko: university.description_ko || '',
        description_ru: university.description_ru || '',
        description_en: university.description_en || '',
        requirements_uz: university.requirements_uz || '',
        requirements_ko: university.requirements_ko || '',
        requirements_ru: university.requirements_ru || '',
        requirements_en: university.requirements_en || '',
        website: university.website || '',
        logo_url: university.logo_url || '',
        ranking: university.ranking?.toString() || '',
        acceptance_rate: university.acceptance_rate?.toString() || '',
        tuition_min: university.tuition_min?.toString() || '',
        tuition_max: university.tuition_max?.toString() || '',
        latitude: university.latitude?.toString() || '',
        longitude: university.longitude?.toString() || '',
        is_partner: university.is_partner || false,
        programs: university.programs || [],
      });
    } else {
      setForm(emptyForm);
    }
  }, [university, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_uz) return;

    setLoading(true);
    const data: Partial<University> = {
      name_uz: form.name_uz,
      name_ko: form.name_ko || null,
      name_ru: form.name_ru || null,
      name_en: form.name_en || null,
      city_uz: form.city_uz || null,
      city_ko: form.city_ko || null,
      city_ru: form.city_ru || null,
      city_en: form.city_en || null,
      description_uz: form.description_uz || null,
      description_ko: form.description_ko || null,
      description_ru: form.description_ru || null,
      description_en: form.description_en || null,
      requirements_uz: form.requirements_uz || null,
      requirements_ko: form.requirements_ko || null,
      requirements_ru: form.requirements_ru || null,
      requirements_en: form.requirements_en || null,
      website: form.website || null,
      logo_url: form.logo_url || null,
      ranking: form.ranking ? parseInt(form.ranking) : null,
      acceptance_rate: form.acceptance_rate ? parseFloat(form.acceptance_rate) : null,
      tuition_min: form.tuition_min ? parseInt(form.tuition_min) : null,
      tuition_max: form.tuition_max ? parseInt(form.tuition_max) : null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      is_partner: form.is_partner,
      programs: form.programs.length > 0 ? form.programs : null,
    };

    const { error } = await onSave(data);
    setLoading(false);
    
    if (!error) {
      onOpenChange(false);
    }
  };

  const addProgram = () => {
    if (newProgram.trim() && !form.programs.includes(newProgram.trim())) {
      setForm({ ...form, programs: [...form.programs, newProgram.trim()] });
      setNewProgram('');
    }
  };

  const removeProgram = (program: string) => {
    setForm({ ...form, programs: form.programs.filter(p => p !== program) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {university ? t('common.edit') : t('common.add')} {t('navigation.universities')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="names">Names</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('universities.ranking')}</Label>
                  <Input
                    type="number"
                    placeholder="#1"
                    value={form.ranking}
                    onChange={(e) => setForm({ ...form, ranking: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('universities.acceptanceRate')} (%)</Label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={form.acceptance_rate}
                    onChange={(e) => setForm({ ...form, acceptance_rate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('universities.tuition')} Min ($)</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={form.tuition_min}
                    onChange={(e) => setForm({ ...form, tuition_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('universities.tuition')} Max ($)</Label>
                  <Input
                    type="number"
                    placeholder="15000"
                    value={form.tuition_max}
                    onChange={(e) => setForm({ ...form, tuition_max: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  type="url"
                  placeholder="https://university.kr"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_partner}
                  onCheckedChange={(checked) => setForm({ ...form, is_partner: checked })}
                />
                <Label>{t('universities.partnerUniversity')}</Label>
              </div>
            </TabsContent>

            <TabsContent value="names" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (Uzbek) *</Label>
                  <Input
                    value={form.name_uz}
                    onChange={(e) => setForm({ ...form, name_uz: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>City (Uzbek)</Label>
                  <Input
                    value={form.city_uz}
                    onChange={(e) => setForm({ ...form, city_uz: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (Korean)</Label>
                  <Input
                    value={form.name_ko}
                    onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City (Korean)</Label>
                  <Input
                    value={form.city_ko}
                    onChange={(e) => setForm({ ...form, city_ko: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (Russian)</Label>
                  <Input
                    value={form.name_ru}
                    onChange={(e) => setForm({ ...form, name_ru: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City (Russian)</Label>
                  <Input
                    value={form.city_ru}
                    onChange={(e) => setForm({ ...form, city_ru: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (English)</Label>
                  <Input
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City (English)</Label>
                  <Input
                    value={form.city_en}
                    onChange={(e) => setForm({ ...form, city_en: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Programs */}
              <div className="space-y-2">
                <Label>{t('universities.programs')}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add program..."
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProgram())}
                  />
                  <Button type="button" variant="outline" onClick={addProgram}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.programs.map((program) => (
                    <Badge key={program} variant="secondary" className="gap-1">
                      {program}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeProgram(program)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-2">
                <Label>Description (Uzbek)</Label>
                <Textarea
                  value={form.description_uz}
                  onChange={(e) => setForm({ ...form, description_uz: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (English)</Label>
                <Textarea
                  value={form.description_en}
                  onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="location" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="37.5665"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="126.9780"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Coordinates are used to display the university on the map.
              </p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !form.name_uz}>
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
