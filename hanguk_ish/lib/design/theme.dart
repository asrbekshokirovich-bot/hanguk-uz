import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';
import 'typography.dart';

/// Material theme for both apps. Screens style their own text with
/// `hiStyle`; the theme only sets what Material widgets read (fonts, the
/// navy canvas, cursor and selection colours) and switches off ink ripples,
/// which the prototype does not have.
ThemeData hiTheme() {
  const scheme = ColorScheme.dark(
    primary: HiColors.lime,
    onPrimary: HiColors.onLime,
    secondary: HiColors.blue,
    onSecondary: HiColors.white,
    surface: HiColors.navy,
    onSurface: HiColors.white,
    error: HiColors.red,
    onError: HiColors.white,
  );
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: HiColors.navy,
    fontFamily: HiFonts.inter,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    splashColor: Colors.transparent,
    textSelectionTheme: const TextSelectionThemeData(
      cursorColor: HiColors.ink,
      selectionColor: Color(0x552447D6),
      selectionHandleColor: HiColors.blue,
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      fontFamily: HiFonts.inter,
      fontFamilyFallback: HiFamily.inter.fallback,
      bodyColor: HiColors.white,
      displayColor: HiColors.white,
    ),
  );
}

/// Status and navigation bars: transparent over the navy screens, light
/// icons.
abstract final class HiSystemUi {
  static const onNavy = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
    systemNavigationBarContrastEnforced: false,
  );
}
