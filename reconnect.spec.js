/* eslint-disable no-console */

/**
 * Reconnection tests — run fully offline against a mock API + mock
 * tunnel listener. Verifies the ssh-tunnel-like behavior: when the
 * remote TCP listener disappears (server restart / grace timeout), the
 * client re-registers through the API with its admin_token and keeps
 * the tunnel alive.
 *
 * Run: npx mocha reconnect.spec.js
 */

const http = require('http');
const net = require('net');
const assert = require('assert');
const { URL } = require('url');

const localtunnel = require('./localtunnel');

const SLUG = 'reconnect-test';

function listen(server, port = 0) {
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server.address().port)));
}

describe('reconnect', () => {
  let apiServer;
  let apiPort;
  let tunnelServer;
  let tunnelPort;
  let apiRequests; // captured { adminToken } per tunnel-create request
  let tunnel;

  let tunnelSockets;

  const startTunnelListener = async () => {
    tunnelSockets = new Set();
    tunnelServer = net.createServer(socket => {
      tunnelSockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => tunnelSockets.delete(socket));
    });
    tunnelPort = await listen(tunnelServer);
  };

  const stopTunnelListener = () =>
    new Promise(resolve => {
      // destroy established sockets too so the client notices right away
      for (const s of tunnelSockets) s.destroy();
      tunnelServer.close(() => resolve());
    });

  before(async () => {
    apiRequests = [];
    await startTunnelListener();

    apiServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      assert.strictEqual(url.pathname, `/${SLUG}`);
      const isFirst = apiRequests.length === 0;
      apiRequests.push({ adminToken: url.searchParams.get('admin_token') });

      const body = JSON.stringify({
        id: SLUG,
        port: tunnelPort,
        url: `http://${SLUG}.example.com`,
        max_conn_count: 2,
        // reconnect responses return null tokens, like the real server
        admin_token: isFirst ? 'tok_original' : null,
        password: isFirst ? 'pw_original' : null,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
    });
    apiPort = await listen(apiServer);
  });

  after(done => {
    if (tunnel) tunnel.close();
    tunnelServer.close(() => apiServer.close(done));
  });

  it('opens and stores admin_token from the first response', async () => {
    tunnel = await localtunnel({
      host: `http://127.0.0.1:${apiPort}`,
      port: 9999, // local port — never actually connected in this test
      subdomain: SLUG,
    });
    assert.strictEqual(tunnel.admin_token, 'tok_original');
    assert.strictEqual(tunnel.password, 'pw_original');
    assert.strictEqual(apiRequests.length, 1);
    assert.strictEqual(apiRequests[0].adminToken, null);
  });

  it('re-registers via the API with admin_token when the listener is gone', async function () {
    this.timeout(20000);

    const reconnected = new Promise(resolve => tunnel.once('reconnect', resolve));

    // kill the remote listener and all its sockets → client sockets die,
    // reconnect attempts get ECONNREFUSED → client must re-init via API
    await stopTunnelListener();
    // start a replacement listener on a NEW port; the mock API hands it out
    await startTunnelListener();

    await reconnected;

    assert.ok(apiRequests.length >= 2, 'expected a re-registration API call');
    const last = apiRequests[apiRequests.length - 1];
    assert.strictEqual(last.adminToken, 'tok_original', 'reconnect must pass the stored admin_token');
  });

  it('keeps admin_token/password after a reconnect response with nulls', () => {
    assert.strictEqual(tunnel.admin_token, 'tok_original');
    assert.strictEqual(tunnel.password, 'pw_original');
  });
});
