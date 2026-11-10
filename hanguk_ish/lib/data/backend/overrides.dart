import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/worker/profile/worker_profile_repository.dart';
import '../repositories/account_repository.dart';
import '../repositories/employer_repository.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';
import 'supabase_account_repository.dart';
import 'supabase_employer_repository.dart';
import 'supabase_shift_repository.dart';

/// Points every repository of both apps at the Hanguk Ish database.
List<Override> backendOverrides(BackendConfig config, SupabaseClient client) => [
      backendConfigProvider.overrideWithValue(config),
      supabaseClientProvider.overrideWithValue(client),
      shiftRepositoryProvider.overrideWith((ref) => SupabaseShiftRepository(client, config)),
      accountRepositoryProvider.overrideWith((ref) => SupabaseAccountRepository(client)),
      workerProfileRepositoryProvider.overrideWith((ref) => SupabaseWorkerProfileRepository(client, config)),
      employerRepositoryProvider.overrideWith((ref) => SupabaseEmployerRepository(client, config)),
    ];
