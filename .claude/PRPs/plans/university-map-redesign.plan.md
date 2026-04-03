# Plan: University Map Tab — Native Kakao Maps Redesign

## Summary
The current Map tab (165 lines) embeds `https://hanguk.vercel.app/map` inside a WebView — it is slow, fragile, and breaks whenever the web app changes or is offline. The Supabase `universities` table already has 212 universities with real latitude/longitude coordinates, logo URLs, rankings, and tuition data. We will replace the WebView entirely with a **native two-mode experience** using the `kakao_maps_flutter` SDK: a rich searchable List View and an interactive Kakao Map with 212 real university pins, using the existing Kakao app key (`bce5c81e0cedaaa8cdc5334d39ab38ed`) from the Hanguk.uz Kakao developer account.

## User Story
As a student, I want to browse and explore Korean universities natively inside the app using either a searchable list or an interactive map, so that I can find universities quickly without loading a slow external website.

## Problem → Solution
WebView loading external URL (slow, breaks on network issues, off-brand) → Native Flutter with Kakao Maps SDK showing 212 pinned universities on a real map + rich searchable list with logos, rankings, and filters.

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: 8 (3 new, 5 modified)

---

## Confirmed External Data

### Kakao Developer Account (Hanguk.uz — App ID: 1386902)
- **Native App Key**: `bce5c81e0cedaaa8cdc5334d39ab38ed` ← use this for SDK init
- **REST API Key**: `f5d35bc8ecf75c7114fb8e6bb2a1c49f`
- **JavaScript Key**: `2adc9e885631028016648c711fdf881b`
- **Admin Key**: `8b841e89c58351249ee7ac5cb0ce8ef7`

### Android App Identity
- **Package Name**: `com.hanguk.studentapp.hanguk_app`
- **File**: `android/app/build.gradle.kts:24`

