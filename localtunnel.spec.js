/* eslint-disable no-console */

/**
 * Integration tests for mygensite client against production server.
 *
 * Requires: https://mygen.site server running
 */

const http = require('http');
const https = require('https');
const assert = require('assert');

const localtunnel = require('./localtunnel');

const SERVER_HOST = 'https://mygen.site';

let fakePort;
let localServer;

before(done => {
  localServer = http.createServer();
  localServer.on('request', (req, res) => {
    res.write(req.headers.host);
    res.end();
  });
  localServer.listen(() => {
    const { port } = localServer.address();
    fakePort = port;
    console.log(`  Local test server on port ${fakePort}`);
    done();
  });
});

after(done => {
  localServer.close(done);
});

/** Helper: HTTPS request to gateway via {slug}.mygen.site */
function gatewayRequest(slug, path = '/') {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${slug}.mygen.site`,
      port: 443,
      method: 'GET',
      path,
      headers: { Host: `${slug}.mygen.site` },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        text: Buffer.concat(chunks).toString(),
        headers: res.headers,
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('tunnel creation', () => {
  it('creates tunnel with random slug', async () => {
    const tunnel = await localtunnel({ port: fakePort, host: SERVER_HOST });
    assert.ok(tunnel.url, 'should have url');
    assert.ok(tunnel.clientId, 'should have clientId');
    tunnel.close();
  });

  it('creates tunnel with specific subdomain', async () => {
    const subdomain = `test-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({ port: fakePort, host: SERVER_HOST, subdomain });
    assert.ok(tunnel.url.includes(subdomain), `url should include subdomain: ${tunnel.url}`);
    tunnel.close();
  });

  it('returns admin_token on creation', async () => {
    const subdomain = `test-tok-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({ port: fakePort, host: SERVER_HOST, subdomain });
    assert.ok(tunnel.admin_token, 'should have admin_token');
    assert.ok(tunnel.admin_token.startsWith('tok_'), 'admin_token should start with tok_');
    tunnel.close();
  });
});

describe('tunnel proxying', () => {
  it('proxies requests through gateway', async () => {
    const subdomain = `test-proxy-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({ port: fakePort, host: SERVER_HOST, subdomain });

    // Wait for TCP sockets to establish
    await new Promise(r => setTimeout(r, 2000));

    const res = await gatewayRequest(subdomain);
    assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${res.text}`);

    tunnel.close();
  });
});

describe('access control params', () => {
  it('creates public tunnel (default)', async () => {
    const subdomain = `test-pub-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({
      port: fakePort,
      host: SERVER_HOST,
      subdomain,
      access: 'public',
    });
    assert.strictEqual(tunnel.access, 'public');
    assert.strictEqual(tunnel.auth_methods, null);
    tunnel.close();
  });

  it('creates tunnel with password auth', async () => {
    const subdomain = `test-pw-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({
      port: fakePort,
      host: SERVER_HOST,
      subdomain,
      auth_method: 'password',
      password: 'test-pass-123',
    });
    assert.ok(tunnel.admin_token);
    tunnel.close();
  });

  it('creates tunnel with ip access', async () => {
    const subdomain = `test-ip-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({
      port: fakePort,
      host: SERVER_HOST,
      subdomain,
      access: 'ip',
      allowed_ips: '127.0.0.0/8',
    });
    assert.strictEqual(tunnel.access, 'ip');
    tunnel.close();
  });

  it('rejects mismatched params (client-side)', () => {
    assert.throws(() => {
      new (require('./lib/Tunnel'))({
        port: fakePort,
        host: SERVER_HOST,
        auth_method: 'password',
        google: 'me@co.com',
      });
    }, /google/);
  });

  it('rejects mismatched params from server', async () => {
    const axios = require('axios');
    try {
      await axios.get(`${SERVER_HOST}/api/tunnels/test-bad-${Date.now().toString(36)}`, {
        params: { auth_method: 'password', google: 'me@co.com' },
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
    }
  });
});

describe('tunnel close', () => {
  it('gateway returns 502 after tunnel closes', async () => {
    const subdomain = `test-close-${Date.now().toString(36)}`;
    const tunnel = await localtunnel({ port: fakePort, host: SERVER_HOST, subdomain });

    // Wait for TCP connection to establish
    await new Promise(r => setTimeout(r, 2000));

    // Verify it works first
    const before = await gatewayRequest(subdomain);
    assert.strictEqual(before.status, 200, `expected 200 before close, got ${before.status}`);

    // Close and wait for cleanup
    tunnel.close();
    await new Promise(r => setTimeout(r, 2000));

    // Should be offline now
    const after = await gatewayRequest(subdomain);
    assert.strictEqual(after.status, 502, `expected 502 after close, got ${after.status}`);
  });
});
