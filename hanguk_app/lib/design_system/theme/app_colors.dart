import 'package:flutter/material.dart';

class AppColors {
  // Hanguk Official Palette from Web HSL
  // Primary (Light): #1a3a6c (Deep Royal Blue)
  static const Color royalBlue = Color(0xFF1A3A6C);

  // Accent/Primary (Dark): #d4e94c (Vibrant Lime)
  static const Color vibrantLime = Color(0xFFD4E94C);

  // Backgrounds
  static const Color pureBlack = Color(0xFF000000);
  static const Color softWhite = Color(0xFFF8FAFC);

  // Semantic Colors
  static const Color error = Color(0xFFDC2626); // web destructive
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);

  // Neutral
  static const Color darkSlate = Color(0xFF0F172A);
  static const Color lightSlate = Color(0xFFF1F5F9);

  // Glassmorphism & UI Accents
  static const Color surfaceGlass = Color(0x33FFFFFF); // 20% white
  static const Color borderGlass = Color(0x1AFFFFFF); // 10% white
  static const Color backgroundNavy = Color(0xFF0A0A1A);

  // Gradients
  static const List<Color> mainGradient = [
    royalBlue,
    Color(0xFF132A4D),
    Color(0xFF0F213D),
    backgroundNavy,
  ];
}