### Supabase `universities` Table — Confirmed Columns
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name_en` | text | English display name |
| `city_en` | text | City in English |
| `latitude` | float8 | Populated for **212** universities |
| `longitude` | float8 | Populated for **212** universities |
| `logo_url` | text | Many populated (Image.network + fallback) |
| `ranking` | int | Can be null — show "N/A" |
| `local_rank` | int | Korean ranking |
| `acceptance_rate` | float | Can be null |
| `tuition_min` | int | Can be null |
| `tuition_max` | int | Can be null |
| `is_partner` | bool | Currently 0 partners — handle gracefully |
| `is_visible_on_map` | bool | Filter flag — always use `.eq('is_visible_on_map', true)` |
| `description_en` | text | For detail bottom sheet |
| `website_url` | text | For "Visit Website" button |

---

## UX Design

### Before
```
┌────────────────────────────────────────┐
│  AppBar: "University Locations"        │
│  [CircularProgressIndicator — 3-5s]   │
│  ┌──────────────────────────────────┐  │
│  │   WebView: hanguk.vercel.app/map  │  │
│  │   (external website embedded)    │  │
│  └──────────────────────────────────┘  │
│  OR (on error):                        │
│  [Plain text list, no search, no map]  │
└────────────────────────────────────────┘
```

### After
```
┌────────────────────────────────────────┐
│  ┌────────────────────────────────┐   │
│  │ 🔍  Search universities...    │   │
│  └────────────────────────────────┘   │
│  [ All ] [ Partner ] [ Top 100 ]  [≡/🗺]│
│  ────────────────────────────────────  │
│  LIST MODE:                            │
│  ┌──────────────────────────────────┐  │
│  │[🏫] Seoul National University   │  │
│  │      Seoul  ·  Rank #1      →   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │[🏫] Yonsei University           │  │
│  │      Seoul  ·  Rank #2      →   │  │
│  └──────────────────────────────────┘  │
│  ────────────────────────────────────  │
│  MAP MODE:                             │
│  ┌──────────────────────────────────┐  │
│  │  [Kakao Map — Korea overview]    │  │
│  │   📍📍📍 212 real pins           │  │
│  │   [tap pin → bottom sheet]       │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Open Map tab | WebView loads 3-5s | Instant list from Supabase | uses FutureProvider cache |
| Search universities | Not available | Real-time text filter | `TextEditingController` local state |
| Filter by type | Not available | All / Partner / Top 100 chip | `FilterChip` widgets |
| Toggle view mode | Not available | List ↔ Map button in AppBar | `AnimatedSwitcher` |
| View map | External website | Native Kakao Map — 212 pins | `kakao_maps_flutter` |
| Tap map pin | Not possible | `showModalBottomSheet` detail | Shows name, city, rank, tuition, link |
| Tap list card | Not possible | Same `showModalBottomSheet` detail | Identical sheet |
| Error state | Blank / broken | Friendly error + retry button | `mounted` check + `ref.refresh` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/features/map/presentation/map_tab.dart` | 1–165 | File being fully replaced |
| P0 | `lib/features/map/domain/university.dart` | 1–21 | Model being extended |
| P0 | `lib/features/map/data/map_repository.dart` | 1–26 | Query being updated |
| P0 | `lib/design_system/adaptive/hanguk_card.dart` | 1–50 | Card base widget to use |
| P0 | `lib/design_system/theme/app_colors.dart` | 1–37 | All brand colors |
| P1 | `lib/features/applications/presentation/widgets/application_card.dart` | 1–123 | Logo + fallback pattern to mirror exactly |
| P1 | `lib/features/chat/presentation/chat_tab.dart` | 5–41 | `ConsumerStatefulWidget` + `TextEditingController` dispose pattern |
| P1 | `lib/features/home/presentation/home_screen.dart` | 1–48 | How `MapTab` is mounted in `IndexedStack` |
| P2 | `lib/features/documents/presentation/documents_tab.dart` | 7–84 | `CustomScrollView` + `SliverAppBar` pattern |
| P2 | `android/app/src/main/AndroidManifest.xml` | 8–49 | Where to insert Kakao `meta-data` tag |

---

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `kakao_maps_flutter` setup | pub.dev/packages/kakao_maps_flutter | Requires `KakaoMapsFlutter.init('KEY')` before `runApp` |
| Kakao Map widget | pub.dev | `KakaoMap(onMapCreated: (ctrl) {}, initialPosition: LatLng(...), initialLevel: 8)` |
| Marker API | pub.dev | `controller.addMarker(markerOption: MarkerOption(id: '...', latLng: LatLng(...)))` |
| InfoWindow API | pub.dev | `controller.addInfoWindow(InfoWindowOption(id, latLng, title, snippet, offset))` |
| Label click | pub.dev | `controller.onLabelClickedStream.listen((e) => ...)` |
| Gradle repo | pub.dev troubleshooting | Must add `maven { url 'https://devrepo.kakao.com/nexus/repository/kakaomap-releases/' }` to `android/build.gradle` |
| Kakao Android SDK | apis.map.kakao.com/android_v2 | `meta-data` key name is `com.kakao.sdk.AppKey` |
| Package version | pub.dev | Use `^0.1.2` (latest stable); `^0.2.0-beta.1` is beta |

---

## Patterns to Mirror

### NAMING_CONVENTION
```dart
// SOURCE: lib/features/map/domain/university.dart:4–19
// SOURCE: lib/features/chat/presentation/chat_tab.dart:5–10
// PascalCase widgets, camelCase fields, _ prefix for private state
class UniversityMapView extends StatefulWidget { ... }
class _UniversityMapViewState extends State<UniversityMapView> { ... }
class UniversityDetailSheet extends StatelessWidget { ... }
final TextEditingController _searchController = TextEditingController();
bool _isMapMode = false;
String _activeFilter = 'all'; // 'all' | 'partner' | 'top100'
```

### SUPABASE_QUERY_PATTERN
```dart
// SOURCE: lib/features/map/data/map_repository.dart:9–12
// SOURCE: lib/features/applications/data/applications_repository.dart:14–18
final data = await Supabase.instance.client
    .from('universities')
    .select('id, name_en, city_en, latitude, longitude, logo_url, '
            'ranking, local_rank, acceptance_rate, tuition_min, tuition_max, '
            'is_partner, is_visible_on_map, website_url, description_en')
    .eq('is_visible_on_map', true)
    .order('ranking', ascending: true, nullsFirst: false);
