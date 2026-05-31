import 'dart:io';

Future<void> main() async {
  print('Starting full auto-deploy process...');
  
  print('\n[1/3] Running flutter build apk --release...');
  final buildProcess = await Process.start(
    'flutter.bat', 
    ['build', 'apk', '--release'], 
    runInShell: true,
  );
  
  stdout.addStream(buildProcess.stdout);
  stderr.addStream(buildProcess.stderr);
  
  final buildExitCode = await buildProcess.exitCode;
  
  if (buildExitCode != 0) {
    print('Error: flutter build apk failed with exit code $buildExitCode');
    exit(1);
  }
  
  print('\n[2/3] Executing deploy_update.dart to upload to Supabase...');
  final deployProcess = await Process.start(
    'dart', 
    ['deploy_update.dart'], 
    runInShell: true,
  );
  
  stdout.addStream(deployProcess.stdout);
  stderr.addStream(deployProcess.stderr);
  
  final deployExitCode = await deployProcess.exitCode;
  
  if (deployExitCode != 0) {
    print('Error: deploy_update.dart failed with exit code $deployExitCode');
    exit(1);
  }
  
  print('\n[3/3] Deployment complete. The update loop is broken effectively!');
}
