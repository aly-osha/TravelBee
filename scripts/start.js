const { fork } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const services = [
  {
    name: 'API',
    script: path.join(rootDir, 'apps', 'api', 'src', 'server.js'),
    env: { ...process.env, PORT: process.env.PORT || '5000' }
  },
  {
    name: 'REALTIME',
    script: path.join(rootDir, 'apps', 'realtime', 'src', 'server.js'),
    env: { ...process.env, PORT: process.env.REALTIME_PORT || '5001' }
  },
  {
    name: 'WORKER',
    script: path.join(rootDir, 'apps', 'worker', 'src', 'worker.js'),
    env: { ...process.env }
  }
];

// If SERVICE environment variable is set (e.g. SERVICE=api), run only that service
const targetService = process.env.SERVICE ? process.env.SERVICE.toLowerCase() : null;
const servicesToRun = targetService
  ? services.filter(s => s.name.toLowerCase() === targetService)
  : services;

if (servicesToRun.length === 0) {
  console.error(`❌ Unknown SERVICE="${process.env.SERVICE}". Available: api, realtime, worker`);
  process.exit(1);
}

console.log(`🚀 Starting TravelBee services (${servicesToRun.map(s => s.name).join(', ')})...`);

const runningChildren = [];

servicesToRun.forEach(service => {
  console.log(`▶️ Launching [${service.name}] -> ${service.script}`);
  const child = fork(service.script, [], {
    env: service.env,
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    console.log(`⚠️ [${service.name}] process exited (code: ${code}, signal: ${signal})`);
    if (code !== 0 && code !== null) {
      console.error(`❌ [${service.name}] stopped with non-zero exit code.`);
    }
  });

  runningChildren.push(child);
});

function cleanup(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down all services...`);
  runningChildren.forEach(child => {
    if (child && !child.killed) {
      child.kill(signal);
    }
  });
  process.exit(0);
}

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
