# mygensite

Expose your localhost to the world via [mygen.site](https://mygen.site) with access control.

## Install

```bash
npm install mygensite
```

## Tunnel (expose local server)

```js
const mygensite = require('mygensite');

const tunnel = await mygensite({
  port: 3000,                          // required: local port
  subdomain: 'my-app',                 // optional: default random
  host: 'https://mygen.site',          // optional: default mygen.site
  access: 'password',                  // optional: public | password | ip_only | both (default: both)
  password: 'secret',                  // optional: auto-generated if omitted
  allowed_ips: ['1.2.3.0/24'],         // optional: for ip_only or both
  owner_email: 'alice@company.com',    // optional: dashboard management
  ttl: 3600,                           // optional: seconds, 60-86400 (default: 3600)
});

// Result
tunnel.url          // "https://my-app.mygen.site"
tunnel.password     // "secret"
tunnel.admin_token  // "tok_xxx"
tunnel.expires_at   // "2025-06-01T13:00:00Z"

// Runtime management
await tunnel.updateAccess({ mode: 'public' });
await tunnel.extendTTL(3600);

// Cleanup
tunnel.close();
```

## Deploy (static site hosting)

```js
const mygensite = require('mygensite');

const site = await mygensite.deploy({
  directory: './dist',                   // required: local directory to upload
  subdomain: 'demo',                     // optional: default random
  host: 'https://mygen.site',           // optional: default mygen.site
  access: 'public',                      // optional: default both
  owner_email: 'alice@company.com',      // optional: dashboard management
  ttl: 86400,                            // optional: seconds (default: 3600)
});

// Result
site.url            // "https://demo.mygen.site"
site.admin_token    // "tok_yyy"
site.slug           // "demo"
site.expires_at     // "2025-06-02T12:00:00Z"

// Management
await site.updateAccess({ mode: 'password', password: 'secret' });
await site.extendTTL(86400);
await site.redeploy('./dist-v2');   // upload new files
await site.delete();                // soft delete
await site.delete(true);            // purge (delete S3 files too)
```

## Access Modes

| mode | behavior |
|------|----------|
| `public` | anyone can access |
| `password` | password required |
| `ip_only` | allowed_ips only |
| `both` | allowed_ips + password (default) |

## Error Codes

| status | error | when | fix |
|--------|-------|------|-----|
| 400 | `invalid_slug` | slug format invalid | use 3-63 chars, lowercase alphanum + hyphen (e.g. `my-app-1`) |
| 400 | `reserved_slug` | slug is reserved | choose different slug. reserved: www, api, dashboard, admin, etc. |
| 400 | `invalid_ttl` | TTL out of range | use 60-86400 (seconds) |
| 400 | `invalid_access` | bad access mode | use: public, password, ip_only, both |
| 401 | `unauthorized` | wrong admin_token | use the `admin_token` from tunnel creation response |
| 404 | `not_found` | service not found | verify slug is correct and tunnel is active |
| 409 | `slug_in_use` | slug already taken | use different slug, or omit `subdomain` for random |
| 410 | `expired` | TTL expired | call `extendTTL()` or create new tunnel |
| 502 | — | tunnel offline | restart tunnel client |

## CLI

```bash
# Tunnel
mygensite --port 3000 --subdomain my-app --access password --password secret --ttl 7200

# Deploy (coming soon)
```

## Documentation

- [English (detailed)](./README.en.md) — full API reference, all options, events, methods
- [한국어](./README.ko.md) — 한국어 상세 문서

## License

MIT
