import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { UniversitySelectionBar } from './UniversitySelectionBar';
import { PanoramaViewer } from './PanoramaViewer';
import { UniversityComparisonChat } from './UniversityComparisonChat';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useUniversityPrograms, groupProgramsByTrack, getLanguageRequirements } from '@/hooks/useUniversityPrograms';
import {
  MapPin, X, ExternalLink, Star, Loader2, Plus, Check,
  BookOpen, Languages, Navigation, Eye, Search, ChevronUp, ChevronDown, Info, Map as MapIcon
} from 'lucide-react';

const KAKAO_APP_KEY = 'c695b428933e192ca1d8582e3aab14a4';
const KAKAO_SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services,clusterer&autoload=false`;
const KOREA_CENTER = { lat: 36.5, lng: 127.8 };
const KOREA_SW = { lat: 33.0, lng: 124.5 };
const KOREA_NE = { lat: 38.7, lng: 132.0 };
const COUNTRY_ZOOM = 13;
// Problem 9: Changed from 3 to 5 for comfortable campus overview
const CAMPUS_ZOOM = 5;

interface UniversityMapKakaoProps {
  universities: Tables<'universities'>[];
  onUniversitySelect?: (university: Tables<'universities'>) => void;
  focusUniversityId?: string | null;
}

// Unified item type for rendering (DB or mock)
type MapUniversity = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  campus_info: string;
  is_partner: boolean;
  ranking: number | null;
  website: string | null;
  raw?: Tables<'universities'>;
};

// ─── University Detail Panel ────────────────────────
function UniversityDetailPanel({ university, campusInfo }: { university?: Tables<'universities'>; campusInfo: string }) {
  const { t } = useTranslation();
  // Problem 15: Pass null instead of '' to avoid wasted query
  const { data: programs, isLoading, isPlaceholderData } = useUniversityPrograms(university?.id ?? null);
  const programsByTrack = groupProgramsByTrack(programs || null);
  const langReqs = getLanguageRequirements(programs || null);
  const totalEnglish = programsByTrack.englishTrack.reduce((a, f) => a + f.programs.length, 0);
  const totalKorean = programsByTrack.koreanTrack.reduce((a, f) => a + f.programs.length, 0);
  const totalBoth = programsByTrack.bothTracks.reduce((a, f) => a + f.programs.length, 0);

  return (
    <div className="space-y-2">
      {campusInfo && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{campusInfo}</span>
        </div>
      )}

      {university?.ranking && (
        <span className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">
          {t('universities.ranking')}: #{university.ranking}
        </span>
      )}
      {university?.tuition_min && university?.tuition_max && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('universities.tuition')}: </span>
          ₩{university.tuition_min.toLocaleString()} - ₩{university.tuition_max.toLocaleString()}
        </p>
      )}
      {/* Problem 17: Skeleton instead of loading flash */}
      {university && isLoading && !isPlaceholderData ? (
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      ) : university && programs && programs.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium">
            <BookOpen className="h-3 w-3" />
            <span>{programs.length} {t('navigation.programs') || 'Programs'}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {totalEnglish > 0 && <Badge variant="secondary" className="text-xs"><Languages className="h-3 w-3 mr-1" />EN: {totalEnglish}</Badge>}
            {totalKorean > 0 && <Badge variant="default" className="text-xs">KO: {totalKorean}</Badge>}
            {totalBoth > 0 && <Badge variant="outline" className="text-xs">{t('universities.bothTracks', 'Both')}: {totalBoth}</Badge>}
          </div>
          {(langReqs.topikRange || langReqs.ieltsRange) && (
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              {langReqs.topikRange && <span>TOPIK {langReqs.topikRange.min === langReqs.topikRange.max ? langReqs.topikRange.min : `${langReqs.topikRange.min}-${langReqs.topikRange.max}`}</span>}
              {langReqs.ieltsRange && <span>IELTS {langReqs.ieltsRange.min === langReqs.ieltsRange.max ? langReqs.ieltsRange.min : `${langReqs.ieltsRange.min}-${langReqs.ieltsRange.max}`}</span>}
            </div>
          )}
        </div>
      ) : university?.programs && university.programs.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {university.programs.slice(0, 3).map((p, i) => <Badge key={i} variant="outline" className="text-xs">{p}</Badge>)}
          {university.programs.length > 3 && <Badge variant="outline" className="text-xs">+{university.programs.length - 3}</Badge>}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────
export function UniversityMapKakao({ universities, onUniversitySelect, focusUniversityId }: UniversityMapKakaoProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'uz' | 'ko' | 'ru' | 'en';
  const isMobile = useIsMobile();

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const gpsOverlayRef = useRef<any>(null);
  const gpsWatchRef = useRef<number | null>(null);
  const markerHandlersRef = useRef<any[]>([]);
  const panoAbortRef = useRef<AbortController | null>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [sdkError, setSdkError] = useState(false);
  const [mapType, setMapType] = useState<'kakao' | 'leaflet' | null>(null);
  const [selectedItem, setSelectedItem] = useState<MapUniversity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Problem 16: Debounced search query for marker rendering
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [gpsActive, setGpsActive] = useState(false);
  const [comparisonList, setComparisonList] = useState<Tables<'universities'>[]>([]);
  const [showComparisonChat, setShowComparisonChat] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [campusExploreActive, setCampusExploreActive] = useState(false);
  const [campusExplorePanoId, setCampusExplorePanoId] = useState<number | null>(null);
  const [campusExploreLoading, setCampusExploreLoading] = useState(false);
  const [campusExploreImagePath, setCampusExploreImagePath] = useState<string | null>(null);
  const [campusExploreStreetName, setCampusExploreStreetName] = useState<string>('');
  const [campusExploreLinks, setCampusExploreLinks] = useState<Array<{ id: number; lat: number; lng: number; angle: number }>>([]);
  const [campusExploreHeading, setCampusExploreHeading] = useState(0);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [mobileMapHidden, setMobileMapHidden] = useState(false);

  // Problem 16: Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Problem 4: Derive dbLoadError directly instead of setState in useMemo
  const dbLoadError = universities.length === 0;

  // Problem 9: Remove non-existent ru columns from language maps
  const getName = useCallback((u: Tables<'universities'>) => {
    const langMap: Record<string, keyof Tables<'universities'>> = {
      uz: 'name_uz', ko: 'name_ko', en: 'name_en', ru: 'name_ru',
    };
    const key = langMap[currentLang];
    return (key && u[key] as string) || (u.name_en as string) || (u.name_ko as string) || (u.name_uz as string) || '';
  }, [currentLang]);

  const getCity = useCallback((u: Tables<'universities'>) => {
    const langMap: Record<string, keyof Tables<'universities'>> = {
      uz: 'city_uz', ko: 'city_ko', en: 'city_en', ru: 'city_ru',
    };
    const key = langMap[currentLang];
    return (key && u[key] as string) || (u.city_en as string) || (u.city_ko as string) || (u.city_uz as string) || '';
  }, [currentLang]);

  // Problem 10: Use description fields; hide campus_info when only tuition data
  const getCampusInfo = useCallback((u: Tables<'universities'>) => {
    const langMap: Record<string, keyof Tables<'universities'>> = {
      uz: 'description_uz', ko: 'description_ko', en: 'description_en', ru: 'description_ru',
    };
    const key = langMap[currentLang];
    const desc = key ? (u[key] as string | null) : null;
    if (desc) return desc;
    // Try English fallback
    const descEn = u.description_en as string | null;
    if (descEn) return descEn;
    const descKo = u.description_ko as string | null;
    if (descKo) return descKo;
    // No real description — return empty string (don't show tuition as "campus info")
    return '';
  }, [currentLang]);

  const mapItems: MapUniversity[] = useMemo(() => {
    if (universities.length === 0) return [];
    return universities
      .filter(u => u.latitude && u.longitude)
      .map(u => ({
        id: u.id,
        name: getName(u),
        city: getCity(u),
        lat: Number(u.latitude),
        lng: Number(u.longitude),
        campus_info: getCampusInfo(u),
        is_partner: !!u.is_partner,
        ranking: u.ranking,
        website: u.website,
        raw: u,
      }));
  }, [universities, getName, getCity, getCampusInfo]);

  // Sidebar filtering uses instant searchQuery for responsiveness
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return mapItems;
    const q = searchQuery.toLowerCase();
    return mapItems.filter(u => u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q));
  }, [mapItems, searchQuery]);

  // Problem 16: Marker filtering uses debouncedSearch to avoid rebuilding markers on every keystroke
  const markerItems = useMemo(() => {
    if (!debouncedSearch.trim()) return mapItems;
    const q = debouncedSearch.toLowerCase();
    return mapItems.filter(u => u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q));
  }, [mapItems, debouncedSearch]);

  // Problem 2: Clear selectedItem when it's not in filteredItems
  useEffect(() => {
    if (selectedItem && searchQuery.trim()) {
      const stillVisible = filteredItems.some(item => item.id === selectedItem.id);
      if (!stillVisible) {
        setSelectedItem(null);
      }
    }
  }, [filteredItems, selectedItem, searchQuery]);

  // Refs to track whether setBounds should fire in marker effect
  const isInitialBoundsRef = useRef(true);
  const prevDebouncedSearchForBoundsRef = useRef('');

  // Problem 8: Reset map bounds when search is cleared
  const prevSearchRef = useRef('');
  useEffect(() => {
    const wasSearching = prevSearchRef.current.trim().length > 0;
    const nowEmpty = debouncedSearch.trim().length === 0;
    prevSearchRef.current = debouncedSearch;

    if (wasSearching && nowEmpty) {
      const map = mapInstanceRef.current;
      if (!map || mapItems.length === 0) return;
      if (mapType === 'kakao') {
        const bounds = new (window.kakao.maps as any).LatLngBounds();
        mapItems.forEach(item => bounds.extend(new window.kakao.maps.LatLng(item.lat, item.lng)));
        map.setBounds(bounds);
      } else if (mapType === 'leaflet') {
        const latlngs = mapItems.map(item => L.latLng(item.lat, item.lng));
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
      }
    }
  }, [debouncedSearch, mapItems, mapType]);

  const isInComparison = (id: string) => comparisonList.some(u => u.id === id);
  const addToComparison = (item: MapUniversity) => {
    if (!item.raw) { toast.info(t('universities.dataNotAvailable', 'University data not available for comparison')); return; }
    if (comparisonList.length >= 4) { toast.error(t('universities.maxCompare')); return; }
    if (!isInComparison(item.id)) {
      setComparisonList(prev => [...prev, item.raw!]);
      toast.success(`${item.name} ${t('universities.addedToCompare')}`);
    }
  };
  const removeFromComparison = (id: string) => setComparisonList(prev => prev.filter(u => u.id !== id));

  // ── Initialize Leaflet Map (fallback) ──
  const initLeafletMap = useCallback(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    try {
      const map = L.map(mapContainerRef.current, {
        maxBounds: [[KOREA_SW.lat, KOREA_SW.lng], [KOREA_NE.lat, KOREA_NE.lng]],
        maxBoundsViscosity: 1.0,
        minZoom: 7,
      }).setView([KOREA_CENTER.lat, KOREA_CENTER.lng], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      setMapType('leaflet');
      setLoading(false);
      setSdkError(false);
    } catch (e) {
      console.error('Leaflet map init error:', e);
      setSdkError(true);
      setLoading(false);
    }
  }, []);

  // ── Initialize Kakao Map ──
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    try {
      const center = new window.kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng);
      const map = new window.kakao.maps.Map(mapContainerRef.current, { center, level: COUNTRY_ZOOM });
      mapInstanceRef.current = map;
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

      // Restrict panning to South Korea bounds
      window.kakao.maps.event.addListener(map, 'bounds_changed', () => {
        const c = (map as any).getCenter();
        const lat = c.getLat();
        const lng = c.getLng();
        const clampedLat = Math.max(KOREA_SW.lat, Math.min(KOREA_NE.lat, lat));
        const clampedLng = Math.max(KOREA_SW.lng, Math.min(KOREA_NE.lng, lng));
        if (lat !== clampedLat || lng !== clampedLng) {
          map.setCenter(new window.kakao.maps.LatLng(clampedLat, clampedLng));
        }
      });

      setMapType('kakao');
      setLoading(false);
    } catch {
      console.error('Kakao map init failed, falling back to Leaflet');
      initLeafletMap();
    }
  }, [initLeafletMap]);

  // ── Load SDK (with 5s timeout) ──
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      fn();
    };

    const load = () => {
      if (window.kakao?.maps?.LatLng) { settle(() => initMap()); return; }
      if (window.kakao?.maps) { settle(() => window.kakao.maps.load(() => initMap())); return; }

      const existing = document.querySelector('script[data-kakao]') as HTMLScriptElement;
      if (existing) {
        if (window.kakao?.maps) { settle(() => window.kakao.maps.load(() => initMap())); }
        else {
          timeout = setTimeout(() => settle(() => initLeafletMap()), 5000);
          existing.addEventListener('load', () => settle(() => window.kakao.maps.load(() => initMap())));
        }
        return;
      }

      const script = document.createElement('script');
      script.src = KAKAO_SDK_URL;
      script.async = true;
      script.setAttribute('data-kakao', 'true');

      timeout = setTimeout(() => {
        script.onload = null;
        script.onerror = null;
        settle(() => initLeafletMap());
      }, 5000);

      script.onload = () => {
        if (window.kakao?.maps?.load) {
          settle(() => window.kakao.maps.load(() => initMap()));
        } else {
          settle(() => initLeafletMap());
        }
      };
      script.onerror = () => { settle(() => initLeafletMap()); };
      document.head.appendChild(script);
    };
    load();

    return () => { if (timeout) clearTimeout(timeout); };
  }, [initMap, initLeafletMap]);

  // Problem 5: IntersectionObserver for map resize on visibility changes
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !mapType) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const map = mapInstanceRef.current;
          if (!map) return;
          setTimeout(() => {
            if (mapType === 'leaflet' && typeof map.invalidateSize === 'function') {
              map.invalidateSize();
            } else if (mapType === 'kakao' && typeof map.relayout === 'function') {
              map.relayout();
            }
          }, 100);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(container);
    return () => observer.disconnect();
  }, [mapType]);

  // ── Invalidate map size on visibility (fixes gray tiles from hidden tab) ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || loading || !mapType) return;
    const timer = setTimeout(() => {
      if (mapType === 'leaflet') {
        map.invalidateSize();
      } else if (mapType === 'kakao') {
        map.relayout();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, mapType]);

  // Problem 1 + 16: Add University Markers using debounced markerItems
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapType) return;

    // Clear old markers + Problem 4: Remove Kakao event listeners before cleanup
    if (mapType === 'kakao') {
      markersRef.current.forEach((m) => {
        m.setMap(null);
      });
      labelsRef.current.forEach(l => l.setMap(null));
    } else {
      markersRef.current.forEach(m => map.removeLayer(m));
    }
    markersRef.current = [];
    labelsRef.current = [];
    markerHandlersRef.current = [];

    if (mapType === 'kakao') {
      markerItems.forEach(item => {
        const pos = new window.kakao.maps.LatLng(item.lat, item.lng);
        const color = item.is_partner ? 'hsl(45,93%,47%)' : 'hsl(220,70%,50%)';
        const borderColor = item.is_partner ? 'hsl(45,93%,37%)' : 'hsl(220,70%,40%)';

        // Small circle dot marker
        const dotEl = document.createElement('div');
        dotEl.style.cssText = `
          width: 12px; height: 12px; border-radius: 50%;
          background: ${color}; border: 2px solid ${borderColor};
          cursor: pointer; transition: transform 0.15s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        dotEl.onmouseenter = () => { dotEl.style.transform = 'scale(1.4)'; };
        dotEl.onmouseleave = () => { dotEl.style.transform = 'scale(1)'; };

        const clickHandler = () => {
          setSelectedItem(item);
          if (item.raw) onUniversitySelect?.(item.raw);
          map.panTo(pos);
          map.setLevel(CAMPUS_ZOOM);
        };
        dotEl.onclick = clickHandler;

        const dotOverlay = new window.kakao.maps.CustomOverlay({
          position: pos, content: dotEl, map, yAnchor: 0.5, zIndex: 20,
        });

        // Small label
        const labelContent = document.createElement('div');
        labelContent.style.cssText = `
          background: white; padding: 1px 5px; border-radius: 3px;
          font-size: 10px; font-weight: 600; white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15); pointer-events: none;
          border: 1px solid ${item.is_partner ? 'hsl(45,93%,47%)' : 'hsl(var(--border))'};
        `;
        labelContent.textContent = item.name;

        const labelOverlay = new window.kakao.maps.CustomOverlay({
          position: pos, content: labelContent, map, yAnchor: 2.2, zIndex: 10,
        });

        markersRef.current.push(dotOverlay);
        labelsRef.current.push(labelOverlay);
        markerHandlersRef.current.push(clickHandler);
      });

      // Only fit bounds on initial load or when search actively changes (not on language/data changes)
      if (markerItems.length > 0) {
        const searchChanged = prevDebouncedSearchForBoundsRef.current !== debouncedSearch;
        prevDebouncedSearchForBoundsRef.current = debouncedSearch;

        if (isInitialBoundsRef.current || (debouncedSearch.trim() && searchChanged)) {
          const bounds = new (window.kakao.maps as any).LatLngBounds();
          markerItems.forEach(item => bounds.extend(new window.kakao.maps.LatLng(item.lat, item.lng)));
          map.setBounds(bounds);
          isInitialBoundsRef.current = false;
        }
      }
    } else {
      // Leaflet markers
      const latlngs: L.LatLng[] = [];
      markerItems.forEach(item => {
        const ll: [number, number] = [item.lat, item.lng];
        latlngs.push(L.latLng(ll));

        const color = item.is_partner ? 'hsl(45,93%,47%)' : 'hsl(220,70%,50%)';
        const borderColor = item.is_partner ? 'hsl(45,93%,37%)' : 'hsl(220,70%,40%)';
        const marker = L.circleMarker(ll, {
          radius: 6,
          fillColor: color,
          color: borderColor,
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map);

        marker.bindTooltip(item.name, {
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: item.is_partner ? 'leaflet-partner-label' : 'leaflet-uni-label',
        });

        marker.on('click', () => {
          setSelectedItem(item);
          if (item.raw) onUniversitySelect?.(item.raw);
          map.setView(ll, 14);
        });

        markersRef.current.push(marker);
      });

      if (latlngs.length > 0) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
      }
    }
  }, [markerItems, mapType, onUniversitySelect, debouncedSearch]);

  // Deep-link: auto-focus university when focusUniversityId is provided (once per value)
  const focusHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusUniversityId || !mapInstanceRef.current || markerItems.length === 0) return;
    if (focusHandledRef.current === focusUniversityId) return;
    const target = markerItems.find(i => i.id === focusUniversityId);
    if (!target) return;
    focusHandledRef.current = focusUniversityId;
    setSelectedItem(target);
    const map = mapInstanceRef.current;
    if (mapType === 'kakao') {
      map.panTo(new window.kakao.maps.LatLng(target.lat, target.lng));
      map.setLevel(CAMPUS_ZOOM);
    } else {
      map.setView([target.lat, target.lng], 14);
    }
  }, [focusUniversityId, markerItems, mapType]);

  // ── Select from sidebar ──
  const handleSelectFromList = useCallback((item: MapUniversity) => {
    setSelectedItem(item);
    if (item.raw) onUniversitySelect?.(item.raw);
    setMobileListOpen(false);

    const map = mapInstanceRef.current;
    if (map) {
      // Problem 6: Use zoom 14 for Leaflet consistency
      if (mapType === 'leaflet') {
        map.setView([item.lat, item.lng], 14);
      } else {
        const pos = new window.kakao.maps.LatLng(item.lat, item.lng);
        map.panTo(pos);
        map.setLevel(CAMPUS_ZOOM);
      }
    }
  }, [onUniversitySelect, mapType]);

  // Problem 6: GPS toggle off resets view to fit all markers
  const fitAllMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || mapItems.length === 0) return;

    if (mapType === 'kakao') {
      const bounds = new (window.kakao.maps as any).LatLngBounds();
      mapItems.forEach(item => bounds.extend(new window.kakao.maps.LatLng(item.lat, item.lng)));
      map.setBounds(bounds);
    } else if (mapType === 'leaflet') {
      const latlngs = mapItems.map(item => L.latLng(item.lat, item.lng));
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }
  }, [mapItems, mapType]);

  const toggleGPS = useCallback(() => {
    if (gpsActive && gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      if (mapType === 'kakao') {
        gpsOverlayRef.current?.setMap(null);
      } else if (mapType === 'leaflet' && gpsOverlayRef.current) {
        mapInstanceRef.current?.removeLayer(gpsOverlayRef.current);
      }
      gpsOverlayRef.current = null;
      setGpsActive(false);
      fitAllMarkers();
      return;
    }
    if (!navigator.geolocation) {
      toast.error(t('student.gpsNotSupported', 'GPS is not supported on this device'));
      return;
    }
    setGpsActive(true);
    const map = mapInstanceRef.current;
    if (!map) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        if (mapType === 'leaflet') {
          if (!gpsOverlayRef.current) {
            map.setView([latitude, longitude], 13);
            const gpsIcon = L.divIcon({
              className: '',
              html: `<div style="position:relative;width:20px;height:20px;">
                <div style="position:absolute;inset:0;background:hsl(216,90%,55%);border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.3);z-index:2;"></div>
                <div style="position:absolute;inset:-6px;background:hsl(216,90%,55%,0.25);border-radius:50%;animation:gps-pulse 2s infinite;z-index:1;"></div>
              </div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });
            gpsOverlayRef.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(map);
          } else {
            gpsOverlayRef.current.setLatLng([latitude, longitude]);
          }
        } else {
          const latlng = new window.kakao.maps.LatLng(latitude, longitude);
          if (!gpsOverlayRef.current) {
            map.panTo(latlng);
            map.setLevel(3);
            const el = document.createElement('div');
            el.innerHTML = `
              <div style="position:relative;width:20px;height:20px;">
                <div style="position:absolute;inset:0;background:hsl(216,90%,55%);border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.3);z-index:2;"></div>
                <div style="position:absolute;inset:-6px;background:hsl(216,90%,55%,0.25);border-radius:50%;animation:gps-pulse 2s infinite;z-index:1;"></div>
              </div>
            `;
            gpsOverlayRef.current = new window.kakao.maps.CustomOverlay({
              position: latlng, content: el, map, yAnchor: 0.5, zIndex: 100,
            });
          } else {
            gpsOverlayRef.current.setPosition(latlng);
          }
        }
      },
      (err) => {
        console.warn('GPS error:', err);
        toast.error(t('student.gpsError', 'Could not get your location'));
        setGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    gpsWatchRef.current = watchId;
  }, [gpsActive, t, mapType, fitAllMarkers]);

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
      panoAbortRef.current?.abort();
    };
  }, []);

  // Problem 5: Abortable panorama fetch
  const fetchPanoData = useCallback(async (params: { lat?: number; lng?: number; panoId?: number }, signal?: AbortSignal) => {
    const query = params.panoId
      ? `panoId=${params.panoId}`
      : `lat=${params.lat}&lng=${params.lng}`;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/kakao-roadview-proxy?${query}`,
      { headers: { 'apikey': anonKey, 'Content-Type': 'application/json' }, signal }
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Street view request failed (${response.status}): ${errorText}`);
    }
    return await response.json();
  }, []);

  const handleCampusExplore = useCallback(async () => {
    if (campusExploreActive) {
      setCampusExploreActive(false);
      setCampusExplorePanoId(null);
      setCampusExploreImagePath(null);
      setCampusExploreStreetName('');
      setCampusExploreLinks([]);
      setCampusExploreLoading(false);
      setMobileMapHidden(false);
      return;
    }
    if (!selectedItem) {
      toast.error(t('student.selectUniversityFirst', 'Select a university first'));
      return;
    }

    setCampusExploreActive(true);
    setCampusExploreLoading(true);
    setCampusExplorePanoId(null);

    // Abort any previous pano fetch
    panoAbortRef.current?.abort();
    const controller = new AbortController();
    panoAbortRef.current = controller;

    try {
      const result = await fetchPanoData({ lat: selectedItem.lat, lng: selectedItem.lng }, controller.signal);
      setCampusExploreLoading(false);
      if (result.available && result.panoId && result.imagePath) {
        setCampusExplorePanoId(result.panoId);
        setCampusExploreImagePath(result.imagePath);
        setCampusExploreStreetName(result.streetName || '');
        setCampusExploreLinks(result.links || []);
        setCampusExploreHeading(result.heading ?? 0);
        if (isMobile) setMobileMapHidden(true);
      } else {
        setCampusExplorePanoId(null);
        setCampusExploreImagePath(null);
        setCampusExploreLinks([]);
        setCampusExploreHeading(0);
      }
    } catch (e) {
      console.error('Roadview proxy check failed:', e);
      setCampusExploreLoading(false);
      setCampusExplorePanoId(null);
      setCampusExploreImagePath(null);
      setCampusExploreLinks([]);
      toast.error(t('student.streetViewFailed', 'Failed to load street view. Please try again.'));
    }
  }, [campusExploreActive, selectedItem, t, fetchPanoData, isMobile]);

  // Navigate to a linked panorama
  const navigatingRef = useRef(false);
  const handlePanoNavigate = useCallback(async (panoId: number) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setNavigationVersion(prev => prev + 1);
    panoAbortRef.current?.abort();
    const controller = new AbortController();
    panoAbortRef.current = controller;
    try {
      const result = await fetchPanoData({ panoId }, controller.signal);
      if (result.available && result.imagePath) {
        setCampusExplorePanoId(result.panoId);
        setCampusExploreImagePath(result.imagePath);
        setCampusExploreStreetName(result.streetName || '');
        setCampusExploreLinks(result.links || []);
        setCampusExploreHeading(result.heading ?? 0);
      } else {
        toast.error(t('student.noPanoramaAtPosition', 'No panorama available at this position'));
        setNavigationVersion(prev => prev + 1);
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        navigatingRef.current = false;
        return;
      }
      console.error('Navigation failed:', e);
      toast.error(t('student.panoramaNavigationFailed', 'Failed to load next panorama'));
      setNavigationVersion(prev => prev + 1);
    } finally {
      navigatingRef.current = false;
    }
  }, [fetchPanoData]);

  // ── Resize map when panel state changes ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapType) return;
    const timer = setTimeout(() => {
      if (mapType === 'leaflet' && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      } else if (mapType === 'kakao' && typeof map.relayout === 'function') {
        map.relayout();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [campusExploreActive, mapType, mobileMapHidden]);

  // ── SDK Error Fallback ──
  if (sdkError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-[500px] gap-4">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('student.mapUnavailable', 'Map is currently unavailable')}</p>
          <Button onClick={() => { setSdkError(false); setLoading(true); mapInstanceRef.current = null; }}>
            {t('common.retry', 'Retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Problem 9: Show error state when no universities loaded
  if (dbLoadError && !loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-[500px] gap-4">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('student.noUniversitiesLoaded', 'Could not load universities. Please check your connection.')}</p>
          <Button onClick={() => window.location.reload()}>
            {t('common.retry', 'Retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Sidebar Item ──
  const renderItem = (item: MapUniversity) => (
    <button
      key={item.id}
      onClick={() => handleSelectFromList(item)}
      className={cn(
        "w-full text-left p-3 rounded-lg transition-colors border",
        selectedItem?.id === item.id
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-transparent hover:bg-muted"
      )}
    >
      <div className="flex items-start gap-2">
        {item.is_partner && <Star className="h-4 w-4 text-warning fill-warning shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">{item.city}</p>
          <div className="flex items-center gap-1 mt-1">
            {item.ranking && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">#{item.ranking}</Badge>}
            {item.is_partner && <Badge variant="default" className="text-[10px] px-1.5 py-0">{t('universities.partner', 'Partner')}</Badge>}
          </div>
          {item.campus_info && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{item.campus_info}</p>}
        </div>
      </div>
    </button>
  );

  // Problem 3 + 14: Mobile panorama sizing with dvh
  const mapContainerHeight = campusExploreActive
    ? (isMobile ? 'h-[calc(100dvh-120px)]' : 'h-[700px]')
    : 'h-[550px]';

  return (
    <>
      {/* Problem 15: Renamed keyframes from "pulse" to "gps-pulse" to avoid Tailwind conflict */}
      <style>{`
         .leaflet-uni-label { background: hsl(220,70%,50%) !important; color: white !important; border: none !important; font-size: 10px !important; font-weight: 600 !important; padding: 1px 5px !important; border-radius: 3px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important; }
         .leaflet-uni-label::before { border-top-color: hsl(220,70%,50%) !important; }
         .leaflet-partner-label { background: hsl(45,93%,47%) !important; color: white !important; border: none !important; font-size: 10px !important; font-weight: 600 !important; padding: 1px 5px !important; border-radius: 3px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important; }
        .leaflet-partner-label::before { border-top-color: hsl(45,93%,47%) !important; }
        /* gps-pulse keyframes defined globally in index.css */
      `}</style>
      {/* Problem 10: ARIA attributes on map container */}
      <div className={cn("relative w-full rounded-xl overflow-hidden border", mapContainerHeight)} role="application" aria-label={t('student.universityMap', 'University map')}>
        <div className="flex h-full">
          {/* ─── Desktop Sidebar ─── */}
          <div className="hidden md:flex flex-col w-72 border-r bg-background z-10">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {/* Problem 10: aria-label on search input */}
                <Input
                  placeholder={t('common.search', 'Search') + '...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                  aria-label={t('common.searchUniversities', 'Search universities')}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {filteredItems.length} {t('navigation.universities')}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredItems.map(renderItem)}
              </div>
            </ScrollArea>
          </div>

          {/* ─── Map Area ─── */}
          <div className="flex-1 relative flex flex-col">
            {/* Problem 3: Hide map on mobile when panorama is active */}
            <div
              ref={mapContainerRef}
              className={cn(
                "w-full transition-all",
                campusExploreActive
                  ? (mobileMapHidden ? "h-0 overflow-hidden" : (isMobile ? "h-[30%]" : "h-[35%]"))
                  : "flex-1"
              )}
            />

            {/* Campus Explore Panel */}
            {campusExploreActive && selectedItem && (
              <div
                className={cn(
                  "w-full relative border-t",
                  mobileMapHidden ? "flex-1" : (isMobile ? "h-[70%]" : "h-[65%]")
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {campusExploreLoading ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">{t('student.loadingStreetView', 'Loading street view...')}</span>
                  </div>
                ) : campusExplorePanoId && campusExploreImagePath ? (
                  <ErrorBoundary fallback={
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-3">
                      <Eye className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{t('student.panoramaUnavailable', 'Panorama unavailable')}</p>
                      <Button variant="outline" size="sm" onClick={() => { setCampusExplorePanoId(null); handleCampusExplore(); }}>
                        {t('errors.tryAgain', 'Try again')}
                      </Button>
                    </div>
                  }>
                    <PanoramaViewer imagePath={campusExploreImagePath} streetName={campusExploreStreetName} links={campusExploreLinks} onNavigate={handlePanoNavigate} navigationVersion={navigationVersion} heading={campusExploreHeading} />
                  </ErrorBoundary>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-3">
                    <Eye className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t('student.noRoadview', 'Street view not available at this location')}
                    </p>
                    <a
                      href={`https://www.google.com/maps/@${selectedItem.lat},${selectedItem.lng},3a,75y,0h,90t`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3 mr-1" /> {t('student.openGoogleMaps', 'Open in Google Maps')}
                      </Button>
                    </a>
                  </div>
                )}
                {/* Controls: Close + Toggle Map (mobile) */}
                <div className="absolute top-2 right-2 z-20 flex gap-1">
                  {isMobile && (
                    <Button size="sm" variant="secondary" onClick={() => setMobileMapHidden(!mobileMapHidden)}>
                      <MapIcon className="h-4 w-4 mr-1" /> {mobileMapHidden ? t('student.showMap', 'Show Map') : t('student.hideMap', 'Hide Map')}
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={handleCampusExplore}>
                    <X className="h-4 w-4 mr-1" /> {t('common.close', 'Close')}
                  </Button>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted z-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Map type indicator for Leaflet */}
            {mapType === 'leaflet' && !loading && (
              <div className="absolute top-2 left-12 z-[1000] bg-background/90 backdrop-blur-sm text-xs px-3 py-1.5 rounded-md border text-muted-foreground">
                {t('student.openStreetMapFallback', 'OpenStreetMap (Kakao unavailable)')}
              </div>
            )}

            {/* Map Controls */}
            {!loading && (
              <div className="absolute top-3 left-3 md:left-3 flex flex-col gap-2 z-[1000]">
                <Button size="icon" variant={gpsActive ? "default" : "secondary"} className="h-10 w-10 shadow-lg"
                  onClick={toggleGPS} title={t('student.findMyLocation', 'Find My Location')}>
                  <Navigation className={cn("h-5 w-5", gpsActive && "animate-pulse")} />
                </Button>
              </div>
            )}

            {/* Legend */}
            {!loading && (
              <div className="absolute top-3 right-14 bg-background/90 backdrop-blur rounded-lg p-2.5 shadow-lg z-[1000] hidden md:block">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="h-3 w-3 text-destructive" />
                    <span>{t('navigation.universities')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Star className="h-3 w-3 text-warning fill-warning" />
                    <span>{t('universities.partnerUniversity')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Problem 16: Selected University Card with max-height & scroll on mobile */}
            {selectedItem && !campusExploreActive && (
              <Card className="absolute bottom-3 left-3 right-3 md:left-auto md:right-3 md:w-80 z-[1000] shadow-xl max-h-[50vh] md:max-h-none overflow-auto">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedItem.is_partner && <Star className="h-4 w-4 text-warning fill-warning shrink-0" />}
                      <CardTitle className="text-sm truncate">{selectedItem.name}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSelectedItem(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedItem.city}</p>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <UniversityDetailPanel university={selectedItem.raw} campusInfo={selectedItem.campus_info} />
                  <div className="flex gap-2 flex-wrap">
                    {selectedItem.website && (
                      <a href={selectedItem.website} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> {t('common.view')}
                      </a>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCampusExplore}>
                      <Eye className="h-3 w-3 mr-1" /> {t('student.walkAroundCampus', 'Walk Around Campus')}
                    </Button>
                    {selectedItem.raw && (
                      <Button size="sm" variant={isInComparison(selectedItem.id) ? "secondary" : "default"} className="h-7 text-xs"
                        onClick={() => isInComparison(selectedItem.id) ? removeFromComparison(selectedItem.id) : addToComparison(selectedItem)}>
                        {isInComparison(selectedItem.id) ? <><Check className="h-3 w-3 mr-1" />{t('universities.added')}</> : <><Plus className="h-3 w-3 mr-1" />{t('universities.compare')}</>}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Problem 7: Hide mobile bottom sheet when campusExploreActive */}
        {/* Problem 10: Narrow handle to centered pill to avoid blocking map touches */}
        {!campusExploreActive && (
          <div className="md:hidden absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex justify-center">
            <div className="pointer-events-auto w-40">
              <button onClick={() => setMobileListOpen(!mobileListOpen)}
                className="w-full flex flex-col items-center py-2 bg-background border-t rounded-t-xl shadow-lg">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mb-1" />
                <span className="text-xs text-muted-foreground font-medium">
                  {mobileListOpen ? (
                    <ChevronDown className="h-3 w-3 inline mr-1" />
                  ) : (
                    <ChevronUp className="h-3 w-3 inline mr-1" />
                  )}
                  {filteredItems.length} {t('navigation.universities')}
                </span>
              </button>
              {mobileListOpen && (
                <div className={cn("fixed left-0 right-0 bg-background border-t max-h-[45vh] flex flex-col z-30", comparisonList.length > 0 ? "bottom-[120px]" : "bottom-12")}>
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder={t('common.search', 'Search') + '...'} value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9"
                        aria-label={t('common.searchUniversities', 'Search universities')} />
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">{filteredItems.map(renderItem)}</div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Comparison Bar */}
      <UniversitySelectionBar selectedUniversities={comparisonList} onRemove={removeFromComparison} onCompare={() => setShowComparisonChat(true)} />
      {showComparisonChat && <UniversityComparisonChat universities={comparisonList} onClose={() => setShowComparisonChat(false)} />}
    </>
  );
}
