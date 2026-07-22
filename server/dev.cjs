// Dev launcher: enable NODE_USE_ENV_PROXY so Node's fetch/undici honors HTTPS_PROXY.
// Some machines can only reach the model APIs (OpenAI/Google/Anthropic) through a local
// proxy/VPN (e.g. 127.0.0.1:7892). curl respects HTTPS_PROXY but Node's fetch does NOT by
// default, so the backend would time out. This flag must be set BEFORE Node starts undici,
// which is why it lives in a launcher rather than in index.ts. Harmless when no proxy is set.
process.env.NODE_USE_ENV_PROXY = process.env.NODE_USE_ENV_PROXY || '1';

const { spawn } = require('child_process');
const isWin = process.platform === 'win32';
const bin = isWin ? 'ts-node-dev.cmd' : 'ts-node-dev';

const child = spawn(bin, ['--respawn', '--transpile-only', 'src/index.ts'], {
  stdio: 'inherit',
  env: process.env,
  shell: isWin, // resolve the .cmd shim on Windows
  cwd: __dirname,
});
child.on('exit', code => process.exit(code ?? 0));
