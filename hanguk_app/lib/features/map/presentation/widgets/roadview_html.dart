import '../../../../core/config/app_config.dart';

/// Generates the Kakao Roadview WebView HTML for a single campus.
///
/// Audit K2 (2026-05-11): the Kakao JS key is sourced from
/// [AppConfig.kakaoJsKey] (overridable via `--dart-define=KAKAO_JS_KEY=...`)
/// rather than hardcoded.
///
/// Audit P0 — Roadview radius (2026-05-11): the search radius was
/// previously 2000m which almost always returned a panorama, but
/// rarely one on campus — usually the nearest motor road. The
/// operator decision is to tighten to **200m**; if no panorama is
/// within 200m we show a clean empty state ("no street view here")
/// rather than auto-expanding the radius. Auto-expansion defeats the
/// purpose: it brings the drive-by panorama back.
///
/// The visible empty-state copy is loaded from `AppLocalizations` by
/// the caller (`UniversityRoadviewScreen`) and surfaced via a
/// `window.HangukRoadviewChannel` JS bridge when the WebView hits an
/// unavailable / error state. Inline English strings here are the
/// safe technical fallback if the JS bridge isn't wired.
String generateRoadviewHtml(double lat, double lng, String name) {
  final safeName = name.replaceAll("'", "\\'").replaceAll('"', '\\"');
  final kakaoJsKey = AppConfig.kakaoJsKey;

  return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        html, body { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #0f1626; }
        #roadview { width: 100%; height: 100%; }
        .loading-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-family: sans-serif;
            text-align: center;
            padding: 0 24px;
            max-width: 320px;
        }
        .loading-container h3 { font-weight: 600; margin-bottom: 8px; }
        .loading-container p  { color: rgba(255,255,255,0.6); font-size: 13px; margin: 0; }
        * { -webkit-tap-highlight-color: transparent; }
    </style>
</head>
<body>
    <div id="roadview">
        <div class="loading-container" id="loadingText">
            <h3>Loading $safeName...</h3>
            <p>Fetching street view near campus.</p>
        </div>
    </div>
    <script>
        function postState(state) {
            try {
                if (window.HangukRoadviewChannel) {
                    window.HangukRoadviewChannel.postMessage(state);
                }
            } catch (_) {}
        }

        function showMessage(title, subtitle) {
            var html = "<div class='loading-container'><h3>" + title + "</h3>";
            if (subtitle) html += "<p>" + subtitle + "</p>";
            html += "</div>";
            document.getElementById('roadview').innerHTML = html;
        }

        function triggerError(state, title, subtitle) {
            postState(state);
            showMessage(title, subtitle);
        }

        // Try Loading Kakao JS dynamically
        var script = document.createElement('script');
        script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=$kakaoJsKey&autoload=false";

        script.onload = function() {
            try {
                if (typeof kakao === 'undefined' || !kakao.maps) {
                    triggerError('sdk_blocked',
                        'Street view is unavailable',
                        'The map provider blocked this request. Try again on a different network.');
                    return;
                }

                kakao.maps.load(function() {
                    try {
                        var rvContainer = document.getElementById('roadview');
                        var rv = new kakao.maps.Roadview(rvContainer);
                        var rvClient = new kakao.maps.RoadviewClient();

                        var targetPosition = new kakao.maps.LatLng($lat, $lng);

                        // Audit P0 (2026-05-11): radius tightened from
                        // 2000m -> 200m so the panorama returned is on
                        // campus, not on the nearest motor road. NO
                        // auto-expand fallback: if no panorama is
                        // within 200m, show the empty state. Expanding
                        // defeats the purpose of the walkaround.
                        rvClient.getNearestPanoId(targetPosition, 200, function(panoId) {
                            if (panoId === null) {
                                triggerError('no_pano',
                                    'No street view here',
                                    'This campus does not have a walkable street view nearby.');
                            } else {
                                postState('ready');
                                rv.setPanoId(panoId, targetPosition);
                            }
                        });

                    } catch(e) {
                        triggerError('init_error', 'Street view could not start', e.message || '');
                    }
                });

            } catch (e) {
                triggerError('init_error', 'Street view could not start', e.message || '');
            }
        };
        script.onerror = function() {
            triggerError('network',
                'Could not reach the map provider',
                'Check your connection and try again.');
        };
        document.head.appendChild(script);
    </script>
</body>
</html>
''';
}
