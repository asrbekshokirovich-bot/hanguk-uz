import '../../../../core/config/app_config.dart';
import '../../domain/university.dart';

/// Generates the map WebView HTML.
///
/// Audit K2 (2026-05-11): Kakao JS key sourced from
/// [AppConfig.kakaoJsKey] (overridable via
/// `--dart-define=KAKAO_JS_KEY=...`).
///
/// Audit K8 / M7 (2026-05-11): Leaflet (the OSM fallback) is no
/// longer loaded eagerly in `<head>`. Previously every map render
/// downloaded ~150 KB of Leaflet CSS+JS even when Kakao succeeded.
/// The fallback now lazy-loads the Leaflet `<link>` and `<script>`
/// from inside `bootLeaflet()` and waits for them via `script.onload`
/// before initialising the map.
///
/// Audit M8 (2026-05-11): both the Kakao and the Leaflet paths now
/// auto-fit the camera to the marker bounds — a filtered list of 3
/// Seoul universities now zooms in, a national list shows all of
/// Korea. The hardcoded Korea-wide `(36.5, 127.8)` defaults are kept
/// as fallbacks for the no-markers case.
///
/// Audit M15 (2026-05-11): when more than 8 markers render on the
/// Kakao path, they are clustered via `kakao.maps.MarkerClusterer`
/// (loaded with `&libraries=clusterer`).
///
/// Audit M22 (2026-05-11): each Kakao marker shows an `InfoWindow`
/// preview ("name — tap for details") on click; the underlying tap
/// still raises the bottom sheet via `triggerAppEvent`.
///
/// Seoul Night (DESIGN_SPEC §3.5): the surface is dark — the page and
/// both map containers are filled with `mapWater`, and the raster
/// tiles of *both* providers are pushed to a navy night palette with a
/// CSS filter (neither Kakao nor OSM ships a dark basemap, and the
/// Kakao JS SDK has no map-style API). Pins are lime with a glow, and
/// the last-tapped pin grows and brightens. Colours below are CSS, so
/// they are literal hex — each carries the `Seoul*` token it mirrors.
String generateMapHtml(List<University> universities, {String locale = 'en'}) {
  final kakaoJsKey = AppConfig.kakaoJsKey;
  final validUnis = universities.where(
    (u) => u.latitude != null && u.longitude != null,
  );

  final kakaoMarkersJs = validUnis
      .map((u) {
        final safeName = u
            .nameForLocale(locale)
            .replaceAll("'", "\\'")
            .replaceAll('"', '\\"');
        return "addKakaoMarker('${u.id}', ${u.latitude}, ${u.longitude}, '$safeName');";
      })
      .join('\n');

  final leafletMarkersJs = validUnis
      .map((u) {
        final safeName = u
            .nameForLocale(locale)
            .replaceAll("'", "\\'")
            .replaceAll('"', '\\"');
        return "addLeafletMarker('${u.id}', ${u.latitude}, ${u.longitude}, '$safeName');";
      })
      .join('\n');

  return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        /* #0C1830 = SeoulColors.mapWater */
        html, body { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #0C1830; }
        #map { width: 100%; height: 100%; background-color: #0C1830; /* SeoulColors.mapWater */ }
        * { -webkit-tap-highlight-color: transparent; }

        /* ── Dark basemap ──────────────────────────────────────────
           Neither provider offers a night style, so the raster tiles
           are re-graded in CSS. The selectors are deliberately narrow
           (Kakao base tiles / Leaflet tiles only) so pins, cluster
           bubbles and the provider logo keep their own colours. If a
           provider ever changes its tile URLs the rule simply stops
           matching and the map falls back to its default look. */
        #map img[src*="map_2d"] {
            filter: invert(1) hue-rotate(190deg) saturate(0.55) brightness(0.80) contrast(1.05);
        }
        .leaflet-container { background: #0C1830; /* SeoulColors.mapWater */ }
        .leaflet-tile {
            filter: invert(1) hue-rotate(190deg) saturate(0.55) brightness(0.80) contrast(1.05);
        }
        .leaflet-control-attribution {
            background: rgba(12,24,48,0.75) !important; /* SeoulColors.mapWater */
            color: rgba(255,255,255,0.40) !important;   /* SeoulColors.textFaint */
            font-size: 10px;
        }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.55) !important; /* SeoulColors.textSecondary */ }

        /* ── Lime glow pins (spec §3.5) ────────────────────────────
           #D4E94C = SeoulColors.lime · #E2F26A = SeoulColors.limeBright
           the shadow mirrors SeoulShadows.limeGlowSmall. */
        .hg-pin {
            box-sizing: border-box;
            border-radius: 50%;
            background: #D4E94C;
            border: 2px solid #E2F26A;
            box-shadow: 0 0 12px rgba(212,233,76,0.70);
        }
        .hg-pin-sel {
            box-shadow: 0 0 20px rgba(212,233,76,0.95);
        }

        /* Kakao renders the InfoWindow inside its own light bubble, so
           the preview keeps ink text rather than fighting that chrome.
           #0A1A34 = SeoulColors.ink. */
        .hg-infowindow {
            color: #0A1A34;
            font-family: sans-serif;
            font-size: 12px;
            padding: 6px 10px;
            line-height: 1.3;
            max-width: 180px;
        }
        .hg-infowindow b { display: block; margin-bottom: 2px; font-weight: 700; }
        .hg-infowindow span { color: rgba(10,26,52,0.6); /* SeoulColors.ink @ 60% */ }

        /* Loading / failure copy inside the map surface. */
        .hg-map-message {
            color: rgba(255,255,255,0.55); /* SeoulColors.textSecondary */
            font-family: sans-serif;
            font-size: 13px;
            text-align: center;
            padding: 40% 24px 0;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        function triggerAppEvent(id) {
            if (window.HangukMapChannel) window.HangukMapChannel.postMessage(id);
            if (window.parent) window.parent.postMessage({ type: 'HangukMapClick', id: id }, '*');
        }

        function mapMessage(text) {
            document.getElementById('map').innerHTML =
                "<div class='hg-map-message'>" + text + "</div>";
        }

        // Lime glow pin as an SVG data URI. encodeURIComponent keeps the
        // '#' of each hex colour valid inside the data: URI.
        // #D4E94C = SeoulColors.lime · #E2F26A = SeoulColors.limeBright
        function pinSvg(size) {
            var c = size / 2;
            var svg =
                "<svg xmlns='http://www.w3.org/2000/svg' width='" + size + "' height='" + size + "'>" +
                "<circle cx='" + c + "' cy='" + c + "' r='" + (c - 1) + "' fill='#D4E94C' opacity='0.20'/>" +
                "<circle cx='" + c + "' cy='" + c + "' r='" + (c * 0.62) + "' fill='#D4E94C' opacity='0.35'/>" +
                "<circle cx='" + c + "' cy='" + c + "' r='" + (c * 0.40) + "' fill='#D4E94C' stroke='#E2F26A' stroke-width='1.6'/>" +
                "</svg>";
            return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        }

        var __kakaoMarkers = [];

        // ── Kakao path ────────────────────────────────────────────
        function initKakaoMap() {
            var mapContainer = document.getElementById('map');
            var mapOption = { center: new kakao.maps.LatLng(36.5, 127.8), level: 13 };
            var map = new kakao.maps.Map(mapContainer, mapOption);

            // Audit M15: cluster when many markers. clusterer is loaded
            // via &libraries=clusterer on the SDK URL.
            var clusterer = null;
            if (typeof kakao.maps.MarkerClusterer === 'function') {
                clusterer = new kakao.maps.MarkerClusterer({
                    map: map,
                    averageCenter: true,
                    minLevel: 6,
                    minClusterSize: 3,
                    // Visual only — the clustering behaviour above is
                    // unchanged. Lime bubble, ink count (spec §3.5).
                    styles: [{
                        width: '40px',
                        height: '40px',
                        background: 'rgba(212,233,76,0.88)', /* SeoulColors.lime */
                        border: '2px solid #E2F26A',         /* SeoulColors.limeBright */
                        borderRadius: '20px',
                        color: '#0A1A34',                    /* SeoulColors.ink */
                        textAlign: 'center',
                        lineHeight: '40px',
                        fontWeight: '700',
                        fontSize: '13px',
                        boxShadow: '0 0 16px rgba(212,233,76,0.55)'
                    }]
                });
            }

            // Audit M22: shared InfoWindow preview.
            var infoWindow = new kakao.maps.InfoWindow({ removable: false, zIndex: 3 });

            var pinImage = new kakao.maps.MarkerImage(
                pinSvg(22), new kakao.maps.Size(22, 22),
                { offset: new kakao.maps.Point(11, 11) }
            );
            var pinImageSelected = new kakao.maps.MarkerImage(
                pinSvg(34), new kakao.maps.Size(34, 34),
                { offset: new kakao.maps.Point(17, 17) }
            );
            var selectedKakaoMarker = null;

            function addKakaoMarker(id, lat, lng, title) {
                var markerPosition = new kakao.maps.LatLng(lat, lng);
                var marker = new kakao.maps.Marker({
                    position: markerPosition,
                    title: title,
                    image: pinImage,
                });
                __kakaoMarkers.push({ marker: marker, lat: lat, lng: lng });
                kakao.maps.event.addListener(marker, 'click', function() {
                    // Selected pin grows and brightens (spec §3.5).
                    if (selectedKakaoMarker && selectedKakaoMarker !== marker) {
                        selectedKakaoMarker.setImage(pinImage);
                        selectedKakaoMarker.setZIndex(1);
                    }
                    marker.setImage(pinImageSelected);
                    marker.setZIndex(10);
                    selectedKakaoMarker = marker;

                    var html =
                        "<div class='hg-infowindow'><b>" + title + "</b>" +
                        "<span>Tap for details</span></div>";
                    infoWindow.setContent(html);
                    infoWindow.open(map, marker);
                    triggerAppEvent(id);
                });
            }

            // Inject Kakao Markers
            $kakaoMarkersJs

            if (clusterer && __kakaoMarkers.length > 0) {
                var ms = __kakaoMarkers.map(function (e) { return e.marker; });
                clusterer.addMarkers(ms);
            } else {
                for (var i = 0; i < __kakaoMarkers.length; i++) {
                    __kakaoMarkers[i].marker.setMap(map);
                }
            }

            // Audit M8: fit camera to marker bounds.
            if (__kakaoMarkers.length > 0) {
                var bounds = new kakao.maps.LatLngBounds();
                for (var j = 0; j < __kakaoMarkers.length; j++) {
                    bounds.extend(new kakao.maps.LatLng(
                        __kakaoMarkers[j].lat,
                        __kakaoMarkers[j].lng
                    ));
                }
                map.setBounds(bounds);
            }
        }

        // ── Leaflet (OSM) fallback path ──────────────────────────
        function bootLeaflet() {
            // Audit K8 / M7: lazy-load Leaflet CSS+JS only when we
            // need it. Attach the CSS link and the JS script element
            // here, and only call initLeafletMap() once the script's
            // onload fires (so window.L is defined).
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);

            var leafletScript = document.createElement('script');
            leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            leafletScript.crossOrigin = '';
            leafletScript.onload = initLeafletMap;
            leafletScript.onerror = function () {
                mapMessage('Map provider unavailable.');
            };
            document.head.appendChild(leafletScript);
        }

        function initLeafletMap() {
            if (!window.L) {
                mapMessage('Error: Leaflet SDK could not be loaded.');
                return;
            }
            try {
                // The attribution control defaults to the bottom-right,
                // which is exactly where the 한 orb floats — move it to
                // the bottom-left so nothing sits under the orb (spec §4).
                var map = L.map('map', { attributionControl: false }).setView([36.5, 127.8], 7);
                L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 19,
                }).addTo(map);

                var __leafletMarkers = [];

                var pinDefault = L.divIcon({ className: 'hg-pin', iconSize: [14, 14] });
                var pinSelected = L.divIcon({ className: 'hg-pin hg-pin-sel', iconSize: [22, 22] });
                var selectedLeafletMarker = null;

                function addLeafletMarker(id, lat, lng, title) {
                    var marker = L.marker([lat, lng], { icon: pinDefault }).addTo(map);
                    marker.bindTooltip(title, { direction: 'top', offset: [0, -8] });
                    marker.on('click', function () {
                        // Selected pin grows and brightens (spec §3.5).
                        if (selectedLeafletMarker && selectedLeafletMarker !== marker) {
                            selectedLeafletMarker.setIcon(pinDefault);
                        }
                        marker.setIcon(pinSelected);
                        selectedLeafletMarker = marker;
                        triggerAppEvent(id);
                    });
                    __leafletMarkers.push(marker);
                }

                // Inject Leaflet Markers
                $leafletMarkersJs

                // Audit M8: auto-fit bounds for Leaflet too.
                if (__leafletMarkers.length > 0) {
                    var group = L.featureGroup(__leafletMarkers);
                    map.fitBounds(group.getBounds(), { padding: [40, 40] });
                }

                setTimeout(function() { map.invalidateSize(); }, 600);
            } catch (e) {
                mapMessage('Error initializing map: ' + (e.message || ''));
            }
        }

        var mapInitialized = false;
        function fallbackToOsm() {
            if (mapInitialized) return;
            mapInitialized = true;
            bootLeaflet();
        }

        // Try loading Kakao JS dynamically.
        var script = document.createElement('script');
        // libraries=clusterer enables MarkerClusterer (audit M15).
        script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=$kakaoJsKey&autoload=false&libraries=clusterer";
        script.onload = function() {
            try {
                if (typeof kakao === 'undefined' || !kakao.maps) {
                    fallbackToOsm();
                    return;
                }
                kakao.maps.load(function() {
                    try {
                        initKakaoMap();
                        mapInitialized = true;
                    } catch (e) {
                        fallbackToOsm();
                    }
                });
                setTimeout(function() {
                    if (!mapInitialized) fallbackToOsm();
                }, 1500);
            } catch (e) {
                fallbackToOsm();
            }
        };
        script.onerror = fallbackToOsm;
        document.head.appendChild(script);
    </script>
</body>
</html>
''';
}
