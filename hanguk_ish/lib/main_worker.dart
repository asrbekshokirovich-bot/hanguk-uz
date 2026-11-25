import 'app/bootstrap.dart';
import 'app/flavor.dart';
import 'app/worker_app.dart';

/// «HanPyol» — `flutter run --flavor worker -t lib/main_worker.dart`.
void main() => bootstrap(Flavor.worker, const WorkerApp());
