/**
 * Static file deployment examples.
 *
 * Usage:
 *   node static-deploy.mjs <directory> [subdomain]
 *
 * Deploys a directory to {subdomain}.mygen.site.
 * TTL 0 = unlimited (no expiry).
 */
import mygensite from '../localtunnel.js';

const directory = process.argv[2];
const subdomain = process.argv[3] || undefined;

if (!directory) {
  console.error('Usage: node static-deploy.mjs <directory> [subdomain]');
  process.exit(1);
}

// --- Example 1: Deploy a directory (public, unlimited) ---

const site = await mygensite.deploy({
  directory,
  subdomain,
  owner_email: 'you@example.com',
  access: 'public',
  ttl: 0, // unlimited — static only (max 259200 for timed)
  // admin_token: 'tok_xxx',  // pass this to redeploy an existing site
});

console.log(JSON.stringify({
  url: site.url,
  slug: site.slug,
  admin_token: site.admin_token,
  password: site.password || null,
  expires_at: site.expires_at || null, // null when unlimited
}));


// --- Example 2: Deploy with password protection ---
/*
const protectedSite = await mygensite.deploy({
  directory: './dist',
  subdomain: 'private-demo',
  owner_email: 'you@example.com',
  auth_method: 'password',
  password: 'secret123',
  ttl: 86400, // 1 day
});
*/


// --- Example 3: Deploy from in-memory files ---
/*
const site = await mygensite.deploy({
  files: [
    { name: 'index.html', content: Buffer.from('<h1>Hello</h1>'), contentType: 'text/html' },
    { name: 'style.css', content: Buffer.from('body { color: red; }'), contentType: 'text/css' },
  ],
  owner_email: 'you@example.com',
  ttl: 0,
});
*/
