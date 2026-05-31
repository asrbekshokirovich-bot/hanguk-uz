const { spawn } = require('child_process');
const fs = require('fs');

fs.writeFileSync('flutter_debug.log', 'Starting...\n');

const env = { ...process.env, CI: 'true', FLUTTER_WEB: 'true', FLUTTER_SUPPRESS_ANALYTICS: 'true' };
const flutter = spawn('flutter.bat', ['run', '-d', 'web-server', '--web-port', '8089'], { env, shell: true });

flutter.stdout.on('data', data => {
  console.log(data.toString());
  fs.appendFileSync('flutter_debug.log', data);
});

flutter.stderr.on('data', data => {
  console.error(data.toString());
  fs.appendFileSync('flutter_debug.log', data);
});

flutter.on('exit', code => {
  console.log(`Exited with ${code}`);
  fs.appendFileSync('flutter_debug.log', `\nEXIT CODE: ${code}`);
});
