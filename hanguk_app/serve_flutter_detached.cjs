const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('./web_out.log', 'a');
const err = fs.openSync('./web_err.log', 'a');

console.log("Launching flutter web-server detached on port 8081...");

const p = spawn('flutter', ['run', '-d', 'web-server', '--web-hostname', '127.0.0.1', '--web-port', '8081', '--suppress-analytics'], {
  detached: true,
  stdio: [ 'ignore', out, err ],
  shell: process.platform === 'win32'
});

p.unref();
console.log("Launched in background! Wait 15-20 seconds for compilation.");