```

### CONSUMER_STATEFUL_PATTERN
```dart
// SOURCE: lib/features/chat/presentation/chat_tab.dart:5–41
class MapTab extends ConsumerStatefulWidget {
  const MapTab({super.key});
  @override
  ConsumerState<MapTab> createState() => _MapTabState();
}
class _MapTabState extends ConsumerState<MapTab> {
  final TextEditingController _searchController = TextEditingController();
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
```

### CARD_PATTERN
```dart
// SOURCE: lib/design_system/adaptive/hanguk_card.dart:23–48
// SOURCE: lib/features/applications/presentation/widgets/application_card.dart:21–22
HangukCard(
  onTap: () => _showDetail(context, university),
  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  child: Row(children: [...]),
)
```

### LOGO_WITH_FALLBACK_PATTERN
```dart
// SOURCE: lib/features/applications/presentation/widgets/application_card.dart:29–41
if (university.logoUrl != null)
  ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: Image.network(
      university.logoUrl!,
      width: 48, height: 48, fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) => _fallbackLogo(),
    ),
  )
else
  _fallbackLogo(),
// fallback:
Widget _fallbackLogo() => Container(
  width: 48, height: 48,
  decoration: BoxDecoration(
    color: AppColors.vibrantLime.withOpacity(0.1),
    borderRadius: BorderRadius.circular(12),
  ),
  child: const Icon(Icons.school_outlined, color: AppColors.vibrantLime),
);
```

### PARTNER_CHIP_PATTERN
```dart
// SOURCE: lib/features/applications/presentation/widgets/application_card.dart:58–73
if (university.isPartner)
  Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: AppColors.vibrantLime.withOpacity(0.1),
      borderRadius: BorderRadius.circular(12),
    ),
    child: const Text('Partner',
      style: TextStyle(fontSize: 10, color: AppColors.vibrantLime, fontWeight: FontWeight.bold),
    ),
  ),
```

### ERROR_STATE_PATTERN
```dart
// SOURCE: lib/features/applications/presentation/applications_tab.dart:60–62
error: (err, stack) => SliverFillRemaining(
  child: Center(child: Text('Error: $err')),
),
```

### SCAFFOLD_BACKGROUND_PATTERN
```dart
// SOURCE: lib/features/chat/presentation/chat_tab.dart:53–54
// SOURCE: lib/features/applications/presentation/applications_tab.dart: (no Scaffold, uses CustomScrollView inside HangukScaffold)
// MapTab is mounted inside HangukScaffold in home_screen.dart — so the gradient is already provided.
// Use Colors.transparent for any inner Scaffold bgcolor.
return Scaffold(backgroundColor: Colors.transparent, ...);
// OR skip Scaffold entirely and return CustomScrollView directly.
```

### BOTTOM_SHEET_PATTERN
```dart
// SOURCE: lib/features/applications/presentation/widgets/university_room_modal.dart (inferred)
// Standard Flutter bottom sheet:
showModalBottomSheet(
  context: context,
  isScrollControlled: true,
  backgroundColor: AppColors.darkSlate,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
  ),
  builder: (ctx) => UniversityDetailSheet(university: university),
);
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `pubspec.yaml` | UPDATE | Add `kakao_maps_flutter: ^0.1.2` |
| `android/build.gradle` | UPDATE | Add Kakao maven repository |
| `android/app/src/main/AndroidManifest.xml` | UPDATE | Add `com.kakao.sdk.AppKey` meta-data inside `<application>` |
| `lib/main.dart` | UPDATE | Add `KakaoMapsFlutter.init('bce5c81e0cedaaa8cdc5334d39ab38ed')` before `runApp` |
| `lib/features/map/domain/university.dart` | UPDATE | Add lat, lng, logoUrl, ranking, localRank, tuition, acceptance, website, description fields |
| `lib/features/map/data/map_repository.dart` | UPDATE | Fetch all new columns, order by ranking nulls-last |
| `lib/features/map/presentation/widgets/university_card.dart` | CREATE | Extracted list card widget (logo, rank badge, city, partner chip, tap) |
| `lib/features/map/presentation/widgets/university_detail_sheet.dart` | CREATE | Bottom sheet with full university details |
| `lib/features/map/presentation/widgets/university_map_view.dart` | CREATE | KakaoMap widget with 212 pins, tap → detail sheet |
| `lib/features/map/presentation/map_tab.dart` | REWRITE | Search bar, filter chips, list/map toggle, AnimatedSwitcher |

## NOT Building
- Full-page university route (bottom sheet is sufficient)
- Directions / routing to university location
- Real-time Supabase subscriptions on the map
- iOS-specific setup (Android only for now — iOS needs separate Kakao config)
- University creation/editing from the app
- Key hash registration in Kakao console (done manually as pre-step)

---

## PRE-IMPLEMENTATION STEP (manual, one-time)

