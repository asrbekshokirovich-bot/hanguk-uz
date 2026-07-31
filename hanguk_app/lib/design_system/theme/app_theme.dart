import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../seoul_night/seoul_night_typography.dart';
import 'app_colors.dart';

class AppTheme {
  // Material 3 Theme for Android
  static ThemeData get materialTheme {
    final base = ThemeData(useMaterial3: true, brightness: Brightness.dark);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.pureBlack,
      // Seoul Night typography applies app-wide from Prompt 0 so migrated and
      // not-yet-migrated screens share one typeface. Colours and layout still
      // come from the legacy theme until each screen's phase lands.
      fontFamily: SeoulType.inter,
      fontFamilyFallback: SeoulType.fallback,
      textTheme: SeoulType.textTheme(base.textTheme),
      colorScheme: const ColorScheme.dark(
        primary: AppColors.vibrantLime,
        onPrimary: AppColors.pureBlack,
        secondary: AppColors.royalBlue,
        onSecondary: Colors.white,
        surface: Color(0xFF0F172A), // darkSlate
        onSurface: Colors.white,
        error: AppColors.error,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        centerTitle: true,
        elevation: 0,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
        iconTheme: IconThemeData(color: AppColors.vibrantLime),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.vibrantLime,
          foregroundColor: AppColors.pureBlack,
          textStyle: const TextStyle(fontWeight: FontWeight.bold),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: const BorderSide(color: AppColors.borderGlass),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceGlass.withValues(alpha: 0.08),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.borderGlass),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.borderGlass),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.vibrantLime),
        ),
        hintStyle: const TextStyle(color: Colors.white70),
        prefixIconColor: Colors.white70,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.pureBlack,
        unselectedLabelColor: Colors.white54,
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        indicator: BoxDecoration(
          color: AppColors.vibrantLime,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceGlass.withValues(alpha: 0.12),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.borderGlass, width: 0.5),
        ),
      ),
    );
  }

  // Cupertino Theme for iOS
  static CupertinoThemeData get cupertinoTheme {
    return const CupertinoThemeData(
      brightness: Brightness.dark,
      primaryColor: AppColors.vibrantLime,
      scaffoldBackgroundColor: AppColors.pureBlack,
      barBackgroundColor: AppColors.pureBlack,
    );
  }
}
