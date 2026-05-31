const { spawn } = require('child_process');

console.log("Starting Flutter Web Server on port 8081...");

const flutter = spawn('flutter', ['run', '-d', 'web-server', '--web-port', '8081', '--suppress-analytics'], {
  shell: true,
  stdio: 'inherit',
  cwd: './' 
});

flutter.on('error', (err) => {
  console.error("Spawning error: ", err);
});
