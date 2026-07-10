import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';

// In start mode, spawn node directly (no npm wrapper, no shell) so that
// child.kill() reaches the actual server process. Killing a shell/npm
// wrapper orphans the underlying node process, which then keeps the port
// bound and blocks every subsequent restart.
const processSpecs = mode === 'start'
  ? [
      { label: 'api', command: process.execPath, args: ['dist/index.js'], shell: false },
      { label: 'worker', command: process.execPath, args: ['dist/workers/mediaJobs.worker.js'], shell: false }
    ]
  : [
      { label: 'api', command: 'npm', args: ['run', 'dev:api'], shell: true },
      { label: 'worker', command: 'npm', args: ['run', 'dev:worker'], shell: true }
    ];

const children = [];
let shuttingDown = false;

const shutdownAll = (signal = 'SIGTERM') => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // ignore shutdown errors
      }
    }
  }
};

for (const spec of processSpecs) {
  const child = spawn(spec.command, spec.args, {
    stdio: 'inherit',
    shell: spec.shell,
    env: process.env
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code && code !== 0) {
      console.error(`[runner] ${spec.label} exited with code ${code}`);
      shutdownAll();
      process.exit(code);
      return;
    }

    if (signal) {
      console.error(`[runner] ${spec.label} exited via signal ${signal}`);
      shutdownAll();
      process.exit(1);
      return;
    }

    console.info(`[runner] ${spec.label} exited.`);
    shutdownAll();
    process.exit(0);
  });

  child.on('error', (error) => {
    console.error(`[runner] Failed to start ${spec.label}: ${error.message}`);
    shutdownAll();
    process.exit(1);
  });

  children.push(child);
}

process.on('SIGINT', () => {
  shutdownAll('SIGINT');
});

process.on('SIGTERM', () => {
  shutdownAll('SIGTERM');
});
