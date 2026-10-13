import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../entry/data/entry_store.dart';

/// Shared pieces of the sign-in screens (Welcome, Magic Code, Splash) from the
/// "Sign-in 2a Polished" design: the navy backdrop, the logo tile, and helpers
/// that reproduce the design's CSS effects exactly.

/// Flutter blur radius that renders like a CSS box-shadow blur of [cssRadius].
///
/// CSS blurs with sigma = radius / 2; Flutter converts `blurRadius` with
/// sigma = radius * 0.57735 + 0.5, so the same number looks softer in Flutter.
double cssBlur(double cssRadius) =>
    math.max(0, (cssRadius / 2 - 0.5) / 0.57735);

/// A CSS `linear-gradient(<angle>deg, ...)` for a box of [size].
///
/// CSS measures the angle clockwise from "to top" and sizes the gradient line
/// so the corners land exactly on the first and last stops; `Alignment` works
/// in half-extents, so the line is converted per axis.
LinearGradient cssLinearGradient(
  double angleDeg,
  Size size, {
  required List<Color> colors,
  List<double>? stops,
}) {
  final a = angleDeg * math.pi / 180;
  final dx = math.sin(a);
  final dy = -math.cos(a);
  final w = size.width <= 0 ? 1.0 : size.width;
  final h = size.height <= 0 ? 1.0 : size.height;
  final length = (w * dx).abs() + (h * dy).abs();
  final ax = dx * length / w;
  final ay = dy * length / h;
  return LinearGradient(
    begin: Alignment(-ax, -ay),
    end: Alignment(ax, ay),
    colors: colors,
    stops: stops,
  );
}

/// Page background: the 165deg navy-to-black gradient plus the soft blue glow
/// in the top-left corner. Fills its parent; [child] is laid out on top.
class SignInBackdrop extends StatelessWidget {
  const SignInBackdrop({super.key, required this.child});

  final Widget child;

  static const List<Color> _colors = [
    Color(0xFF1A3A6C),
    Color(0xFF132A4D),
    Color(0xFF0F213D),
    Color(0xFF0A0A1A),
  ];
  static const List<double> _stops = [0, 0.40, 0.70, 1];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: cssLinearGradient(
              165,
              size,
              colors: _colors,
              stops: _stops,
            ),
          ),
          child: Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.hardEdge,
            children: [
              const Positioned(
                left: -80,
                top: -180,
                width: 520,
                height: 420,
                child: IgnorePointer(child: _TopGlow()),
              ),
              child,
            ],
          ),
        );
      },
    );
  }
}

/// `radial-gradient(ellipse at center, rgba(120,165,230,.22) 0%, transparent
/// 60%)` on a 520x420 box. CSS sizes the ellipse to the farthest corner, so
/// its radii are the half-extents times sqrt(2); Flutter's gradient is a
/// circle, so a square is painted and stretched to the ellipse.
class _TopGlow extends StatelessWidget {
  const _TopGlow();

