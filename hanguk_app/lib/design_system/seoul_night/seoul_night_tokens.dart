import 'package:flutter/material.dart';

/// Seoul Night — design tokens.
///
/// The binding source is `DESIGN_SPEC.md` §1 Foundations. Everything visual in
/// the redesign resolves to a token here: no widget should hardcode a colour,
/// radius, shadow or duration.
///
/// Note this sits alongside the legacy `AppColors` / `AppTheme` rather than
/// replacing them — feature screens migrate one phase at a time, so both must
/// keep working until the sweep phase removes the old styles.
class SeoulColors {
  const SeoulColors._();

  // ── Brand ────────────────────────────────────────────────────────────────
  /// Brand blue. Base of the app background and hero gradients.
  static const Color royalBlue = Color(0xFF1A3A6C);

  /// THE action colour: primary buttons, active nav, selection, glows.
  /// Used sparingly — one primary action per screen (spec §4).
  static const Color lime = Color(0xFFD4E94C);

  /// Top stop of the lime button gradient.
  static const Color limeBright = Color(0xFFE2F26A);

  /// Bottom stop of the lime button gradient (and the pressed fill).
  static const Color limePressed = Color(0xFFC7E04A);

  /// Text/icon colour on top of lime. Never white on lime.
  static const Color ink = Color(0xFF0A1A34);

  // ── Surfaces ─────────────────────────────────────────────────────────────
  /// Glass card fill.
  static const Color glass = Color(0x12FFFFFF); // rgba(255,255,255,0.07)

  /// Glass card hairline border.
  static const Color glassBorder = Color(0x1FFFFFFF); // rgba(255,255,255,0.12)

  /// Inset highlight along the top edge of a hero card.
  static const Color heroHighlight = Color(0x33FFFFFF); // 0.20

  /// Border of a hero card.
  static const Color heroBorder = Color(0x29FFFFFF); // 0.16

  /// Full-screen scrim behind the orb speed-dial.
  static const Color scrim = Color(0x99040812); // rgba(4,8,18,0.6)

  // ── Text ─────────────────────────────────────────────────────────────────
  static const Color textPrimary = Colors.white;
  static const Color textSecondary = Color(0x8CFFFFFF); // 0.55
  static const Color textFaint = Color(0x66FFFFFF); // 0.40

  // ── Semantic (status chips) ──────────────────────────────────────────────
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningText = Color(0xFFFFC966);
  static const Color warningFill = Color(0x29F59E0B); // 0.16

  static const Color info = Color(0xFF7CA3D9);
  static const Color infoText = Color(0xFF9FC0EA);
  static const Color infoFill = Color(0x2E7CA3D9); // 0.18

  static const Color limeFill = Color(0x24D4E94C); // lime chip fill
  static const Color neutralFill = Color(0x14FFFFFF);

  // ── Semantic (destructive / failure) ─────────────────────────────────────
  // Not in the spec's palette, which stops at warning/info — but the app has
  // genuinely destructive actions (delete account, delete a document) and
  // genuine failures (a rejected application, a login error). Amber would
  // read as "heads up" when the meaning is "this cannot be undone" or "this
  // did not work". Desaturated relative to the legacy `AppColors.error` so it
  // sits on navy without vibrating.
  static const Color danger = Color(0xFFEF6B6B);
  static const Color dangerText = Color(0xFFFF9B9B);
  static const Color dangerFill = Color(0x29EF6B6B); // 0.16

  // Confirmation that is *not* progress. Progress is lime (spec §4) — this is
  // for one-off "that worked" moments, e.g. the magic-code success banner.
  static const Color success = Color(0xFF34D399);
  static const Color successText = Color(0xFF7BE8C4);
  static const Color successFill = Color(0x2934D399);

  // ── Map (spec §3.5) ──────────────────────────────────────────────────────
  static const Color mapWater = Color(0xFF0C1830);
  static const Color mapLand = Color(0xFF16305A);
}

/// Corner radii. Spec §1: 14/16/18/22/24.
class SeoulRadii {
  const SeoulRadii._();

  static const double button = 14;
  static const double control = 16;
  static const double tile = 18;
  static const double card = 22;
  static const double hero = 24;

  /// Fully rounded — status chips, filter chips, the guest conversion pill.
  /// Not a real radius so much as "capsule"; kept as a token so the bare
  /// `999` stops being repeated across feature code.
  static const double pill = 999;

