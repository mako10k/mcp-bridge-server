import { spawn, execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const PID_DIR = '/var/run';
const PID_FILE = join(PID_DIR, 'mcp-bridge-server.pid');
const SERVER_SCRIPT = join(__dirname, 'index.js');

function startDaemon() {
  if (existsSync(PID_FILE)) {
    console.error('Daemon is already running. Stop it first.');
    process.exit(1);
  }

  const child = spawn('node', [SERVER_SCRIPT], {
    detached: true,
    stdio: 'ignore',
  });

  writeFileSync(PID_FILE, `${child.pid}`);
  child.unref();
  console.log(`Daemon started with PID: ${child.pid}`);
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

const command = process.argv[2];

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
  default:
    console.error('Usage: node daemon.js <start|stop|restart>');
    process.exit(1);
}
