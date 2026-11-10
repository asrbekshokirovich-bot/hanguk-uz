import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/my_shift.dart';
import '../../../data/repositories/shift_repository.dart';

/// The worker's applications (A06).
final myShiftsProvider = FutureProvider.autoDispose<List<MyShift>>(
  (ref) => ref.watch(shiftRepositoryProvider).myShifts(),
  retry: (count, error) => null,
);

/// One application (A07, A08).
final myShiftProvider = FutureProvider.autoDispose.family<MyShift?, String>(
  (ref, id) => ref.watch(shiftRepositoryProvider).myShift(id),
  retry: (count, error) => null,
);
