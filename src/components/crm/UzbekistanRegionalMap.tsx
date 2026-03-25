import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRegionalAnalytics, RegionalData } from '@/hooks/useRegionalAnalytics';
import { MapPin, Users, UserPlus, Loader2 } from 'lucide-react';

// Region center coordinates for Uzbekistan
const REGION_COORDINATES: Record<string, [number, number]> = {
  tashkent_city: [41.3111, 69.2401],
  tashkent: [41.0, 69.6],
  andijan: [40.7821, 72.3442],
  bukhara: [39.7747, 64.4167],
  fergana: [40.3842, 71.7975],
  jizzakh: [40.1158, 67.8422],
  khorezm: [41.5500, 60.6333],
  namangan: [41.0011, 71.6726],
  navoiy: [40.0844, 65.3792],
  kashkadarya: [38.8600, 66.8167],
  samarkand: [39.6542, 66.9597],
  sirdarya: [40.5056, 68.6647],
  surkhandarya: [38.2117, 67.2783],
  karakalpakstan: [42.4600, 59.6000],
};

export function UzbekistanRegionalMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const { data, loading: dataLoading, totals } = useRegionalAnalytics();
  const [selectedRegion, setSelectedRegion] = useState<RegionalData | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [41.3, 64.5],
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      maxBounds: [[37.0, 55.0], [46.0, 74.0]],
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add markers when data is ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dataLoading) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const maxCount = Math.max(...data.map(d => d.total), 1);

    data.forEach((region) => {
      const coords = REGION_COORDINATES[region.regionId];
      if (!coords) return;

      const size = Math.max(40, Math.min(80, 40 + (region.total / maxCount) * 40));
      const hasData = region.total > 0;

      const icon = L.divIcon({
        className: '',
        iconSize: [size, size + 20],
        iconAnchor: [size / 2, size / 2],
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;width:${size}px;">
            <div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.2);background:${hasData ? 'linear-gradient(135deg,hsl(221.2 83.2% 53.3%),hsl(224.3 76.3% 48%))' : 'hsl(0 0% 70%)'};">
              ${region.total}
            </div>
            <div style="margin-top:4px;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:500;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.15);white-space:nowrap;">
              ${region.regionNameEn}
            </div>
          </div>
        `,
      });

      const marker = L.marker(coords, { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedRegion(region);
        map.setView(coords, 8, { animate: true });
      });

      markersRef.current.push(marker);
    });
  }, [data, dataLoading]);

  const topRegions = data.filter(d => d.total > 0).slice(0, 5);

  if (dataLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Regional Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Uzbekistan Regional Map
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="flex items-center gap-1">
              <UserPlus className="h-3 w-3" />
              {totals.leads} Leads
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totals.students} Students
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-4 gap-4">
          {/* Map */}
          <div className="lg:col-span-3 relative rounded-xl overflow-hidden border" style={{ height: '500px', minHeight: '500px' }}>
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

            {/* Selected Region Card */}
            {selectedRegion && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-64 z-[1000] bg-background/95 backdrop-blur rounded-lg shadow-xl p-3 border">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{selectedRegion.regionName}</p>
                    <p className="text-xs text-muted-foreground">{selectedRegion.regionNameEn}</p>
                  </div>
                  <button
                    onClick={() => setSelectedRegion(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <UserPlus className="h-4 w-4 text-chart-2" />
                    <span className="font-medium">{selectedRegion.leadsCount}</span>
                    <span className="text-muted-foreground">Leads</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-chart-1" />
                    <span className="font-medium">{selectedRegion.studentsCount}</span>
                    <span className="text-muted-foreground">Students</span>
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute top-4 left-4 z-[1000] bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg">
              <p className="text-xs font-medium mb-2">Region Statistics</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary" />
                  <span>Leads & Students count</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Regions List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Top Regions</h4>
            {topRegions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No regional data yet</p>
            ) : (
              topRegions.map((region, index) => (
                <div
                  key={region.regionId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedRegion(region);
                    const coords = REGION_COORDINATES[region.regionId];
                    if (coords && mapRef.current) {
                      mapRef.current.setView(coords, 8, { animate: true });
                    }
                  }}
                >
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{region.regionName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{region.leadsCount} leads</span>
                      <span>•</span>
                      <span>{region.studentsCount} students</span>
                    </div>
                  </div>
                  <Badge variant="secondary">{region.total}</Badge>
                </div>
              ))
            )}

            {/* Summary Stats */}
            <div className="pt-4 border-t mt-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Summary</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-chart-2/10 text-center">
                  <p className="text-2xl font-bold text-chart-2">{totals.leads}</p>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </div>
                <div className="p-2 rounded-lg bg-chart-1/10 text-center">
                  <p className="text-2xl font-bold text-chart-1">{totals.students}</p>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
