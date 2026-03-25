import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KAKAO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://map.kakao.com/',
};

interface PanoLink {
  id: number;
  lat: number;
  lng: number;
  angle: number;
}

// Fetch a single panorama by its ID
async function fetchPanoById(panoId: string) {
  const url = `https://rv.map.kakao.com/roadview-search/v2/node/${panoId}?SERVICE=glpano`;
  const res = await fetch(url, { headers: KAKAO_HEADERS });
  if (!res.ok) return null;
  return await res.json();
}

// Fetch nearby panoramas by coordinates
async function fetchPanosByCoords(lat: string, lng: string, rad = 300) {
  const url = `https://rv.map.kakao.com/roadview-search/v2/nodes?PX=${lng}&PY=${lat}&RAD=${rad}&PAGE_SIZE=5&INPUT=wgs&TYPE=w&SERVICE=glpano`;
  const res = await fetch(url, { headers: KAKAO_HEADERS });
  if (!res.ok) return null;
  return await res.json();
}

// Extract panorama info from a node object
function extractPanoInfo(node: any) {
  const panoId = node.id || node.panoid || node.panoId;
  const lat = node.wgsy || node.wlat || node.lat;
  const lng = node.wgsx || node.wlon || node.lng;
  const streetName = node.addr || node.st_name || node.street_name || '';
  const imagePath = node.img_path || node.imgPath || node.image_path || '';
  // Extract the image's intrinsic heading (compass direction the center faces)
  const heading = parseFloat(node.angle || node.pan || '0') || 0;
  return { panoId, lat: parseFloat(lat), lng: parseFloat(lng), streetName, imagePath, heading };
}

// Extract navigation links (spots) from a node
function extractLinks(node: any): PanoLink[] {
  const spots = node.spot || node.spots || [];
  if (!Array.isArray(spots)) return [];
  return spots.map((s: any) => ({
    id: parseInt(s.id || s.panoid || s.panoId || '0'),
    lat: parseFloat(s.wgsy || s.wlat || s.lat || '0'),
    lng: parseFloat(s.wgsx || s.wlon || s.lng || '0'),
    angle: parseFloat(s.pan || s.angle || '0'),
  })).filter((l: PanoLink) => l.id > 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const panoIdParam = url.searchParams.get('panoId');
    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');

    let node: any = null;
    let links: PanoLink[] = [];

    if (panoIdParam) {
      // ── Fetch by panorama ID (navigation) ──
      const data = await fetchPanoById(panoIdParam);
      if (!data) {
        return new Response(JSON.stringify({ available: false, error: 'Pano not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // The by-ID endpoint returns the node directly or nested
      node = data.street_view?.street || data.street?.node || data.node || data;
      links = extractLinks(node);

      // If no spots from the by-ID endpoint, fetch neighbors by the node's coords
      if (links.length === 0) {
        const info = extractPanoInfo(node);
        if (info.lat && info.lng) {
          const nearbyData = await fetchPanosByCoords(String(info.lat), String(info.lng), 50);
          if (nearbyData) {
            const streetList = nearbyData?.street_view?.streetList || nearbyData?.street?.nodes || [];
            // Find the current node and get its spots
            for (const n of streetList) {
              const nId = n.id || n.panoid || n.panoId;
              if (String(nId) === String(panoIdParam)) {
                links = extractLinks(n);
                break;
              }
            }
            // If still no links, use other nearby nodes as navigation targets
            if (links.length === 0) {
              links = streetList
                .filter((n: any) => String(n.id || n.panoid || n.panoId) !== String(panoIdParam))
                .map((n: any) => {
                  const nInfo = extractPanoInfo(n);
                  const info2 = extractPanoInfo(node);
                  // Calculate angle from current to neighbor
                  const dLng = nInfo.lng - info2.lng;
                  const dLat = nInfo.lat - info2.lat;
                  const angle = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
                  return {
                    id: parseInt(n.id || n.panoid || n.panoId || '0'),
                    lat: nInfo.lat,
                    lng: nInfo.lng,
                    angle,
                  };
                })
                .filter((l: PanoLink) => l.id > 0);
            }
          }
        }
      }
    } else if (lat && lng) {
      // ── Fetch by coordinates (initial load) ──
      const data = await fetchPanosByCoords(lat, lng);
      if (!data) {
        return new Response(JSON.stringify({ available: false, error: 'Kakao API error' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const streetList = data?.street_view?.streetList || data?.street?.nodes || [];
      if (!streetList || streetList.length === 0) {
        return new Response(JSON.stringify({ available: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      node = streetList[0];
      links = extractLinks(node);

      // If no spots on the nearest node, use other nearby nodes as navigation targets
      if (links.length === 0 && streetList.length > 1) {
        const info = extractPanoInfo(node);
        links = streetList.slice(1).map((n: any) => {
          const nInfo = extractPanoInfo(n);
          const dLng = nInfo.lng - info.lng;
          const dLat = nInfo.lat - info.lat;
          const angle = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
          return {
            id: parseInt(n.id || n.panoid || n.panoId || '0'),
            lat: nInfo.lat,
            lng: nInfo.lng,
            angle,
          };
        }).filter((l: PanoLink) => l.id > 0);
      }
    } else {
      return new Response(JSON.stringify({ error: 'lat+lng or panoId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!node) {
      return new Response(JSON.stringify({ available: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const info = extractPanoInfo(node);

    // Validate that we have a usable imagePath
    if (!info.imagePath) {
      return new Response(JSON.stringify({ available: false, error: 'No image path for this panorama' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      available: true,
      panoId: info.panoId,
      lat: info.lat,
      lng: info.lng,
      streetName: info.streetName,
      imagePath: info.imagePath,
      heading: info.heading,
      links,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in kakao-roadview-proxy:', error);
    return new Response(JSON.stringify({ available: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
