import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Star, 
  MapPin, 
  Globe, 
  Edit, 
  Trash2,
  GraduationCap,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

interface UniversityListProps {
  universities: Tables<'universities'>[];
  loading: boolean;
  currentLang: string;
  onEdit: (university: Tables<'universities'>) => void;
  onDelete: (id: string) => void;
  onTogglePartner: (id: string, isPartner: boolean) => void;
  onToggleMapVisibility?: (id: string, isVisible: boolean) => void;
  onSelect?: (university: Tables<'universities'>) => void;
  websiteFilter?: 'with' | 'without' | null;
}

export function UniversityList({ 
  universities, 
  loading, 
  currentLang,
  onEdit, 
  onDelete,
  onTogglePartner,
  onToggleMapVisibility,
  onSelect,
  websiteFilter,
}: UniversityListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPartnersOnly, setShowPartnersOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const INSTITUTION_TYPE_LABELS: Record<string, string> = {
    all: 'All Types',
    university: 'University (266)',
    junior_college: 'Junior College (113)',
    polytechnic: 'Polytechnic (25)',
    theological: 'Theological (15)',
    graduate_only: 'Graduate Only (11)',
    online_only: 'Online/Cyber (10)',
    military_police: 'Military/Police (4)',
    foreign_branch: 'Foreign Branch (4)',
  };

  const getLocalizedField = (university: Tables<'universities'>, field: string) => {
    const key = `${field}_${currentLang}` as keyof Tables<'universities'>;
    return (university[key] as string) || (university[`${field}_uz` as keyof Tables<'universities'>] as string) || '';
  };

  const filteredUniversities = universities.filter(uni => {
    const name = getLocalizedField(uni, 'name');
    const city = getLocalizedField(uni, 'city');
    const matchesSearch = !searchQuery || 
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPartner = !showPartnersOnly || uni.is_partner;
    const matchesType = typeFilter === 'all' || (uni as any).institution_type === typeFilter;
    const hasWebsite = uni.website && uni.website.trim() !== '';
    const matchesWebsite = !websiteFilter
      || (websiteFilter === 'with' && hasWebsite)
      || (websiteFilter === 'without' && !hasWebsite);
    return matchesSearch && matchesPartner && matchesType && matchesWebsite;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('universities.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <Switch 
            checked={showPartnersOnly} 
            onCheckedChange={setShowPartnersOnly}
          />
          <span className="text-sm">{t('universities.partnerUniversity')}</span>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {filteredUniversities.length} {t('navigation.universities').toLowerCase()}
        </p>
        {websiteFilter && (
          <Badge variant="outline" className={websiteFilter === 'with' ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}>
            {websiteFilter === 'with' ? '🌐 Has Website' : '❌ No Website'}
          </Badge>
        )}
      </div>

      {/* University Cards */}
      {filteredUniversities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('common.none')} {t('navigation.universities').toLowerCase()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUniversities.map((university) => (
            <Card key={university.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect?.(university)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {university.logo_url ? (
                      <img 
                        src={university.logo_url} 
                        alt="" 
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold line-clamp-1">
                        {getLocalizedField(university, 'name')}
                      </h3>
      <p 
                        className={`text-sm text-muted-foreground flex items-center gap-1 ${university.latitude && university.longitude ? 'cursor-pointer hover:text-primary hover:underline' : ''}`}
                        onClick={(e) => {
                          if (university.latitude && university.longitude) {
                            e.stopPropagation();
                            navigate(`/crm/kakao-map?universityId=${university.id}`);
                          }
                        }}
                      >
                        <MapPin className="h-3 w-3" />
                        {getLocalizedField(university, 'city')}
                      </p>
                    </div>
                  </div>
                  {university.is_partner && (
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  )}
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(university as any).institution_type && (university as any).institution_type !== 'university' && (
                    <Badge variant="outline" className="text-xs capitalize border-primary/30 text-primary">
                      {INSTITUTION_TYPE_LABELS[(university as any).institution_type]?.replace(/ \(\d+\)$/, '') || (university as any).institution_type}
                    </Badge>
                  )}
                  {university.ranking && (
                    <Badge variant="secondary">
                      #{university.ranking}
                    </Badge>
                  )}
                  {university.acceptance_rate && (
                    <Badge variant="outline">
                      {university.acceptance_rate}% {t('universities.acceptanceRate').split(' ')[0]}
                    </Badge>
                  )}
                  {university.programs && university.programs.length > 0 && (
                    <Badge variant="outline">
                      {university.programs.length} {t('universities.programs')}
                    </Badge>
                  )}
                </div>

                {/* Tuition */}
                {university.tuition_min && university.tuition_max && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('universities.tuition')}: ${university.tuition_min.toLocaleString()} - ${university.tuition_max.toLocaleString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={university.is_partner || false}
                        onCheckedChange={(checked) => onTogglePartner(university.id, checked)}
                      />
                      <span className="text-xs text-muted-foreground">Partner</span>
                    </div>
                    {onToggleMapVisibility && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleMapVisibility(university.id, !(university as any).is_visible_on_map)}
                        className="h-8 px-2"
                      >
                        {(university as any).is_visible_on_map !== false ? (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            <span className="text-xs">On Map</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3 mr-1 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Hidden</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {university.website && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={university.website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onEdit(university)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {getLocalizedField(university, 'name')}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onDelete(university.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            {t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
