import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const port = await reservePort();
const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-production-'));
const entrypoint = path.resolve(process.cwd(), 'dist', 'server', 'index.mjs');
const child = spawn(process.execPath, [entrypoint], {
  env: {
    ...process.env,
    APP_HOST: '127.0.0.1',
    APP_PORT: String(port),
    APP_DATA_DIR: dataPath,
    SESSION_SECRET: 'production-smoke-session-secret-32-characters',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

try {
  const deadline = Date.now() + 10_000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited early (${child.exitCode}).\n${output}`);
    }
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) break;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert(response?.ok, `Health check did not become ready.\n${output}`);
  const health = await response.json();
  assert.equal(health.status, 'ok');

  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);

  // PWA 静态资源必须可被匿名访问（安装流程在登录前就会拉取 manifest 和图标）
  const manifestResponse = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.short_name, '旅行足迹');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  const swResponse = await fetch(`http://127.0.0.1:${port}/sw.js`);
  assert.equal(swResponse.status, 200);
  assert.match(await swResponse.text(), /addEventListener\('fetch'/);
  for (const iconPath of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
    const iconResponse = await fetch(`http://127.0.0.1:${port}${iconPath}`);
    assert.equal(iconResponse.status, 200, `${iconPath} should be served`);
    assert.match(iconResponse.headers.get('content-type') ?? '', /image\/png/);
  }

  assert.equal((await fetch(`http://127.0.0.1:${port}/api/places`)).status, 401);
  const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie')?.split(';', 1)[0];
  assert(cookie);
  const authenticatedHeaders = { Cookie: cookie };

  const placesBefore = await fetch(`http://127.0.0.1:${port}/api/places`, { headers: authenticatedHeaders }).then((result) => result.json());
  assert.equal(placesBefore.length, 0);
  const createdPlaceResponse = await fetch(`http://127.0.0.1:${port}/api/places`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authenticatedHeaders },
    body: JSON.stringify({
      name: 'Production smoke place',
      category_id: 'scenic',
      latitude: 23.1,
      longitude: 116.1,
      address: 'Temporary test data',
    }),
  });
  assert.equal(createdPlaceResponse.status, 200);
  const createdPlace = await createdPlaceResponse.json();
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/places`, { headers: authenticatedHeaders }).then((result) => result.json())).length, 1);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/places/${createdPlace.id}`, {
    method: 'DELETE',
    headers: authenticatedHeaders,
  })).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/backups`, { headers: authenticatedHeaders })).status, 410);
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  fs.rmSync(dataPath, { recursive: true, force: true });
}

console.log('Production smoke test passed.');
