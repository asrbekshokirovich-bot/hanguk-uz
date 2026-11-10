import 'app/bootstrap.dart';
import 'app/employer_app.dart';
import 'app/flavor.dart';

/// «Hanguk Ish 사장님» — `flutter run --flavor employer -t lib/main_employer.dart`.
void main() => bootstrap(Flavor.employer, const EmployerApp());