Before running the code, you must register the Android platform in the Kakao Developers Console:
1. Go to https://developers.kakao.com/console/app → Hanguk.uz → **플랫폼** (Platform)
2. Add Android platform with:
   - **Package Name**: `com.hanguk.studentapp.hanguk_app`
   - **Key Hash**: run `keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64` and paste the output
3. This is required by Kakao SDK to authorize map requests from the Android app.

---

## Step-by-Step Tasks

### Task 1: Add kakao_maps_flutter to pubspec.yaml
- **ACTION**: Add `kakao_maps_flutter: ^0.1.2` to `dependencies` section of `pubspec.yaml`
- **IMPLEMENT**: After line 47 (`open_filex: ^4.7.0`):
  ```yaml
    kakao_maps_flutter: ^0.1.2
  ```
- **GOTCHA**: Package version `0.1.2` is latest stable. `0.2.0-beta.1` exists but is beta — avoid.
- **VALIDATE**: `flutter pub get` resolves without conflict

### Task 2: Add Kakao Maven Repository to android/build.gradle
- **ACTION**: Locate `android/build.gradle` (NOT `android/app/build.gradle.kts`) and add the Kakao maven repo
- **IMPLEMENT**: Check `android/build.gradle`. If there is an `allprojects { repositories { ... } }` block, add:
  ```groovy
  maven { url 'https://devrepo.kakao.com/nexus/repository/kakaomap-releases/' }
  ```
  If the project uses `settings.gradle` repositories instead, add to `dependencyResolutionManagement { repositories { ... } }`.
- **GOTCHA**: Without this, the build will fail with `Could not find com.kakao.maps.open:android:2.12.8.`
- **VALIDATE**: Run `flutter pub get` — no Gradle resolution errors

### Task 3: Add Kakao AppKey to AndroidManifest.xml
- **ACTION**: Add Kakao Native App Key as `meta-data` inside the `<application>` tag
- **IMPLEMENT**: In `android/app/src/main/AndroidManifest.xml`, after line 38 (`flutterEmbedding` meta-data):
  ```xml
  <meta-data
      android:name="com.kakao.sdk.AppKey"
      android:value="bce5c81e0cedaaa8cdc5334d39ab38ed" />
  ```
- **GOTCHA**: The key name MUST be `com.kakao.sdk.AppKey` exactly. Wrong name = silent auth failure.
- **VALIDATE**: XML is valid (no unclosed tags), file saves correctly

### Task 4: Initialize Kakao SDK in main.dart
- **ACTION**: Add `KakaoMapsFlutter.init(...)` before `runApp`
- **IMPLEMENT**: Read `lib/main.dart` first. Find `void main()` and add:
  ```dart
  import 'package:kakao_maps_flutter/kakao_maps_flutter.dart';

  void main() async {
    WidgetsFlutterBinding.ensureInitialized();
    await KakaoMapsFlutter.init('bce5c81e0cedaaa8cdc5334d39ab38ed');
    // ... existing Supabase init and runApp(...)
  }
  ```
- **MIRROR**: `CONSUMER_STATEFUL_PATTERN` — always `ensureInitialized()` before async init
- **GOTCHA**: If `ensureInitialized()` is already called (for Supabase), just add the `KakaoMapsFlutter.init` line after it.
- **VALIDATE**: App runs without `Unhandled Exception: SDK not initialized` crash

### Task 5: Extend University Domain Model
- **ACTION**: Replace contents of `lib/features/map/domain/university.dart`
- **IMPLEMENT**:
  ```dart
  import 'package:flutter/foundation.dart';

  @immutable
  class University {
    final String id;
    final String name;         // name_en
    final String location;     // city_en
    final double? latitude;
    final double? longitude;
    final String? logoUrl;
    final int? ranking;
    final int? localRank;
    final double? acceptanceRate;
    final int? tuitionMin;
    final int? tuitionMax;
    final bool isPartner;
    final bool isVisibleOnMap;
    final String? website;
    final String? descriptionEn;

    const University({
      required this.id,
      required this.name,
      required this.location,
      this.latitude,
      this.longitude,
      this.logoUrl,
      this.ranking,
      this.localRank,
      this.acceptanceRate,
      this.tuitionMin,
      this.tuitionMax,
      this.isPartner = false,
      this.isVisibleOnMap = true,
      this.website,
      this.descriptionEn,
    });
  }
  ```
