import 'package:flutter/widgets.dart';

import 'svg_path_icon.dart';

/// The geometry of one lucide icon (lucide 0.462.0, the version the full
/// design draws with), as the paths and circles [SvgPathIcon] strokes. Rects,
/// lines and polylines are written as paths. Generated from the lucide-react
/// icon nodes; add an icon by generating its entry the same way rather than
/// drawing it by hand.
@immutable
class LucideGlyph {
  const LucideGlyph({required this.paths, this.circles = const []});

  final List<String> paths;
  final List<(double, double, double)> circles;
}

/// A lucide icon on the 24×24 grid with the design's 2px stroke.
class Lucide extends StatelessWidget {
  const Lucide(this.glyph, {super.key, required this.size, required this.color, this.strokeWidth = 2});

  final LucideGlyph glyph;
  final double size;
  final Color color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => SvgPathIcon(
    paths: glyph.paths,
    circles: glyph.circles,
    size: size,
    color: color,
    strokeWidth: strokeWidth,
  );
}

/// The icons the full design uses.
abstract final class LucideIcons {
  /// lucide `laptop`
  static const laptop = LucideGlyph(
    paths: ['M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16'],
  );

  /// lucide `briefcase`
  static const briefcase = LucideGlyph(
    paths: ['M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16', 'M4 6H20A2 2 0 0 1 22 8V18A2 2 0 0 1 20 20H4A2 2 0 0 1 2 18V8A2 2 0 0 1 4 6Z'],
  );

  /// lucide `wrench`
  static const wrench = LucideGlyph(
    paths: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  );

  /// lucide `stethoscope`
  static const stethoscope = LucideGlyph(
    paths: ['M11 2v2', 'M5 2v2', 'M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1', 'M8 15a6 6 0 0 0 12 0v-3'],
    circles: [(20, 10, 2)],
  );

  /// lucide `palette`
  static const palette = LucideGlyph(
    paths: ['M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z'],
    circles: [(13.5, 6.5, .5), (17.5, 10.5, .5), (8.5, 7.5, .5), (6.5, 12.5, .5)],
  );

  /// lucide `plane`
  static const plane = LucideGlyph(
    paths: ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'],
  );

