import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/interview_repository.dart';
import 'package:hanguk_app/features/training/presentation/widgets/interview_active_view.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _FakeInterview extends InterviewNotifier {
  int abandoned = 0;
  final connected = <bool>[];

  @override
  InterviewSessionState build() => const InterviewSessionState(status: 'active', targetUniversityName: 'Kongju');

  @override
  Future<void> markAbandoned() async => abandoned++;

  @override
  void setVapiConnected(bool value) {
    connected.add(value);
    super.setVapiConnected(value);
  }
}

class _MemoryStorage extends GotrueAsyncStorage {
  final _items = <String, String>{};

  @override
  Future<String?> getItem({required String key}) async => _items[key];

  @override
  Future<void> removeItem({required String key}) async => _items.remove(key);

  @override
  Future<void> setItem({required String key, required String value}) async => _items[key] = value;
}

void main() {
  setUpAll(() async {
    await Supabase.initialize(
      url: 'https://example.supabase.co',
      anonKey: 'test-anon-key',
      authOptions: FlutterAuthClientOptions(
        localStorage: const EmptyLocalStorage(),
        pkceAsyncStorage: _MemoryStorage(),
        autoRefreshToken: false,
      ),
    );
  });

  // Leaving the screen mid-call (system back) disposes the live view. The
  // teardown used `ref` and `setState` inside dispose(), which throws there,
  // so the rest of the teardown never ran: the call was not stopped and the
  // session was not marked abandoned.
  testWidgets('leaving mid-call tears the call down without throwing', (t) async {
    final fake = _FakeInterview();
    final onScreen = ValueNotifier(true);
    await t.pumpWidget(
      ProviderScope(
        overrides: [interviewProvider.overrideWith(() => fake)],
        child: MaterialApp(
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: ValueListenableBuilder<bool>(
            valueListenable: onScreen,
            builder: (_, show, _) => Scaffold(body: show ? const InterviewActiveView() : const SizedBox()),
          ),
        ),
      ),
    );
    await t.pump(const Duration(milliseconds: 200));

    // The student leaves: the view goes, the app (and its providers) stay.
    onScreen.value = false;
    await t.pump();
    await t.pump();
    // A handshake still in flight times out after 30s; it must not reach for
    // the gone widget either.
    await t.pump(const Duration(seconds: 31));

    expect(t.takeException(), isNull);
    expect(fake.abandoned, 1);
    expect(fake.connected.last, isFalse);
  });
}