- **GOTCHA**: The old model had `isAdmitted` field — remove it. Check `applications_repository.dart` still compiles (it doesn't use `isAdmitted`).
- **VALIDATE**: `flutter analyze` passes — no compile errors in any file that imports `University`

### Task 6: Update Map Repository
- **ACTION**: Replace contents of `lib/features/map/data/map_repository.dart`
- **IMPLEMENT**:
  ```dart
  import 'package:flutter_riverpod/flutter_riverpod.dart';
  import 'package:supabase_flutter/supabase_flutter.dart';
  import '../domain/university.dart';

  final universitiesProvider = FutureProvider<List<University>>((ref) async {
    try {
      final data = await Supabase.instance.client
          .from('universities')
          .select(
            'id, name_en, city_en, latitude, longitude, logo_url, '
            'ranking, local_rank, acceptance_rate, tuition_min, tuition_max, '
            'is_partner, is_visible_on_map, website_url, description_en',
          )
          .eq('is_visible_on_map', true)
          .order('ranking', ascending: true, nullsFirst: false);

      return (data as List)
          .map((row) => University(
                id: row['id'] as String,
                name: row['name_en'] as String? ?? 'Unknown University',
                location: row['city_en'] as String? ?? 'South Korea',
                latitude: (row['latitude'] as num?)?.toDouble(),
                longitude: (row['longitude'] as num?)?.toDouble(),
                logoUrl: row['logo_url'] as String?,
                ranking: row['ranking'] as int?,
                localRank: row['local_rank'] as int?,
                acceptanceRate: (row['acceptance_rate'] as num?)?.toDouble(),
                tuitionMin: row['tuition_min'] as int?,
                tuitionMax: row['tuition_max'] as int?,
                isPartner: row['is_partner'] as bool? ?? false,
                isVisibleOnMap: row['is_visible_on_map'] as bool? ?? true,
                website: row['website_url'] as String?,
                descriptionEn: row['description_en'] as String?,
              ))
          .toList();
    } catch (_) {
      return [];
    }
  });
  ```
- **MIRROR**: `SUPABASE_QUERY_PATTERN`
- **VALIDATE**: `ref.watch(universitiesProvider)` returns 212 items when online

### Task 7: Create University Card Widget
- **ACTION**: Create `lib/features/map/presentation/widgets/university_card.dart`
- **IMPLEMENT**: Premium list card using `HangukCard` with logo, name, city, ranking badge, partner chip, chevron
- **MIRROR**: `CARD_PATTERN`, `LOGO_WITH_FALLBACK_PATTERN`, `PARTNER_CHIP_PATTERN`
- **IMPORTS**:
  ```dart
  import 'package:flutter/material.dart';
  import '../../../../design_system/adaptive/hanguk_card.dart';
  import '../../../../design_system/theme/app_colors.dart';
  import '../../domain/university.dart';
  ```
- **KEY STRUCTURE**:
  ```dart
  class UniversityCard extends StatelessWidget {
    final University university;
    final VoidCallback? onTap;
    const UniversityCard({super.key, required this.university, this.onTap});

    @override
    Widget build(BuildContext context) {
      return HangukCard(
        onTap: onTap,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            // Logo (48x48) with fallback
            _buildLogo(),
            const SizedBox(width: 12),
            // Name + City column
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(university.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
                Text(university.location, style: const TextStyle(color: Colors.white54, fontSize: 13)),
              ],
            )),
            // Ranking badge
            _buildRankBadge(),
            if (university.isPartner) _buildPartnerChip(),
            const Icon(Icons.chevron_right, color: Colors.white38),
          ],
        ),
      );
    }

    Widget _buildRankBadge() {
      if (university.ranking == null) return const SizedBox.shrink();
      final isTop100 = university.ranking! <= 100;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        margin: const EdgeInsets.only(right: 8),
        decoration: BoxDecoration(
          color: isTop100 ? AppColors.vibrantLime.withOpacity(0.15) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text('#${university.ranking}',
          style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.bold,
            color: isTop100 ? AppColors.vibrantLime : Colors.white54,
          ),
        ),
      );
    }
  }
  ```
- **GOTCHA**: Use `EdgeInsets.only(right: 8)` on rank badge — not symmetric — to leave space for chevron
- **VALIDATE**: Cards render in list without overflow errors

### Task 8: Create University Detail Bottom Sheet
- **ACTION**: Create `lib/features/map/presentation/widgets/university_detail_sheet.dart`
- **IMPLEMENT**: `StatelessWidget` shown via `showModalBottomSheet`
- **KEY CONTENT**:
  - Drag handle at top
  - Logo (72x72) + university name
  - City • Rank row
  - Acceptance rate (if available)
  - Tuition range (if tuitionMin/Max available): "$X,XXX – $Y,XXX / year"
  - Description (if available, max 3 lines collapsed)
  - "Visit Website" `OutlinedButton` (using `url_launcher` which is already in pubspec)
- **IMPORTS**:
  ```dart
  import 'package:flutter/material.dart';
  import 'package:url_launcher/url_launcher.dart';
  import '../../../../design_system/theme/app_colors.dart';
  import '../../domain/university.dart';
  ```
- **GOTCHA**: Wrap with `DraggableScrollableSheet` if content may overflow. Otherwise use `SingleChildScrollView` with `padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom + 24)`.
- **VALIDATE**: Sheet opens without overflow, "Visit Website" button opens browser

### Task 9: Create University Map View Widget
- **ACTION**: Create `lib/features/map/presentation/widgets/university_map_view.dart`
- **IMPLEMENT**: `StatefulWidget` wrapping `KakaoMap`
- **IMPORTS**:
  ```dart
  import 'package:flutter/material.dart';
  import 'package:kakao_maps_flutter/kakao_maps_flutter.dart';
  import '../../domain/university.dart';
  import 'university_detail_sheet.dart';
  ```
- **KEY STRUCTURE**:
  ```dart
  class UniversityMapView extends StatefulWidget {
    final List<University> universities;
    const UniversityMapView({super.key, required this.universities});
    @override
    State<UniversityMapView> createState() => _UniversityMapViewState();
  }

  class _UniversityMapViewState extends State<UniversityMapView> {
    KakaoMapController? _mapController;
    // Map university id → University for quick lookup on marker tap
    late final Map<String, University> _uniById;

    @override
    void initState() {
      super.initState();
      _uniById = {for (final u in widget.universities) u.id: u};
    }

    Future<void> _onMapCreated(KakaoMapController controller) async {
      _mapController = controller;
      await _addMarkers();
    }

    Future<void> _addMarkers() async {
      if (_mapController == null) return;
      for (final u in widget.universities) {
        if (u.latitude == null || u.longitude == null) continue;
        await _mapController!.addMarker(
          markerOption: MarkerOption(
            id: u.id,
            latLng: LatLng(latitude: u.latitude!, longitude: u.longitude!),
          ),
        );
      }
      // Listen for marker taps via label click stream
      _mapController!.onLabelClickedStream.listen((event) {
        final u = _uniById[event.labelId];
        if (u != null && mounted) {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: AppColors.darkSlate,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            builder: (_) => UniversityDetailSheet(university: u),
          );
        }
      });
    }

    @override
    Widget build(BuildContext context) {
      return KakaoMap(
        onMapCreated: _onMapCreated,
        initialPosition: const LatLng(latitude: 36.5, longitude: 127.8),
        initialLevel: 8, // zoom level — 8 shows all of South Korea
      );
    }
  }
  ```
- **GOTCHA**: `KakaoMap` uses WebView under the hood (as per its dependencies). `initialLevel` in Kakao SDK goes from 1 (closest) to 14 (furthest) — level 8 shows all of South Korea at once. Test and adjust.
- **GOTCHA**: `onLabelClickedStream` is the marker tap event, NOT a separate `onMarkerTap` callback.
- **VALIDATE**: Map renders showing Korea; tapping a pin shows the bottom sheet

### Task 10: Rewrite MapTab
- **ACTION**: Fully replace `lib/features/map/presentation/map_tab.dart`
- **IMPLEMENT**:
  ```dart
  import 'package:flutter/material.dart';
  import 'package:flutter_riverpod/flutter_riverpod.dart';
  import '../../../design_system/theme/app_colors.dart';
  import '../data/map_repository.dart';
  import '../domain/university.dart';
  import 'widgets/university_card.dart';
  import 'widgets/university_detail_sheet.dart';
  import 'widgets/university_map_view.dart';

  class MapTab extends ConsumerStatefulWidget {
    const MapTab({super.key});
    @override
    ConsumerState<MapTab> createState() => _MapTabState();
  }

  class _MapTabState extends ConsumerState<MapTab> {
    final TextEditingController _searchController = TextEditingController();
    bool _isMapMode = false;
    String _activeFilter = 'all'; // 'all' | 'partner' | 'top100'
    String _searchQuery = '';

    @override
    void initState() {
      super.initState();
      _searchController.addListener(() {
        setState(() => _searchQuery = _searchController.text.toLowerCase());
      });
    }

    @override
    void dispose() {
      _searchController.dispose();
      super.dispose();
    }

    List<University> _applyFilters(List<University> all) {
      var filtered = all;
      // text search
      if (_searchQuery.isNotEmpty) {
        filtered = filtered.where((u) =>
          u.name.toLowerCase().contains(_searchQuery) ||
          u.location.toLowerCase().contains(_searchQuery),
        ).toList();
      }
      // chip filter
      switch (_activeFilter) {
        case 'partner':
          filtered = filtered.where((u) => u.isPartner).toList();
        case 'top100':
          filtered = filtered.where((u) => u.ranking != null && u.ranking! <= 100).toList();
      }
      return filtered;
    }

    void _showDetail(BuildContext ctx, University u) {
      showModalBottomSheet(
        context: ctx,
        isScrollControlled: true,
        backgroundColor: AppColors.darkSlate,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (_) => UniversityDetailSheet(university: u),
      );
    }

    @override
    Widget build(BuildContext context) {
      final uniAsync = ref.watch(universitiesProvider);
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: Column(
            children: [
              // ── Header ──────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Search universities...',
                          hintStyle: const TextStyle(color: Colors.white38),
                          prefixIcon: const Icon(Icons.search, color: Colors.white38),
                          filled: true,
                          fillColor: AppColors.surfaceGlass.withOpacity(0.12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(28),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () => setState(() => _isMapMode = !_isMapMode),
                      icon: Icon(
                        _isMapMode ? Icons.list : Icons.map_outlined,
                        color: AppColors.vibrantLime,
                      ),
                      tooltip: _isMapMode ? 'List View' : 'Map View',
                    ),
                  ],
                ),
              ),
              // ── Filter Chips ─────────────────────────────
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: ['all', 'partner', 'top100'].map((filter) {
                    final label = filter == 'all' ? 'All' : filter == 'partner' ? 'Partner' : 'Top 100';
                    final selected = _activeFilter == filter;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(label),
                        selected: selected,
                        onSelected: (_) => setState(() => _activeFilter = filter),
                        selectedColor: AppColors.vibrantLime.withOpacity(0.2),
                        backgroundColor: AppColors.surfaceGlass.withOpacity(0.1),
                        labelStyle: TextStyle(
                          color: selected ? AppColors.vibrantLime : Colors.white60,
                          fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                        ),
                        checkmarkColor: AppColors.vibrantLime,
                        side: BorderSide(
                          color: selected ? AppColors.vibrantLime.withOpacity(0.5) : AppColors.borderGlass,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              // ── Content ──────────────────────────────────
              Expanded(
                child: uniAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator.adaptive()),
                  error: (e, _) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, color: Colors.white38, size: 48),
                        const SizedBox(height: 16),
                        Text('Failed to load universities', style: const TextStyle(color: Colors.white54)),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: () => ref.refresh(universitiesProvider),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                  data: (unis) {
                    final filtered = _applyFilters(unis);
                    return AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: _isMapMode
                          ? UniversityMapView(key: const ValueKey('map'), universities: filtered)
                          : _buildList(filtered),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    }

    Widget _buildList(List<University> unis) {
      if (unis.isEmpty) {
        return Center(
          key: const ValueKey('empty'),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.school_outlined, color: Colors.white24, size: 64),
              const SizedBox(height: 16),
              const Text('No universities found', style: TextStyle(color: Colors.white38)),
            ],
          ),
        );
      }
      return ListView.builder(
        key: const ValueKey('list'),
        padding: const EdgeInsets.only(bottom: 60),
        itemCount: unis.length,
        itemBuilder: (ctx, i) => UniversityCard(
          university: unis[i],
          onTap: () => _showDetail(ctx, unis[i]),
        ),
      );
    }
  }
  ```
- **MIRROR**: `CONSUMER_STATEFUL_PATTERN`, `CARD_PATTERN`, `ERROR_STATE_PATTERN`, `LOGO_WITH_FALLBACK_PATTERN`
- **GOTCHA**: `AnimatedSwitcher` requires each child to have a unique `Key` (`ValueKey('map')`, `ValueKey('list')`) — otherwise Flutter won't animate between them
- **GOTCHA**: `ref.refresh(universitiesProvider)` triggers a re-fetch (retry)
- **VALIDATE**: List shows, search filters, chips filter, toggle animates, map shows pins

---

## Testing Strategy

### Manual Validation Checklist
- [ ] App launches without crash (KakaoMapsFlutter.init succeeds)
- [ ] Map tab loads instantly — no WebView spinner
- [ ] 212 universities appear in list (confirm count visually or via console log)
- [ ] Search "Seoul" returns only universities in Seoul
- [ ] "Top 100" chip shows ≤100 results (ranked universities only)
- [ ] "Partner" chip shows 0 results with a friendly empty state (no crash)
- [ ] List → Map toggle animates smoothly
- [ ] Map renders over South Korea with multiple pins visible
- [ ] Tapping a map pin shows the bottom sheet with university info
- [ ] Tapping a list card shows the same bottom sheet
- [ ] "Visit Website" button in bottom sheet opens browser (url_launcher)
- [ ] Back button / swipe-down dismisses bottom sheet
- [ ] Offline / error → retry button re-fetches

### Edge Cases Checklist
- [ ] University with null `ranking` — shows no rank badge (no crash)
- [ ] University with null `logoUrl` — shows school icon fallback (no crash)
- [ ] University with null `latitude`/`longitude` — skipped in map view (no crash)
- [ ] University with null `tuitionMin`/`tuitionMax` — tuition section hidden in sheet
- [ ] Search returns 0 results — empty state shown (not blank screen)
- [ ] `is_partner = false` for all unis — Partner chip shows empty state gracefully

---

## Validation Commands

### Static Analysis
```
flutter analyze lib/features/map/
```
EXPECT: Zero errors, zero warnings

### Build Check
```
flutter build apk --debug --no-pub
```
EXPECT: Builds successfully, no Kotlin/Java compile errors

### Full App Run
```
flutter run --debug
```
EXPECT: App launches, Map tab works as designed

---

## Acceptance Criteria
- [ ] WebView removed from map_tab.dart
- [ ] `universitiesProvider` returns 212 universities when online
- [ ] List view with search + filter works
- [ ] Map view shows native Kakao Map with pins
- [ ] University detail bottom sheet works from both list and map
- [ ] Uses `AppColors`, `HangukCard` — no off-brand colors
- [ ] `flutter analyze` passes clean
- [ ] App compiles and runs on physical Android device

## Completion Checklist
- [ ] `isAdmitted` field removed from University model — `applications_repository.dart` still compiles
- [ ] `KakaoMapsFlutter.init` added to `main.dart` after `WidgetsFlutterBinding.ensureInitialized()`
- [ ] Kakao maven repo added to `android/build.gradle`
- [ ] Kakao `meta-data` added to `AndroidManifest.xml`
- [ ] `TextEditingController` disposed in `_MapTabState.dispose()`
- [ ] `AnimatedSwitcher` children have unique `Key` values
- [ ] Error state has retry button (`ref.refresh(universitiesProvider)`)
- [ ] No hardcoded colors — all use `AppColors`

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Kakao SDK auth failure (package not registered) | Medium | Map shows nothing | Must register Android package + key hash in Kakao console (pre-step) |
| Kakao maven repo not found in build.gradle | Medium | Build fails | Check if project uses `settings.gradle` for repo config instead |
| `onLabelClickedStream` doesn't fire on marker tap | Low | Map taps don't work | Fall back to `onCameraMoveEndStream` + nearest-pin calculation |
| `initialLevel` too zoomed in/out | Low | Wrong zoom on Korea | Test and adjust — try 7, 8, or 9 |
| Logo URLs from Supabase return 403/404 | High | Images broken | `errorBuilder` fallback already in `LOGO_WITH_FALLBACK_PATTERN` |

## Notes
- Kakao Maps is the correct choice for Korean maps — more accurate than Google Maps for Korean addresses/POIs
- The `kakao_maps_flutter` package itself uses WebView internally for rendering (Kakao's native SDK wraps WebView) but exposes a clean native Dart API — far better than our current raw WebView approach with an external URL
- `is_partner` is currently `false` for all 212 universities — the Partner chip filter will always show 0 results gracefully
- `city_en` is in English (e.g., "Seoul", "Busan") — safe to display to Uzbek students learning Korean in English mode
