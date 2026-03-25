import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';

const KAKAO_APP_KEY = 'c695b428933e192ca1d8582e3aab14a4';
const KAKAO_SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services,clusterer&autoload=false`;

const SEOUL_LAT = 37.5665;
const SEOUL_LNG = 126.9780;
const KOREA_SW = { lat: 33.0, lng: 124.5 };
const KOREA_NE = { lat: 38.7, lng: 132.0 };

interface University {
  id: string;
  name_en: string | null;
  name_ko: string | null;
  name_uz: string | null;
  city_en: string | null;
  city_ko: string | null;
  latitude: number | null;
  longitude: number | null;
  ranking: number | null;
  is_partner: boolean | null;
}

function uniName(u: University) {
  return u.name_ko || u.name_en || u.name_uz || 'University';
}

function uniDisplayName(u: University) {
  return u.name_en || u.name_uz || u.name_ko || 'University';
}

interface KakaoMapProps {
  focusUniversityId?: string | null;
}

export function KakaoMap({ focusUniversityId }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'kakao' | 'osm' | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [universities, setUniversities] = useState<University[]>([]);

  useEffect(() => {
    const fetchUnis = async () => {
      const { data } = await supabase
        .from('universities')
        .select('id, name_en, name_ko, name_uz, city_en, city_ko, latitude, longitude, ranking, is_partner')
        .eq('is_visible_on_map', true);
      if (data) setUniversities(data);
    };
    fetchUnis();
  }, []);

  const addKakaoMarkers = useCallback((map: any, unis: University[]) => {
    const { kakao } = window as any;
    const bounds = new kakao.maps.LatLngBounds();
    let hasValidCoords = false;

    unis.forEach((uni) => {
      if (!uni.latitude || !uni.longitude) return;
      hasValidCoords = true;
      const position = new kakao.maps.LatLng(uni.latitude, uni.longitude);
      bounds.extend(position);

      let marker: any;
      const color = uni.is_partner ? 'hsl(45,93%,47%)' : 'hsl(220,70%,50%)';
      const borderColor = uni.is_partner ? 'hsl(45,93%,37%)' : 'hsl(220,70%,40%)';

      const dotEl = document.createElement('div');
      dotEl.style.cssText = `
        width: 12px; height: 12px; border-radius: 50%;
        background: ${color}; border: 2px solid ${borderColor};
        cursor: pointer; transition: transform 0.15s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;
      dotEl.onmouseenter = () => { dotEl.style.transform = 'scale(1.4)'; };
      dotEl.onmouseleave = () => { dotEl.style.transform = 'scale(1)'; };

      marker = new kakao.maps.CustomOverlay({
        position, content: dotEl, map, yAnchor: 0.5, zIndex: 20,
      });

      const label = uniName(uni);
      const bg = uni.is_partner ? 'hsl(45,93%,47%)' : 'hsl(220,70%,50%)';
      new kakao.maps.CustomOverlay({
        position,
        content: `<div style="padding:1px 5px;background:${bg};color:white;border-radius:3px;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15);transform:translateX(-50%);pointer-events:none;">${label}</div>`,
        map,
        yAnchor: 2.2,
        zIndex: 1,
      });

      const rankText = uni.ranking ? `#${uni.ranking}` : '';
      const partnerBadge = uni.is_partner ? '<span style="background:hsl(45,93%,47%);color:white;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:4px;">Partner</span>' : '';
      const city = uni.city_ko || uni.city_en || '';
      const infoContent = `<div style="padding:10px 14px;min-width:180px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${uniDisplayName(uni)} ${partnerBadge}</div>
        ${uni.name_ko ? `<div style="font-size:12px;color:#666;margin-bottom:4px;">${uni.name_ko}</div>` : ''}
        <div style="font-size:12px;color:#888;">${[city, rankText].filter(Boolean).join(' · ')}</div>
      </div>`;
      const infoOverlay = new kakao.maps.CustomOverlay({
        position,
        content: `<div style="padding:10px 14px;min-width:180px;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);position:relative;">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${uniDisplayName(uni)} ${partnerBadge}</div>
          ${uni.name_ko ? `<div style="font-size:12px;color:#666;margin-bottom:4px;">${uni.name_ko}</div>` : ''}
          <div style="font-size:12px;color:#888;">${[city, rankText].filter(Boolean).join(' · ')}</div>
          <div style="cursor:pointer;position:absolute;top:4px;right:8px;font-size:16px;color:#999;" onclick="this.parentElement.parentElement.style.display='none'">×</div>
        </div>`,
        yAnchor: 1.5,
        zIndex: 30,
      });
      dotEl.onclick = () => {
        infoOverlay.setMap(infoOverlay.setMap ? map : map);
        infoOverlay.setMap(map);
      };
    });

    if (hasValidCoords) map.setBounds(bounds);
  }, []);

  const addLeafletMarkers = useCallback((map: L.Map, unis: University[]) => {
    const latlngs: L.LatLng[] = [];

    unis.forEach((uni) => {
      if (!uni.latitude || !uni.longitude) return;
      const ll: [number, number] = [uni.latitude, uni.longitude];
      latlngs.push(L.latLng(ll));

      const color = uni.is_partner ? 'hsl(45,93%,47%)' : 'hsl(220,70%,50%)';
      const borderColor = uni.is_partner ? 'hsl(45,93%,37%)' : 'hsl(220,70%,40%)';
      const marker = L.circleMarker(ll, {
        radius: 6, fillColor: color, color: borderColor, weight: 2, fillOpacity: 0.9,
      }).addTo(map);
      marker.bindTooltip(uniName(uni), {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: uni.is_partner ? 'leaflet-partner-label' : 'leaflet-uni-label',
      });

      const rankText = uni.ranking ? `#${uni.ranking}` : '';
      const partnerBadge = uni.is_partner ? '<span style="background:hsl(45,93%,47%);color:white;padding:1px 6px;border-radius:8px;font-size:10px;">Partner</span>' : '';
      const city = uni.city_en || '';
      marker.bindPopup(`<div style="min-width:160px;"><b>${uniDisplayName(uni)}</b> ${partnerBadge}<br/>${uni.name_ko ? `<span style="color:#666;">${uni.name_ko}</span><br/>` : ''}<span style="color:#888;">${[city, rankText].filter(Boolean).join(' · ')}</span></div>`);
    });

    if (latlngs.length > 0) map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
  }, []);

  const initKakaoMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    try {
      const { kakao } = window as any;
      const center = new kakao.maps.LatLng(SEOUL_LAT, SEOUL_LNG);
      const map = new kakao.maps.Map(mapRef.current, { center, level: 7 });
      mapInstanceRef.current = map;
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      map.addControl(new kakao.maps.MapTypeControl(), kakao.maps.ControlPosition.TOPRIGHT);

      // Restrict panning to South Korea bounds
      kakao.maps.event.addListener(map, 'bounds_changed', () => {
        const c = map.getCenter();
        const lat = c.getLat();
        const lng = c.getLng();
        const clampedLat = Math.max(KOREA_SW.lat, Math.min(KOREA_NE.lat, lat));
        const clampedLng = Math.max(KOREA_SW.lng, Math.min(KOREA_NE.lng, lng));
        if (lat !== clampedLat || lng !== clampedLng) {
          map.setCenter(new kakao.maps.LatLng(clampedLat, clampedLng));
        }
      });
      if (universities.length > 0) addKakaoMarkers(map, universities);
      // Focus on specific university if requested
      if (focusUniversityId) {
        const target = universities.find(u => u.id === focusUniversityId);
        if (target?.latitude && target?.longitude) {
          const pos = new kakao.maps.LatLng(target.latitude, target.longitude);
          map.setCenter(pos);
          map.setLevel(3);
        }
      }
      setMapType('kakao');
      setLoading(false);
      setError(null);
    } catch (e) {
      console.error('Kakao map init error:', e);
      initLeafletMap();
    }
  }, [universities, addKakaoMarkers, focusUniversityId]);

  const initLeafletMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    try {
      const map = L.map(mapRef.current, {
        maxBounds: [[KOREA_SW.lat, KOREA_SW.lng], [KOREA_NE.lat, KOREA_NE.lng]],
        maxBoundsViscosity: 1.0,
        minZoom: 7,
      }).setView([SEOUL_LAT, SEOUL_LNG], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      if (universities.length > 0) addLeafletMarkers(map, universities);
      // Focus on specific university if requested
      if (focusUniversityId) {
        const target = universities.find(u => u.id === focusUniversityId);
        if (target?.latitude && target?.longitude) {
          map.setView([target.latitude, target.longitude], 14);
        }
      }
      setMapType('osm');
      setLoading(false);
      setError(null);
    } catch (e) {
      console.error('Leaflet map init error:', e);
      setError('Xarita yuklanmadi');
      setLoading(false);
    }
  }, [universities, addLeafletMarkers, focusUniversityId]);

  const loadSDK = useCallback(() => {
    setError(null);
    setLoading(true);
    if (mapInstanceRef.current) {
      if (mapType === 'osm' && mapInstanceRef.current.remove) mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    const w = window as any;
    if (w.kakao?.maps?.LatLng) { initKakaoMap(); return; }
    if (w.kakao?.maps?.load) { w.kakao.maps.load(() => initKakaoMap()); return; }
    const existing = document.querySelector('script[data-kakao]');
    if (existing) { existing.remove(); delete w.kakao; }
    const script = document.createElement('script');
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.setAttribute('data-kakao', 'true');
    script.onload = () => { w.kakao?.maps?.load ? w.kakao.maps.load(() => initKakaoMap()) : initLeafletMap(); };
    script.onerror = () => initLeafletMap();
    document.head.appendChild(script);
  }, [initKakaoMap, initLeafletMap, mapType]);

  useEffect(() => {
    if (universities.length === 0) return;
    loadSDK();
  }, [universities, loadSDK]);

  return (
    <div className="relative w-full h-full">
      <style>{`
         .leaflet-uni-label { background: hsl(220,70%,50%) !important; color: white !important; border: none !important; font-size: 10px !important; font-weight: 600 !important; padding: 1px 5px !important; border-radius: 3px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important; }
         .leaflet-uni-label::before { border-top-color: hsl(220,70%,50%) !important; }
         .leaflet-partner-label { background: hsl(45,93%,47%) !important; color: white !important; border: none !important; font-size: 10px !important; font-weight: 600 !important; padding: 1px 5px !important; border-radius: 3px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important; }
         .leaflet-partner-label::before { border-top-color: hsl(45,93%,47%) !important; }
      `}</style>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted z-10 gap-3">
          <p className="text-destructive font-medium">{error}</p>
          <button onClick={loadSDK} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Qayta urinish</button>
        </div>
      )}
      {mapType === 'osm' && !loading && (
        <div className="absolute top-2 left-12 z-[1000] bg-background/90 backdrop-blur-sm text-xs px-3 py-1.5 rounded-md border text-muted-foreground">
          OpenStreetMap (Kakao SDK yuklanmadi)
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