  static const double _w = 520;
  static const double _h = 420;
  static const Color _c = Color(0x3878A5E6); // rgba(120,165,230,.22)

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Transform.scale(
        scaleX: _w / _h,
        child: const SizedBox.square(
          dimension: _h,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                radius: math.sqrt2 / 2,
                colors: [_c, Color(0x0078A5E6)],
                stops: [0, 0.60],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The brand tile: the white 한 mark on a blue gradient square with a soft
/// blue halo behind it. Welcome uses 92 / 26, Splash 108 / 30.
class SignInLogoTile extends StatelessWidget {
  const SignInLogoTile({
    super.key,
    required this.size,
    required this.radius,
    required this.haloBleed,
    required this.shadowOffsetY,
    required this.shadowBlur,
  });

  /// Tile edge, in logical pixels.
  final double size;

  final double radius;

  /// How far the halo reaches past the tile on every side (CSS `inset: -N`).
  final double haloBleed;

  /// Drop shadow `0 <shadowOffsetY>px <shadowBlur>px rgba(0,0,0,.35)`.
  final double shadowOffsetY;
  final double shadowBlur;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    final halo = size + haloBleed * 2;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // radial-gradient(circle, rgba(78,128,201,.38) 0%, transparent 65%)
            // on a square: farthest corner is half the diagonal.
            Positioned(
              left: -haloBleed,
              top: -haloBleed,
              width: halo,
              height: halo,
              child: const IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      radius: math.sqrt2 / 2,
                      colors: [Color(0x614E80C9), Color(0x004E80C9)],
                      stops: [0, 0.65],
                    ),
                  ),
                ),
              ),
            ),
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                borderRadius: r,
                gradient: cssLinearGradient(
                  160,
                  Size.square(size),
                  colors: const [Color(0xFF2E5FA8), Color(0xFF1A3A6C)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0x59000000), // .35
                    offset: Offset(0, shadowOffsetY),
                    blurRadius: cssBlur(shadowBlur),
                  ),
                ],
              ),
              foregroundDecoration: InsetEdgesDecoration(
                radius: radius,
                top: const Color(
                  0x47FFFFFF,
                ), // inset 0 1px 0 rgba(255,255,255,.28)
                bottom: const Color(
                  0x40000000,
                ), // inset 0 -1px 0 rgba(0,0,0,.25)
              ),
              alignment: Alignment.center,
              child: Image.asset(
                'assets/images/logo_mark_white.png',
                width: size * 0.64,
                filterQuality: FilterQuality.medium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// CSS `inset 0 1px 0 <top>` and `inset 0 -1px 0 <bottom>` box-shadows: a
/// one-pixel band that follows the rounded edge along the top and/or bottom.
///
/// [inset] is the border width — CSS paints inset shadows inside the border.
class InsetEdgesDecoration extends Decoration {
  const InsetEdgesDecoration({
    required this.radius,
    this.top,
    this.bottom,
    this.inset = 0,
  });

  final double radius;
  final Color? top;
  final Color? bottom;
  final double inset;

  @override
  BoxPainter createBoxPainter([VoidCallback? onChanged]) =>
      _InsetEdgesPainter(this);
}

class _InsetEdgesPainter extends BoxPainter {
  _InsetEdgesPainter(this.d);

  final InsetEdgesDecoration d;

  @override
  void paint(Canvas canvas, Offset offset, ImageConfiguration configuration) {
    final size = configuration.size;
    if (size == null) return;
    final rect = (offset & size).deflate(d.inset);
    final rr = RRect.fromRectAndRadius(
      rect,
      Radius.circular(math.max(0, d.radius - d.inset)),
    );
    final base = Path()..addRRect(rr);
    void band(Color? color, double dy) {
      if (color == null) return;
      final shifted = Path()..addRRect(rr.shift(Offset(0, dy)));
      canvas.drawPath(
        Path.combine(PathOperation.difference, base, shifted),
        Paint()..color = color,
      );
    }

    band(d.top, 1);
    band(d.bottom, -1);
  }
}

/// The Lucide icons the sign-in design uses, drawn from their SVG paths so
/// they match the design stroke for stroke (24x24 viewBox, round caps/joins).
enum SignInIcon {
  graduationCap([
    'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z',
    'M22 10v6',
    'M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  ]),
  arrowRight(['M5 12h14', 'm12 5 7 7-7 7']),
  key([
    'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
  ], dot: Offset(16.5, 7.5)),
  chevronLeft(['m15 18-6-6 6-6']);

  const SignInIcon(this.paths, {this.dot});

  final List<String> paths;

  /// Lucide draws the key's hole as a filled r=.5 circle.
  final Offset? dot;
}

class SignInIconView extends StatelessWidget {
  const SignInIconView(
    this.icon, {
    super.key,
    required this.size,
    required this.color,
    this.strokeWidth = 2,
  });

  final SignInIcon icon;
  final double size;
  final Color color;

  /// In viewBox units, like the SVG `stroke-width`.
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.square(size),
        painter: _SignInIconPainter(icon, color, strokeWidth),
      ),
    );
  }
}

class _SignInIconPainter extends CustomPainter {
  _SignInIconPainter(this.icon, this.color, this.strokeWidth);

  final SignInIcon icon;
  final Color color;
  final double strokeWidth;

  static final Map<SignInIcon, List<Path>> _cache = {};

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    canvas.save();
    canvas.scale(s);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    for (final p in _cache.putIfAbsent(
      icon,
      () => icon.paths.map(parseSvgPath).toList(),
    )) {
      canvas.drawPath(p, stroke);
    }
    final dot = icon.dot;
    if (dot != null) {
      canvas.drawCircle(dot, 0.5, Paint()..color = color);
      canvas.drawCircle(dot, 0.5, stroke);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SignInIconPainter old) =>
      old.icon != icon || old.color != color || old.strokeWidth != strokeWidth;
}