  static const BorderRadius buttonR = BorderRadius.all(Radius.circular(button));
  static const BorderRadius controlR = BorderRadius.all(
    Radius.circular(control),
  );
  static const BorderRadius tileR = BorderRadius.all(Radius.circular(tile));
  static const BorderRadius cardR = BorderRadius.all(Radius.circular(card));
  static const BorderRadius heroR = BorderRadius.all(Radius.circular(hero));
}

/// Elevation. Depth comes from glow + layered glass, never flat black panels.
class SeoulShadows {
  const SeoulShadows._();

  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x4D000000), // 0.30
      blurRadius: 28,
      offset: Offset(0, 12),
    ),
  ];

  static const List<BoxShadow> hero = [
    BoxShadow(
      color: Color(0x73000000), // 0.45
      blurRadius: 48,
      offset: Offset(0, 24),
    ),
  ];

  /// The lime "lift" under a primary button.
  static const List<BoxShadow> limeGlow = [
    BoxShadow(
      color: Color(0x47D4E94C), // 0.28
      blurRadius: 32,
      offset: Offset(0, 14),
    ),
  ];

  /// Tighter lime glow for small elements (pins, dots, active tiles).
  static const List<BoxShadow> limeGlowSmall = [
    BoxShadow(color: Color(0x59D4E94C), blurRadius: 16),
  ];
}

/// Gradients. Angles from the spec are CSS degrees; the Alignment pairs below
/// are their Flutter equivalents.
class SeoulGradients {
  const SeoulGradients._();

  /// Every screen's background — 150deg, four stops, bottoms out near black
  /// so OLED panels stay dark (spec §4).
  static const LinearGradient appBackground = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF1A3A6C),
      Color(0xFF132A4D),
      Color(0xFF0F213D),
      Color(0xFF0A0A1A),
    ],
    stops: [0.0, 0.38, 0.66, 1.0],
  );

  /// Hero card fill — 140deg.
  static const LinearGradient heroCard = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2A4E8C), Color(0xFF1A3A6C), Color(0xFF142E56)],
    stops: [0.0, 0.57, 1.0],
  );

  /// Primary button fill — 145deg.
  static const LinearGradient limeButton = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [SeoulColors.limeBright, SeoulColors.limePressed],
  );

  /// Ambient glow blob, top-left of the background.
  static const RadialGradient glowBlue = RadialGradient(
    colors: [Color(0x80406EBE), Color(0x00406EBE)],
    stops: [0.0, 0.7],
  );

  /// Ambient glow blob, bottom-right of the background.
  static const RadialGradient glowLime = RadialGradient(
    colors: [Color(0x24D4E94C), Color(0x00D4E94C)],
    stops: [0.0, 0.7],
  );
}

/// Motion. Spec §1: 0.3s everywhere; springy only for nav/dial.
class SeoulMotion {
  const SeoulMotion._();

  static const Duration fast = Duration(milliseconds: 180);
  static const Duration base = Duration(milliseconds: 300);

  /// Per-item delay when the speed-dial fans out.
  static const Duration stagger = Duration(milliseconds: 40);

  /// One full breath of the orb's pulse ring.
  static const Duration pulse = Duration(milliseconds: 2600);

  /// Springy — nav and the orb dial only.
  static const Cubic springy = Cubic(0.2, 0.9, 0.3, 1.2);

  /// Everything else: fades, colour changes, progress.
  static const Curve smooth = Curves.easeOut;

  /// Press feedback on buttons and tappable cards.
  static const double pressScale = 0.97;
}

/// Layout constants that recur across the redesign.
class SeoulSizes {
  const SeoulSizes._();

  /// Minimum interactive size (spec §4).
  static const double minTapTarget = 44;

  /// Primary button height.
  static const double buttonHeight = 52;

  /// The 한 orb.
  static const double orbSize = 62;
  static const double orbRight = 22;
  static const double orbBottom = 34;

  /// Bottom padding every scrollable section must reserve so its last row
  /// stays clear of the orb.
  ///
  /// The orb's tap box is centred on the circle and 24px larger, so it reaches
  /// `orbBottom + orbSize + 12` from the bottom edge; the rest is air. Use
  /// this everywhere — a list that ends short of it puts its final action
  /// underneath the orb, where the dial swallows the tap.
  static const double orbClearance = orbBottom + orbSize + 32;

  /// Speed-dial hangul tile.
  static const double dialTile = 52;

  /// Glass tile holding a hangul glyph in a list row.
  static const double glyphTile = 48;

  static const double screenPadding = 20;
}
