import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';

const processSpecs = mode === 'start'
  ? [
      { label: 'api', command: 'npm', args: ['run', 'start:api'] },
      { label: 'worker', command: 'npm', args: ['run', 'start:worker'] }
    ]
  : [
      { label: 'api', command: 'npm', args: ['run', 'dev:api'] },
      { label: 'worker', command: 'npm', args: ['run', 'dev:worker'] }
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
    shell: true,
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