/// Minimal SVG path-data parser: M L H V A Z, absolute and relative — the
/// commands the Lucide icons above use.
@visibleForTesting
Path parseSvgPath(String d) {
  final tokens = RegExp(
    r'[MmLlHhVvAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?',
  ).allMatches(d).map((m) => m.group(0)!).toList();
  final path = Path();
  var i = 0;
  var cmd = '';
  var x = 0.0, y = 0.0, sx = 0.0, sy = 0.0;
  bool isCmd(String t) => RegExp(r'^[A-Za-z]$').hasMatch(t);
  double n() => double.parse(tokens[i++]);
  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    final rel = cmd == cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
        final nx = n(), ny = n();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        path.moveTo(x, y);
        sx = x;
        sy = y;
        cmd = rel ? 'l' : 'L'; // implicit lineto after the first pair
      case 'L':
        final nx = n(), ny = n();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        path.lineTo(x, y);
      case 'H':
        final nx = n();
        x = rel ? x + nx : nx;
        path.lineTo(x, y);
      case 'V':
        final ny = n();
        y = rel ? y + ny : ny;
        path.lineTo(x, y);
      case 'A':
        final rx = n(), ry = n(), rot = n(), large = n(), sweep = n();
        final nx = n(), ny = n();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        path.arcToPoint(
          Offset(x, y),
          radius: Radius.elliptical(rx, ry),
          rotation: rot,
          largeArc: large != 0,
          clockwise: sweep != 0,
        );
      case 'Z':
        path.close();
        x = sx;
        y = sy;
      default:
        i++;
    }
  }
  return path;
}

/// Splash content (design screen 01): the lime corner, the logo tile, the
/// "Hanguk / CONSULTING" wordmark, and the tagline with the dot indicator at
/// the bottom. Shown by the Flutter splash while Supabase starts.
///
/// It paints before localization is available, so the tagline comes from
/// [_taglines] in the language chosen on an earlier launch
/// ([EntryStore.initial]), English until one is chosen.
class SplashContent extends StatelessWidget {
  const SplashContent({super.key});

  static const Map<String, String> _taglines = {
    'uz': 'Janubiy Koreya universitetlariga yo‘l',
    'en': 'Your path to South Korean universities',
    'ko': '한국 대학으로 가는 길',
    'ru': 'Путь в университеты Южной Кореи',
  };

  @override
  Widget build(BuildContext context) {
    final tagline =
        _taglines[EntryStore.initial.languageCode] ?? _taglines['en']!;
    return Stack(
      fit: StackFit.expand,
      children: [
        // `border-left: 280px transparent; border-bottom: 230px lime`, set
        // 80px past the right edge and 40px below the bottom.
        const Positioned(
          right: -80,
          bottom: -40,
          width: 280,
          height: 230,
          child: CustomPaint(painter: _SplashCorner()),
        ),
        SafeArea(
          child: Column(
            children: [
              const Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SignInLogoTile(
                        size: 108,
                        radius: 30,
                        haloBleed: 60,
                        shadowOffsetY: 16,
                        shadowBlur: 32,
                      ),
                      SizedBox(height: 20),
                      Text(
                        'Hanguk',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 38,
                          height: 1,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1.14, // -.03em
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'CONSULTING',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          height: 1.21,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 2.88, // .24em
                          color: Color(0xFFD4E94C),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
                child: Column(
                  children: [
                    Text(
                      tagline,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        height: 1.21,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFC9D4E6),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const _SplashDots(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SplashCorner extends CustomPainter {
  const _SplashCorner();

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, size.height)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFD4E94C));
  }

  @override
  bool shouldRepaint(_SplashCorner old) => false;
}

class _SplashDots extends StatelessWidget {
  const _SplashDots();

  @override
  Widget build(BuildContext context) {
    Widget dot(Color color) => Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        dot(const Color(0xFFD4E94C)),
        const SizedBox(width: 6),
        dot(const Color(0x59FFFFFF)), // .35
        const SizedBox(width: 6),
        dot(const Color(0x59FFFFFF)),
      ],
    );
  }
}
