# Plan: Kakao Map Flutter Fix

## Summary
Resolve the blank page issue in the Flutter app's map section. Update the Kakao Map HTML injection logic to robustly handle Kakao SDK domain or API key rejections and correctly trigger the Leaflet (OSM) fallback. Ensure the map view widget has explicit sizing constraints to prevent zero-height rendering.

## User Story
As a user, I want the map to reliably display either Kakao Map or a fallback map (OSM), so that I don't see a blank page when searching for universities.

## Problem → Solution
**Current state**: The Kakao SDK loads successfully even if the domain is rejected, meaning `script.onload` fires. However, since the SDK is just an error stub, `kakao.maps.load()` fails asynchronously. The exception bypasses the synchronous `try/catch`, preventing the Leaflet fallback from executing. The WebView also lacks explicit `Positioned.fill` sizing within its `Stack`.
**Desired state**: Implement a robust fallback strategy with timeout checks and direct validation of the `kakao.maps` object. Wrap the map webview with `Positioned.fill` to guarantee correct dimensions.

## Metadata
- **Complexity**: Small
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: 2

---

## UX Design

### Before
Map area renders a blank Navy background with no interactivity, and no error message.

### After
Map area renders Kakao Map if domain is whitelisted, or Leaflet OSM fallback map smoothly if Kakao fails or the domain acts as `srcdoc`.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Map Loading | Blank screen | Interactive Map | User can zoom and click markers regardless of Map provider. |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/features/map/presentation/widgets/university_map_html.dart` | all | Contains the HTML injection and fallback logic for Kakao to Leaflet. |
| P1 | `lib/features/map/presentation/widgets/university_map_view.dart` | 28-63 | Stack constraints that dictate WebView size. |

---

## Patterns to Mirror

### ASYNC_FALLBACK_PATTERN
```javascript
let mapInitialized = false;
function fallbackToOsm() {
    if (mapInitialized) return;
    mapInitialized = true;
    initLeafletMap();
}

script.onload = function() {
    if (typeof kakao === 'undefined' || !kakao.maps) {
        fallbackToOsm();
        return;
    }
    kakao.maps.load(function() {
        try {
            initKakaoMap();
            mapInitialized = true;
        } catch(e) {
            fallbackToOsm();
        }
    });
    setTimeout(function() {
        if (!mapInitialized) fallbackToOsm();
    }, 1500);
};
script.onerror = fallbackToOsm;
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `lib/features/map/presentation/widgets/university_map_html.dart` | UPDATE | Fix JS fallback to guarantee Leaflet initiation on Kakao failure. |
| `lib/features/map/presentation/widgets/university_map_view.dart` | UPDATE | Wrap `map_impl.buildMap` in `Positioned.fill` to guarantee rendering bounds. |

## NOT Building
- Rewriting mapping architecture to use native Kakao SDKs (staying with the WebView approach to support Web/Mobile parity).

---

## Step-by-Step Tasks

### Task 1: Fix Web Map Layout Constraints
- **ACTION**: Guarantee Web View sizing in `Stack`.
- **IMPLEMENT**: Open `university_map_view.dart` and wrap `map_impl.buildMap` inside a `Positioned.fill`.
- **VALIDATE**: WebView visually takes the full screen and no longer collapses to zero size.

### Task 2: Implement Robust Map JS Fallback
- **ACTION**: Enhance `university_map_html.dart` javascript load/onerror handlers.
- **IMPLEMENT**: Add a state variable `let mapInitialized = false;`, a dedicated `fallbackToOsm()` function that guards against multiple initializations, checks `kakao.maps` presence, and a `setTimeout` safety net.
- **GOTCHA**: Double initialization throws Leaflet "Map container is already initialized" error, hence the `mapInitialized` boolean flag is required.
- **VALIDATE**: In flutter web (where `srcdoc` is used, causing an origin mismatch), the Leaflet fallback map displays correctly after 1.5 seconds maximum.

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| Domain Block | Flutter web `HtmlElementView` | Kakao fails, Leaflet map renders after 1.5s timeout | Null Origin |

### Edge Cases Checklist
- [x] Kakao blocked by CORS/domain limits (return 200, but execution fails)
- [x] Network completely offline (script fails to load)
- [x] App constraints squeeze WebView to zero height.

---

## Validation Commands

### Flutter Analyze
```bash
cd hanguk_app && flutter analyze
```
EXPECT: No new issues in map files.

### Flutter Launch
```bash
cd hanguk_app && flutter run -d web-server --web-port 8080
```
EXPECT: Run successfully and Leaflet map appears when hitting `localhost:8080`.

---

## Acceptance Criteria
- [ ] All tasks completed
- [ ] Kakao gracefully degrades to Leaflet seamlessly
- [ ] Code follows discovered patterns
- [ ] Self-contained — no questions needed during implementation
