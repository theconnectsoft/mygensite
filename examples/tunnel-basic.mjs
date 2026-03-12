/**
 * Basic tunnel example — expose a local server to the internet.
 *
 * Usage:
 *   node tunnel-basic.mjs [port] [subdomain]
 *
 * The tunnel stays alive in the background with signal handling and heartbeat.
 * Ideal for AI agents that need to keep a tunnel running.
 */
import mygensite from '../localtunnel.js';

const port = Number(process.argv[2]) || 3000;
const subdomain = process.argv[3] || undefined;

const tunnel = await mygensite({
  port,
  subdomain,
  owner_email: 'you@example.com',
  access: 'public',
  ttl: 3600, // 1 hour (max 86400 for tunnels)
  // admin_token: 'tok_xxx',  // pass this to reconnect to an existing tunnel
});

// First line: JSON for programmatic consumption
console.log(JSON.stringify({
  url: tunnel.url,
  slug: tunnel.clientId,
  admin_token: tunnel.admin_token,
  password: tunnel.password || null,
  expires_at: tunnel.expires_at || null,
}));

// Graceful shutdown
process.on('SIGINT', () => { tunnel.close(); process.exit(0); });
process.on('SIGTERM', () => { tunnel.close(); process.exit(0); });

tunnel.on('close', () => {
  console.error('[tunnel] closed');
  process.exit(1);
});

tunnel.on('error', (err) => {
  console.error('[tunnel] error:', err.message);
});

// Heartbeat every 5 minutes
setInterval(() => {
  console.error(`[tunnel] alive — ${tunnel.url}`);
}, 5 * 60 * 1000);