  /// lucide `book-open`
  static const bookOpen = LucideGlyph(
    paths: ['M12 7v14', 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  );

  /// lucide `layers`
  static const layers = LucideGlyph(
    paths: ['m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z', 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65', 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'],
  );

  /// lucide `graduation-cap`
  static const graduationCap = LucideGlyph(
    paths: ['M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z', 'M22 10v6', 'M6 12.5V16a6 3 0 0 0 12 0v-3.5'],
  );

  /// lucide `map`
  static const map = LucideGlyph(
    paths: ['M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z', 'M15 5.764v15', 'M9 3.236v15'],
  );

  /// lucide `target`
  static const target = LucideGlyph(
    paths: [],
    circles: [(12, 12, 10), (12, 12, 6), (12, 12, 2)],
  );

  /// lucide `x`
  static const x = LucideGlyph(
    paths: ['M18 6 6 18', 'm6 6 12 12'],
  );

  /// lucide `heart`
  static const heart = LucideGlyph(
    paths: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  );

  /// lucide `search`
  static const search = LucideGlyph(
    paths: ['m21 21-4.3-4.3'],
    circles: [(11, 11, 8)],
  );

  /// lucide `sliders-horizontal`
  static const slidersHorizontal = LucideGlyph(
    paths: ['M21 4L14 4', 'M10 4L3 4', 'M21 12L12 12', 'M8 12L3 12', 'M21 20L16 20', 'M12 20L3 20', 'M14 2L14 6', 'M8 10L8 14', 'M16 18L16 22'],
  );

  /// lucide `map-pin`
  static const mapPin = LucideGlyph(
    paths: ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'],
    circles: [(12, 10, 3)],
  );

  /// lucide `chevron-left`
  static const chevronLeft = LucideGlyph(
    paths: ['m15 18-6-6 6-6'],
  );

  /// lucide `chevron-right`
  static const chevronRight = LucideGlyph(
    paths: ['m9 18 6-6-6-6'],
  );

  /// lucide `chevron-up`
  static const chevronUp = LucideGlyph(
    paths: ['m18 15-6-6-6 6'],
  );

  /// lucide `chevron-down`
  static const chevronDown = LucideGlyph(
    paths: ['m6 9 6 6 6-6'],
  );

  /// lucide `share-2`
  static const share2 = LucideGlyph(
    paths: ['M8.59 13.51L15.42 17.49', 'M15.41 6.51L8.59 10.49'],
    circles: [(18, 5, 3), (6, 12, 3), (18, 19, 3)],
  );

  /// lucide `banknote`
  static const banknote = LucideGlyph(
    paths: ['M4 6H20A2 2 0 0 1 22 8V16A2 2 0 0 1 20 18H4A2 2 0 0 1 2 16V8A2 2 0 0 1 4 6Z', 'M6 12h.01M18 12h.01'],
    circles: [(12, 12, 2)],
  );

  /// lucide `receipt`
  static const receipt = LucideGlyph(
    paths: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 17.5v-11'],
  );

  /// lucide `languages`
  static const languages = LucideGlyph(
    paths: ['m5 8 6 6', 'm4 14 6-6 2-3', 'M2 5h12', 'M7 2h1', 'm22 22-5-10-5 10', 'M14 18h6'],
  );

  /// lucide `calendar`
  static const calendar = LucideGlyph(
    paths: ['M8 2v4', 'M16 2v4', 'M5 4H19A2 2 0 0 1 21 6V20A2 2 0 0 1 19 22H5A2 2 0 0 1 3 20V6A2 2 0 0 1 5 4Z', 'M3 10h18'],
  );

  /// lucide `bed-double`
  static const bedDouble = LucideGlyph(
    paths: ['M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8', 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4', 'M12 4v6', 'M2 18h20'],
  );

  /// lucide `award`
  static const award = LucideGlyph(
    paths: ['m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526'],
    circles: [(12, 8, 6)],
  );

  /// lucide `send`
  static const send = LucideGlyph(
    paths: ['M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z', 'm21.854 2.147-10.94 10.939'],
  );

  /// lucide `phone`
  static const phone = LucideGlyph(
    paths: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  );

  /// lucide `file-text`
  static const fileText = LucideGlyph(
    paths: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M10 9H8', 'M16 13H8', 'M16 17H8'],
  );

  /// lucide `clock`
  static const clock = LucideGlyph(
    paths: ['M12 6L12 12L16 14'],
    circles: [(12, 12, 10)],
  );

  /// lucide `arrow-right`
  static const arrowRight = LucideGlyph(
    paths: ['M5 12h14', 'm12 5 7 7-7 7'],
  );

  /// lucide `check`
  static const check = LucideGlyph(
    paths: ['M20 6 9 17l-5-5'],
  );

  /// lucide `route`
  static const route = LucideGlyph(
    paths: ['M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15'],
    circles: [(6, 19, 3), (18, 5, 3)],
  );

  /// lucide `folder-open`
  static const folderOpen = LucideGlyph(
    paths: ['m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2'],
  );

  /// lucide `mic`
  static const mic = LucideGlyph(
    paths: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19L12 22'],
  );

  /// lucide `bot`
  static const bot = LucideGlyph(
    paths: ['M12 8V4H8', 'M6 8H18A2 2 0 0 1 20 10V18A2 2 0 0 1 18 20H6A2 2 0 0 1 4 18V10A2 2 0 0 1 6 8Z', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'],
  );

  /// lucide `rotate-ccw`
  static const rotateCcw = LucideGlyph(
    paths: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
  );

  /// lucide `plus`
  static const plus = LucideGlyph(
    paths: ['M5 12h14', 'M12 5v14'],
  );

  /// lucide `minus`
  static const minus = LucideGlyph(
    paths: ['M5 12h14'],
  );

  /// lucide `share`
  static const share = LucideGlyph(
    paths: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6L12 2L8 6', 'M12 2L12 15'],
  );

  /// lucide `grip-vertical`
  static const gripVertical = LucideGlyph(
    paths: [],
    circles: [(9, 12, 1), (9, 5, 1), (9, 19, 1), (15, 12, 1), (15, 5, 1), (15, 19, 1)],
  );

  /// lucide `trophy`
  static const trophy = LucideGlyph(
    paths: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  );

  /// lucide `arrow-left-right`
  static const arrowLeftRight = LucideGlyph(
    paths: ['M8 3 4 7l4 4', 'M4 7h16', 'm16 21 4-4-4-4', 'M20 17H4'],
  );

  /// lucide `arrow-down`
  static const arrowDown = LucideGlyph(
    paths: ['M12 5v14', 'm19 12-7 7-7-7'],
  );
}
