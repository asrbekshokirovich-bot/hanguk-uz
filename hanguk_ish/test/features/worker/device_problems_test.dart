import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/profile/profile_screens.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';
import 'package:hanguk_ish/features/worker/work/qr_scanner.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// A camera that cannot start, for the reason given.
class _BrokenCamera extends StatefulWidget {
  const _BrokenCamera(this.onProblem, this.problem);

  final ValueChanged<QrCameraProblem> onProblem;
  final QrCameraProblem problem;

  @override
  State<_BrokenCamera> createState() => _BrokenCameraState();
}

class _BrokenCameraState extends State<_BrokenCamera> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.onProblem(widget.problem));
  }

  @override
  Widget build(BuildContext context) => const SizedBox.expand();
}

/// Profile saves that fail as if offline.
class _OfflineSave extends InMemoryWorkerProfileRepository {
  @override
  Future<void> save(WorkerProfileDraft draft) async => throw const OfflineException();
}

void main() {
  setUpAll(loadHiFonts);

  Future<void> scan(WidgetTester tester, QrCameraProblem problem) async {
    usePhone(tester);
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    final app = await repo.apply('demo-1');
    final container = appContainer(
      location: WorkerRoutes.checkIn(app.applicationId),
      repository: repo,
      clock: clock.call,
      overrides: [
        qrCameraKindProvider.overrideWithValue(QrCameraKind.device),
        qrCameraBuilderProvider.overrideWithValue(
          ({required onCode, required torch, required onProblem}) => _BrokenCamera(onProblem, problem),
        ),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
  }

  testWidgets('A07 without camera permission says how to allow it', (tester) async {
    await scan(tester, QrCameraProblem.denied);
    expect(find.text("Kameraga ruxsat yo'q"), findsOneWidget);
    expect(find.text('QR kodni skanerlash uchun sozlamalarda kameraga ruxsat bering.'), findsOneWidget);
    expect(find.text('Sozlamalarni ochish'), findsOneWidget);
    expect(find.text("QR kodni ramkaga to'g'rilang"), findsNothing, reason: 'nothing to align');
    expect(find.bySemanticsLabel('Yopish'), findsOneWidget, reason: 'the way out stays');
  });

  testWidgets('A07 with a camera that does not start says what to do', (tester) async {
    await scan(tester, QrCameraProblem.failed);
    expect(find.text('Kamera ishga tushmadi'), findsOneWidget);
    expect(find.text('Ekranni yopib, qaytadan oching.'), findsOneWidget);
    expect(find.text('Sozlamalarni ochish'), findsNothing);
  });

  Future<ProviderContainer> profile(WidgetTester tester, List<Override> overrides) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.profileName, overrides: overrides);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('A02: a photo that cannot be taken is explained; the profile goes on', (tester) async {
    final container = await profile(tester, [
      photoPickerProvider.overrideWithValue((source) async => throw PlatformException(code: 'camera_access_denied')),
    ]);
    final before = container.read(workerProfileDraftProvider).photoPath;
    await tester.tap(find.text('Rasm yuklash'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Galereyadan tanlash'));
    await tester.pumpAndSettle();
    expect(find.text("Rasmni olib bo'lmadi. Kamera va galereyaga ruxsatni tekshiring."), findsOneWidget);
    expect(container.read(workerProfileDraftProvider).photoPath, before);
  });

  testWidgets('A02: saving offline says so, not «something went wrong»', (tester) async {
    await profile(tester, [workerProfileRepositoryProvider.overrideWithValue(_OfflineSave())]);
    for (var i = 0; i < 2; i++) {
      await tester.tap(find.text('Davom etish'));
      await tester.pumpAndSettle();
    }
    await tester.ensureVisible(find.text('Saqlash va boshlash'));
    await tester.tap(find.text('Saqlash va boshlash'));
    await tester.pumpAndSettle();
    expect(find.text("Internet aloqasi yo'q. Ulanishni tekshirib, qayta urinib ko'ring."), findsOneWidget);
    expect(find.text('Profil · 3 / 3'), findsOneWidget, reason: 'still on the last step');
  });
}
