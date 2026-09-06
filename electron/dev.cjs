// Dev launcher: points the shell at the running Vite server so the UI hot-reloads
// inside the real Electron window. Mirrors server/dev.cjs rather than pulling in
// cross-env just to set one variable.
//
// Usage: start `npm run dev` in another terminal first, then `npm run desktop:dev`.

const { spawn } = require('child_process');
const path = require('path');

const electron = require('electron'); // resolves to the executable path

const child = spawn(electron, [path.join(__dirname, '..')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CHAPERONE_DEV_SERVER: process.env.CHAPERONE_DEV_SERVER || 'http://localhost:5173',
  },
});

child.on('exit', code => process.exit(code ?? 0));
