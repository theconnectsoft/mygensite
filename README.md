# mygensite

Expose your localhost to the world via [mygen.site](https://mygen.site) with access control.

Built for AI agents — works as a [Claude Code](https://claude.com/claude-code) plugin with a `/share` skill for natural language deployment.

## Install

```bash
npm install mygensite
```

## Claude Code Integration

Install the `/share` skill as a plugin — then just say "share this" or "deploy this":

```
# In Claude Code (recommended):
/plugin marketplace add theconnectsoft/mygensite
/plugin install mygensite@theconnectsoft-mygensite

# Or manually:
mkdir -p .claude/skills/share
curl -o .claude/skills/share/SKILL.md https://mygen.site/share-skill.md
```

The skill auto-detects tunnel vs static deploy, manages tokens, and handles settings changes — no manual API calls needed.

## Tunnel (expose local server)

```js
const mygensite = require('mygensite');

const tunnel = await mygensite({
  port: 3000,                          // required: local port
  subdomain: 'my-app',                 // optional: default random
  host: 'https://mygen.site',          // optional: default mygen.site

  // Layer 1: Network access
  access: 'public',                    // optional: 'public' | 'ip' (default: 'public')
  allowed_ips: ['1.2.3.0/24'],         // required when access='ip'

  // Layer 2: Auth method(s)
  auth_method: 'password',             // optional: CSV of 'password', 'google', 'telegram'
  password: 'secret',                  // required when auth_method includes 'password'
  google: 'alice@company.com,@company.com', // required when auth_method includes 'google' (supports @domain.com patterns)
  telegram: '123456',                  // required when auth_method includes 'telegram'

  owner_email: 'alice@company.com',    // optional: email or Telegram username for dashboard
  ttl: 3600,                           // optional: 60-86400 seconds (default: 3600)
  token: 'mgs_xxx',                    // optional: API token (or set MYGENSITE_TOKEN env)
});

// Result
tunnel.url          // "https://my-app.mygen.site"
tunnel.password     // "secret"
tunnel.admin_token  // "tok_xxx"
tunnel.expires_at   // "2025-06-01T13:00:00Z"

// Runtime management
await tunnel.updateAccess({ access: 'public' });
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
  access: 'public',                      // optional: 'public' | 'ip' (default: 'public')
  auth_method: 'password',              // optional: CSV of 'password', 'google', 'telegram'
  password: 'secret',                   // when auth_method includes 'password'
  owner_email: 'alice@company.com',      // optional: email or Telegram username for dashboard
  ttl: 86400,                            // optional: 0 (unlimited) or 60-259200 seconds (default: 3600)
  token: 'mgs_xxx',                      // optional: API token (or set MYGENSITE_TOKEN env)
});

// Result
site.url            // "https://demo.mygen.site"
site.admin_token    // "tok_yyy"
site.slug           // "demo"
site.expires_at     // "2025-06-02T12:00:00Z"

// Management
await site.updateAccess({ auth_method: 'password', password: 'secret' });
await site.extendTTL(86400);
await site.redeploy('./dist-v2');   // upload new files
await site.delete();                // soft delete
await site.delete(true);            // purge (delete S3 files too)
```

## Manage (existing service)

Use `manage()` when you already have the `slug` and `admin_token` from a previous deploy or tunnel.
**Do not redeploy just to get a management object** — use this instead.

```js
const mygensite = require('mygensite');

const site = mygensite.manage({
  slug: 'demo',
  admin_token: 'tok_xxx',       // from the original deploy response
  host: 'https://mygen.site',   // optional
});

// Same methods as deploy result
await site.updateAccess({ access: 'public' });
await site.extendTTL(86400);
await site.redeploy('./dist-v2');
await site.delete();
```

## Access Control (2-Layer Model)

### Layer 1 — Network (`access`)
| value | behavior |
|-------|----------|
| `public` | anyone can reach (default) |
| `ip` | only `allowed_ips` can reach |

### Layer 2 — Auth (`auth_method`)
| value | behavior |
|-------|----------|
| _(empty)_ | no authentication (default) |
| `password` | password form + cookie session |
| `google` | Google OAuth → allowed emails only (supports `@domain.com` patterns) |
| `telegram` | Telegram login → allowed user IDs only |
| `password,google` | password OR Google (user picks) |

Both layers apply sequentially: IP check → auth check.

## API Token Authentication

By default, service creation (tunnel/deploy) is restricted to allowed IPs. To create from any IP, generate an API token from the [dashboard](https://mygen.site/dashboard/api).

```js
// Option 1: Pass token directly
const tunnel = await mygensite({ port: 3000, token: 'mgs_xxx' });
const site = await mygensite.deploy({ directory: './dist', token: 'mgs_xxx' });

// Option 2: Set environment variable (auto-detected)
// export MYGENSITE_TOKEN=mgs_xxx
const tunnel = await mygensite({ port: 3000 });  // token picked up from env
```

```bash
# CLI
mygensite --port 3000 --token mgs_xxx
mygensite deploy -d ./dist --token mgs_xxx

# Or via environment variable
MYGENSITE_TOKEN=mgs_xxx mygensite --port 3000
```

When using an API token, `owner_email` is automatically set to the token owner's account email.

## TTL (Time to Live)

| type | range | unlimited |
|------|-------|-----------|
| Tunnel | 60–86400 seconds (max 24h) | not supported |
| Static | 60–259200 seconds (max 3 days) | `ttl: 0` — requires at least one auth method |

Unlimited TTL (`ttl: 0`) is only available for static deploys and requires at least one auth method (password, google, or telegram). You cannot remove auth from a service with unlimited TTL without also setting a finite TTL.

## Examples

Full runnable examples in [`examples/`](https://github.com/theconnectsoft/mygensite/tree/main/examples):

- **[tunnel-basic.mjs](https://github.com/theconnectsoft/mygensite/blob/main/examples/tunnel-basic.mjs)** — Tunnel with signal handling and heartbeat (background-friendly)
- **[static-deploy.mjs](https://github.com/theconnectsoft/mygensite/blob/main/examples/static-deploy.mjs)** — Static deploy with unlimited TTL and auth
- **[manage-service.mjs](https://github.com/theconnectsoft/mygensite/blob/main/examples/manage-service.mjs)** — Settings, TTL, redeploy, delete via manage()

## Constraints

### Slug (subdomain)

- 4–63 characters, lowercase letters, numbers, and hyphens only
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
| 400 | `invalid_slug` | slug format invalid | use 4-63 chars, lowercase alphanum + hyphen (e.g. `my-app-1`) |
| 400 | `reserved_slug` | slug is reserved | choose different slug. reserved: www, api, dashboard, admin, etc. |
| 400 | `invalid_ttl` | TTL out of range | tunnels: 60-86400s, static: 0 (unlimited) or 60-259200s. Unlimited requires auth. |
| 400 | `invalid_access` | bad access mode | use: public, ip |
| 401 | `unauthorized` | wrong admin_token | use the `admin_token` from tunnel creation response |
| 404 | `not_found` | service not found | verify slug is correct and tunnel is active |
| 409 | `slug_in_use` | slug already taken | use different slug, or omit `subdomain` for random |
| 410 | `expired` | TTL expired | call `extendTTL()` or create new tunnel |
| 502 | — | tunnel offline | restart tunnel client |

## CLI

```bash
# Tunnel (public)
mygensite --port 3000 --subdomain my-app --ttl 7200

# Tunnel with password auth
mygensite --port 3000 --subdomain my-app --auth-method password --password 'secret'

# Tunnel with IP restriction + Google auth
mygensite --port 3000 -s my-app --access ip --allowed-ips '1.2.3.0/24' \
  --auth-method google --google 'alice@company.com'

# Deploy (static)
mygensite deploy --directory ./dist --subdomain demo --ttl 86400

# Deploy with password
mygensite deploy -d ./dist -s private-demo --auth-method password --password 'mypass'

# Redeploy (reuse admin_token)
mygensite deploy -d ./dist-v2 -s demo --admin-token tok_xxx

# With API token (skip IP restriction)
mygensite --port 3000 -s my-app --token mgs_xxx
MYGENSITE_TOKEN=mgs_xxx mygensite deploy -d ./dist -s demo
```

## curl Deploy

```bash
# Simple (flat files, public)
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F access=public \
  -F files=@index.html -F files=@style.css

# With password auth
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F auth_method=password -F password=secret \
  -F files=@index.html

# With subdirectories — use filepaths to preserve directory structure
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F access=public \
  -F 'filepaths=["index.html","assets/style.css","assets/js/app.js"]' \
  -F files=@index.html \
  -F files=@assets/style.css \
  -F files=@assets/js/app.js
```

> **Note:** Multipart `filename` strips directory paths. The `filepaths` JSON field tells the server the correct path for each file, in order.

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
- [API docs](https://mygen.site/docs) — full endpoint reference
- [llms.txt](https://mygen.site/llms.txt) — LLM-readable docs

## License

MIT
