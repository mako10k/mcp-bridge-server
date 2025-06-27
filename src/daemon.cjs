const { spawn } = require('child_process');
const { writeFileSync, readFileSync, existsSync, unlinkSync, statSync, openSync, createReadStream } = require('fs');
const { join, dirname } = require('path');

const PID_DIR = '/tmp';
const LOG_DIR = '/tmp';
const PID_FILE = join(PID_DIR, 'mcp-bridge-server.pid');
const LOG_FILE = join(LOG_DIR, 'mcp-bridge-server.log');
const SERVER_SCRIPT = join(__dirname, '..', 'dist', 'src', 'index.js');

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function startDaemon() {
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
    if (!isNaN(pid) && !isProcessRunning(pid)) {
      // Stale PID file, remove it
      unlinkSync(PID_FILE);
    } else {
      console.error('Daemon is already running. Stop it first.');
      process.exit(1);
    }
  }
  const out = openSync(LOG_FILE, 'a');
  const err = openSync(LOG_FILE, 'a');
  const child = spawn('node', [SERVER_SCRIPT], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: __dirname
  });
  writeFileSync(PID_FILE, `${child.pid}`);
  child.unref();
  console.log(`Daemon started with PID: ${child.pid}`);
  console.log(`Logs: ${LOG_FILE}`);
}

function stopDaemon() {
  if (!existsSync(PID_FILE)) {
    console.error('No running daemon found.');
    process.exit(1);
  }
  const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
  try {
    process.kill(pid);
    unlinkSync(PID_FILE);
    console.log(`Daemon with PID ${pid} stopped.`);
  } catch (err) {
    console.error('Failed to stop daemon:', err);
    process.exit(1);
  }
}

function restartDaemon() {
  stopDaemon();
  startDaemon();
}

function tailLog({ follow = false, lines = 20 } = {}) {
  if (!existsSync(LOG_FILE)) {
    console.error('Log file does not exist:', LOG_FILE);
    process.exit(1);
  }
  const fileSize = statSync(LOG_FILE).size;
  const readLastLines = (n) => {
    const data = readFileSync(LOG_FILE, 'utf-8');
    const arr = data.split(/\r?\n/);
    return arr.slice(-n).join('\n');
  };
  if (!follow) {
    console.log(readLastLines(lines));
    return;
  }
  // follow mode
  let lastSize = fileSize;
  process.stdout.write(readLastLines(lines) + '\n');
  const interval = setInterval(() => {
    const newSize = statSync(LOG_FILE).size;
    if (newSize > lastSize) {
      const stream = createReadStream(LOG_FILE, { start: lastSize, end: newSize });
      stream.pipe(process.stdout, { end: false });
      lastSize = newSize;
    }
  }, 1000);
  process.on('SIGINT', () => clearInterval(interval));
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'start':
    startDaemon();
    break;
  case 'stop':
    stopDaemon();
    break;
  case 'restart':
    restartDaemon();
    break;
  case 'log': {
    let follow = false;
    let lines = 20;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '-f') follow = true;
      if (args[i] === '-n' && args[i + 1]) lines = parseInt(args[i + 1], 10);
    }
    tailLog({ follow, lines });
    break;
  }
  default:
    console.error('Usage: node daemon.cjs <start|stop|restart|log [-f] [-n N] >');
    process.exit(1);
}
