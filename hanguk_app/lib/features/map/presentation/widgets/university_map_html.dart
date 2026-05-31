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
        html, body { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #0f1626; }
        #map { width: 100%; height: 100%; }
        * { -webkit-tap-highlight-color: transparent; }
        .leaflet-custom-marker {
            background-color: #1e40af;
            border: 2px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        .hg-infowindow {
            color: #0f1626;
            font-family: sans-serif;
            font-size: 12px;
            padding: 6px 10px;
            line-height: 1.3;
            max-width: 180px;
        }
        .hg-infowindow b { display: block; margin-bottom: 2px; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        function triggerAppEvent(id) {
            if (window.HangukMapChannel) window.HangukMapChannel.postMessage(id);
            if (window.parent) window.parent.postMessage({ type: 'HangukMapClick', id: id }, '*');
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
                });
            }

            // Audit M22: shared InfoWindow preview.
            var infoWindow = new kakao.maps.InfoWindow({ removable: false, zIndex: 3 });

            function addKakaoMarker(id, lat, lng, title) {
                var markerPosition = new kakao.maps.LatLng(lat, lng);
                var marker = new kakao.maps.Marker({
                    position: markerPosition,
                    title: title,
                });
                __kakaoMarkers.push({ marker: marker, lat: lat, lng: lng });
                kakao.maps.event.addListener(marker, 'click', function() {
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
                document.getElementById('map').innerHTML =
                    "<div style='color:white;text-align:center;padding-top:40%;'>" +
                    "Map provider unavailable.</div>";
            };
            document.head.appendChild(leafletScript);
        }

        function initLeafletMap() {
            if (!window.L) {
                document.getElementById('map').innerHTML =
                    "<div style='color:white;text-align:center;padding-top:40%;'>" +
                    "Error: Leaflet SDK could not be loaded.</div>";
                return;
            }
            try {
                var map = L.map('map').setView([36.5, 127.8], 7);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 19,
                }).addTo(map);

                var __leafletMarkers = [];

                function addLeafletMarker(id, lat, lng, title) {
                    var icon = L.divIcon({
                        className: 'leaflet-custom-marker',
                        iconSize: [16, 16],
                    });
                    var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
                    marker.bindTooltip(title, { direction: 'top', offset: [0, -8] });
                    marker.on('click', function () {
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
                document.getElementById('map').innerHTML =
                    "<div style='color:white;text-align:center;padding-top:40%;'>" +
                    "Error initializing map: " + (e.message || '') + "</div>";
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
