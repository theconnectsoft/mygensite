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

## Constraints

### Slug (subdomain)

- 3–63 characters, lowercase letters, numbers, and hyphens only
- Must start and end with a letter or number (not a hyphen)
- Reserved: `www`, `api`, `dashboard`, `admin`, `docs`, `status`, `health`, etc.
- A slug used as a tunnel cannot be reused for static deploy (and vice versa)

### File Paths (static deploy)

- Allowed: letters, numbers, `-`, `_`, `.`, spaces, `/` for directories
- Max path: 1024 chars, max segment: 255 chars
- No `..`, no hidden files (`.env`), no backslashes
- Total upload limit: **50 MB**

### Static File Serving

- `/` → `index.html`
- `/about/` → `about/index.html`
- `/about` (no slash) → falls back to `about/index.html`
- Content-Type set by extension (`.css` → `text/css`, `.js` → `application/javascript`)

### Client-Side Validation

The library validates slug, file paths, TTL, and access mode before making API calls:

```js
const mygensite = require('mygensite');

// Throws immediately if slug is invalid
const tunnel = await mygensite({ port: 3000, subdomain: 'INVALID' });
// Error: Slug must be lowercase alphanumeric and hyphens...

// Use validators directly
const { validate } = mygensite;
validate.validateSlug('my-app');       // { valid: true }
validate.validateSlug('AB');           // { valid: false, error: '...' }
validate.validateFilePath('../etc');   // { valid: false, error: '...' }
validate.validateTTL(30);             // { valid: false, error: '...' }
```

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
mygensite --port 3000 --subdomain my-app --access password --password 'secret' --ttl 7200

# Deploy
mygensite deploy --directory ./dist --subdomain demo --access public --ttl 86400

# Deploy with password
mygensite deploy -d ./dist -s private-demo --access password --password 'mypass'

# Redeploy (reuse admin_token)
mygensite deploy -d ./dist-v2 -s demo --admin-token tok_xxx
```

## Passwords with Special Characters

When using the CLI or curl, passwords with special characters (like `!`, `$`, `&`, `\`) may be modified by your shell before reaching the program.

**Use single quotes** to prevent shell interpretation:

```bash
# CORRECT — single quotes preserve special characters
mygensite --port 3000 --password 'my!p@ss$word'

# WRONG — double quotes: bash expands ! and $
mygensite --port 3000 --password "my!p@ss$word"

# WRONG — unquoted: shell interprets special chars
mygensite --port 3000 --password my!p@ss$word
```

When using curl:

```bash
# CORRECT
curl 'http://mygen.site/api/tunnels/my-app?password=my!pass'

# WRONG — double quotes let bash expand !
curl "http://mygen.site/api/tunnels/my-app?password=my!pass"
```

When using the **Node.js API**, no escaping is needed — JavaScript string literals preserve all characters:

```js
const tunnel = await mygensite({ port: 3000, password: 'my!p@ss$word' });
// password is stored and returned exactly as provided
```

## Documentation

- [English (detailed)](./README.en.md) — full API reference, all options, events, methods
- [한국어](./README.ko.md) — 한국어 상세 문서

## License

MIT
