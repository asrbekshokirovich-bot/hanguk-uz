import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The current instant. A provider so screens that say "Bugun", "2 soat
/// 40 daq qoldi" or "18:20 기준" can be rendered and tested at a fixed time.
final clockProvider = Provider<DateTime Function()>((ref) => DateTime.now);
