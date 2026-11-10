import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/worker/feed/feed_area.dart';
import '../../features/worker/profile/worker_profile_draft.dart';
import '../../features/worker/profile/worker_profile_repository.dart';
import '../repositories/account_repository.dart';
import '../repositories/auth_repository.dart';
import '../repositories/employer_repository.dart';
import '../repositories/live_updates.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';
import 'supabase_account_repository.dart';
import 'supabase_auth_repository.dart';
import 'supabase_employer_repository.dart';
import 'supabase_live_updates.dart';
import 'supabase_shift_repository.dart';

/// Points every repository of both apps at the Hanguk Ish database.
List<Override> backendOverrides(BackendConfig config, SupabaseClient client) => [
      backendConfigProvider.overrideWithValue(config),
      supabaseClientProvider.overrideWithValue(client),
      authRepositoryProvider.overrideWith((ref) => SupabaseAuthRepository(client)),
      liveUpdatesProvider.overrideWith((ref) => SupabaseLiveUpdates(client)),
      appResumesProvider.overrideWith((ref) {
        final resumes = StreamController<void>.broadcast();
        final listener = AppLifecycleListener(onResume: () => resumes.add(null));
        ref.onDispose(() {
          listener.dispose();
          resumes.close();
        });
        return resumes.stream;
      }),
      shiftRepositoryProvider.overrideWith((ref) => SupabaseShiftRepository(client, config)),
      accountRepositoryProvider.overrideWith((ref) => SupabaseAccountRepository(client)),
      workerProfileRepositoryProvider.overrideWith((ref) => SupabaseWorkerProfileRepository(client, config)),
      employerRepositoryProvider.overrideWith((ref) => SupabaseEmployerRepository(client, config)),
      locationServiceProvider.overrideWith(
        (ref) => DeviceLocationService(district: () => ref.read(workerProfileDraftProvider).district),
      ),
    ];
