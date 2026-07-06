# mygensite

Expose your localhost to the world via [mygen.site](https://mygen.site) with access control.

A fork of [localtunnel](https://github.com/localtunnel/localtunnel) with extended features: 2-layer access control (network + auth), Google OAuth, Telegram login, TTL, owner management, and admin tokens.

## Quickstart

```
npx mygensite --port 8000
```

## Installation

### Globally

```
npm install -g mygensite
```

### As a dependency in your project

```
npm install mygensite
```

## CLI usage

```
mygensite --port 8000
```

It will connect to mygen.site, set up the tunnel, and tell you what URL to use. The `lt` command also works for backward compatibility.

### Arguments

Below are some common arguments. See `mygensite --help` for all options.

- `--port` (required) local port to expose
- `--subdomain` request a named subdomain (default is random)
- `--host` upstream server URL (default: `https://mygen.site`)
- `--local-host` proxy to a hostname other than localhost
- `--access` network layer: `public`, `ip` (default: `public`)
- `--auth-method` auth layer (CSV): `password`, `google`, `telegram`
- `--password` password (when auth-method includes password)
- `--google` allowed Google email(s) or `@domain.com` patterns
- `--telegram` allowed Telegram user ID(s)
- `--owner-email` owner email for dashboard management
- `--ttl` tunnel TTL in seconds, 60-86400 (default: 3600)

```
mygensite --port 3000 --subdomain my-app --auth-method password --password secret --ttl 7200
```

Output includes URL, password, and admin_token for runtime management.

You may also specify arguments via env variables:

```
PORT=3000 mygensite
```

## API

### mygensite(options)

Creates a new tunnel to the specified local `port`. Returns a Promise that resolves once you have been assigned a public URL.

```js
const mygensite = require('mygensite');

(async () => {
  const tunnel = await mygensite({
    port: 3000,
    subdomain: 'my-app',
    auth_method: 'password',
    password: 'secret',
    owner_email: 'alice@company.com',
    ttl: 3600,
  });

  console.log(tunnel.url);           // https://my-app.mygen.site
  console.log(tunnel.password);      // "secret"
  console.log(tunnel.admin_token);   // "tok_xxx"
  console.log(tunnel.access);        // "public"
  console.log(tunnel.expires_at);    // "2025-06-01T13:00:00Z"

  tunnel.on('close', () => {
    // tunnel closed
  });
})();
```

#### Options

##### localtunnel compatible

- `port` (number) [required] The local port number to expose.
- `subdomain` (string) Request a specific subdomain on the proxy server.
- `host` (string) URL for the upstream proxy server. Defaults to `https://mygen.site`.
- `local_host` (string) Proxy to this hostname instead of `localhost`. This will also cause the `Host` header to be re-written to this value in proxied requests.
- `local_https` (boolean) Enable tunneling to local HTTPS server.
- `local_cert` (string) Path to certificate PEM file for local HTTPS server.
- `local_key` (string) Path to certificate key file for local HTTPS server.
- `local_ca` (string) Path to certificate authority file for self-signed certificates.
- `allow_invalid_cert` (boolean) Disable certificate checks for your local HTTPS server.

##### mygensite extensions

- `access` (string) Network access: `public`, `ip`. Default: `public`.
- `auth_method` (string) Auth methods CSV: `password`, `google`, `telegram`. Default: none.
- `password` (string) Password (when auth_method includes 'password'). Auto-generated if omitted.
- `allowed_ips` (string[]) IP whitelist for `ip` access. Supports CIDR notation.
- `google` (string|string[]) Allowed Google email(s) or domain patterns like `@company.com` (when auth_method includes 'google').
- `telegram` (string|string[]) Allowed Telegram user ID(s) (when auth_method includes 'telegram').
- `owner_email` (string) Owner email for dashboard management.
- `ttl` (number) Tunnel TTL in seconds (60-86400). Default: 3600.

### Tunnel instance

#### Properties

| property | description |
| --- | --- |
| `url` | The public URL for the tunnel |
| `password` | The password (if access control is set) |
| `admin_token` | Token for runtime management via API |
| `access` | Access control settings object |
| `expires_at` | ISO timestamp when the tunnel expires |

#### Events

| event | args | description |
| --- | --- | --- |
| request | info | fires when a request is processed, contains `method` and `path` |
| error | err | fires when an error happens on the tunnel |
| close | | fires when the tunnel has closed |
| reconnecting | | connection lost — the client is re-registering with the server |
| reconnect | url | tunnel re-established after a disconnect |

#### Auto-reconnect

Since v2.6.0 the tunnel behaves like an auto-reconnecting ssh tunnel: if the
connection drops (network blip, server restart, listener expiry), the client
re-registers through the API using its stored `admin_token` and re-opens the
socket pool — with exponential backoff (1s → 15s). Just keep the process
running; no manual handling required.

#### Methods

| method | args | description |
| --- | --- | --- |
| `close()` | | Close the tunnel |
| `updateAccess(access)` | `object` | Update access settings at runtime. Returns a Promise. |
| `extendTTL(ttl)` | seconds (number) | Extend the tunnel TTL. Returns a Promise. |

### Runtime management

```js
// Switch to public access (remove auth)
await tunnel.updateAccess({ auth_method: '' });

// Add password protection
await tunnel.updateAccess({ auth_method: 'password', password: 'newpass' });

// Add Google OAuth
await tunnel.updateAccess({ auth_method: 'password,google', google: 'alice@co.com' });

// Restrict by IP
await tunnel.updateAccess({ access: 'ip', allowed_ips: ['1.2.3.0/24'] });

// Extend TTL by 1 hour
await tunnel.extendTTL(3600);
```

## Constraints

### Slug (subdomain)

- 4–63 characters, lowercase letters (`a-z`), numbers (`0-9`), and hyphens (`-`) only
- Must start and end with a letter or number (not a hyphen)
- Reserved words cannot be used: `www`, `api`, `dashboard`, `admin`, `mail`, `ftp`, `static`, `docs`, `status`, `health`, `internal`, `tunnel`, `app`, `web`
- A slug used as a tunnel cannot be reused for static deployment (and vice versa). Delete the existing service first.

```
OK:  my-app, demo-v2, test-123
BAD: My-App, -dash, ab, a_b, my--app..com
```

### File Paths (static deploy)

- Allowed characters per segment: letters, numbers, hyphens (`-`), underscores (`_`), dots (`.`), spaces
- Forward slashes (`/`) for directory nesting
- Max total path length: 1024 characters. Max segment length: 255 characters.
- Path traversal (`..`, `.`) is rejected
- Hidden files (names starting with `.`) are rejected (e.g. `.env`, `.git`)
- No leading spaces, backslashes, or control characters
- Total upload size limit: **50 MB** per deployment

```
OK:  index.html, assets/style.css, img/logo 2.png, deep/nested/file.js
BAD: ../secret.txt, .env, file\name.html
```

### Static File Serving Behavior

- `/` serves `index.html`
- `/about/` serves `about/index.html`
- `/about` (no trailing slash) tries the literal file first, then falls back to `about/index.html`
- Content-Type is determined by file extension (e.g. `.css` → `text/css`, `.js` → `application/javascript`)
- Responses include `Cache-Control: public, max-age=60`

### TTL

- Minimum: 60 seconds (1 minute)
- Maximum: 86,400 seconds (24 hours)
- Default: 3,600 seconds (1 hour)
- Extending TTL resets the timer (created_at becomes now)

### Client-Side Validation

The library validates inputs before making API calls, throwing an error immediately if values are invalid:

```js
// Throws at construction time — no API call made
const tunnel = await mygensite({ port: 3000, subdomain: 'INVALID' });
// Error: Slug must be lowercase alphanumeric and hyphens...

// Use validators directly for custom checks
const { validate } = require('mygensite');

validate.validateSlug('my-app');         // { valid: true }
validate.validateSlug('AB');             // { valid: false, error: 'Slug must be 4-63 characters' }
validate.validateFilePath('assets/x.js');// { valid: true, cleaned: 'assets/x.js' }
validate.validateFilePath('../etc');     // { valid: false, error: 'Path traversal...' }
validate.validateTTL(30);               // { valid: false, error: 'TTL must be...' }
validate.validateAccessMode('public');   // { valid: true }
```

## Error Codes

### Tunnel creation errors

| status | error | description | fix |
| --- | --- | --- | --- |
| 400 | `invalid_slug` | Slug must be 4-63 chars, lowercase alphanumeric and hyphens | Use a valid slug format, e.g. `my-app-1` |
| 400 | `reserved_slug` | This slug is reserved and cannot be used | Choose a different slug. Reserved: www, api, dashboard, admin, etc. |
| 400 | `invalid_ttl` | TTL must be between 60 and 86400 seconds | Use a value between 60 (1 min) and 86400 (24 hours) |
| 400 | `invalid_access` | Access must be: public, ip | Use one of the valid access modes |
| 409 | `slug_in_use` | This slug is already in use | Use a different slug, or omit `subdomain` for a random one |
| 503 | — | Server is temporarily unavailable | Retry after a few seconds |

### Runtime management errors (updateAccess, extendTTL)

| status | error | description | fix |
| --- | --- | --- | --- |
| 401 | `unauthorized` | Invalid or missing admin_token | Use the `admin_token` returned from tunnel creation |
| 404 | `not_found` | Service not found | Check that the slug is correct and the tunnel is still active |
| 400 | `invalid_access` | Access must be: public, ip | Use one of the valid access modes |
| 400 | `invalid_ttl` | TTL out of range | Use a value between 60 and 86400 |

### Gateway errors (when accessing the tunnel URL)

| status | description | fix |
| --- | --- | --- |
| 404 | Service not found | Check that the slug exists and has not been deleted |
| 410 | Service has expired | Call `extendTTL()` or create a new tunnel |
| 403 | IP not allowed | Add your IP to `allowed_ips`, or switch access mode to `public` |
| 401 | Incorrect password | Retry with the correct password |
| 502 | Service is offline (tunnel disconnected) | Restart the tunnel client |
| 504 | Service timed out | Check that your local server is running and responsive |

## Deploy (static site hosting)

Deploy static files (HTML/CSS/JS) to `{slug}.mygen.site` — no tunnel required.

### mygensite.deploy(options)

Uploads files to the server and returns a site object with management methods. Returns a Promise.

```js
const mygensite = require('mygensite');

const site = await mygensite.deploy({
  directory: './dist',
  subdomain: 'demo',
  owner_email: 'alice@company.com',
  access: 'public',
  ttl: 86400,
});

console.log(site.url);           // https://demo.mygen.site
console.log(site.admin_token);   // "tok_yyy"
console.log(site.slug);          // "demo"
console.log(site.expires_at);    // "2025-06-02T12:00:00Z"
```

#### Options

| option | type | required | default | description |
| --- | --- | --- | --- | --- |
| `directory` | string | * | — | Local directory to upload. All files are uploaded recursively. |
| `files` | Array | * | — | Alternative to `directory`. Array of `{ name, content, contentType? }` objects. |
| `subdomain` | string | | random | Request a specific subdomain. |
| `host` | string | | `https://mygen.site` | Server URL. |
| `access` | string | | `public` | Network access: `public`, `ip`. |
| `auth_method` | string | | — | Auth methods CSV: `password`, `google`, `telegram`. |
| `password` | string | | auto | Password (when auth_method includes 'password'). |
| `google` | string\|string[] | | — | Allowed Google email(s) or `@domain.com` patterns (when auth_method includes 'google'). |
| `telegram` | string\|string[] | | — | Allowed Telegram user ID(s) (when auth_method includes 'telegram'). |
| `allowed_ips` | string[] | | — | IP whitelist for `ip` access. CIDR supported. |
| `owner_email` | string | | — | Owner email for dashboard management. |
| `ttl` | number | | 3600 | Site TTL in seconds (60-86400). |
| `admin_token` | string | | — | Provide for redeployment to an existing slug. |
| `mime_types` | object \| function | | — | Content-Type overrides. Map keys: exact relative path (`'data/blob'`) or extension (`'.glb'` / `'glb'`); exact path wins. Or a function `(name, defaultType) => string \| undefined`. |

\* Either `directory` or `files` is required.

> **Directory uploads** skip hidden files and directories (`.git`, `.DS_Store`, `.gitignore`, ...) automatically.
> Content-Type is guessed from each file's extension; unknown extensions become `application/octet-stream` — use
> `mime_types` (or the repeatable CLI flag `--mime .glb=model/gltf-binary`) to override. The server serves each
> file with exactly the base type sent at upload: it does not re-guess from the extension, and parameters like
> `charset` are stripped — declare encoding with `<meta charset="utf-8">` inside the HTML.

#### Deploy with inline files

```js
const site = await mygensite.deploy({
  subdomain: 'hello',
  access: 'public',
  files: [
    { name: 'index.html', content: '<h1>Hello World</h1>' },
    { name: 'assets/style.css', content: 'body { font-family: sans-serif; }' },
  ],
});
```

#### Deploy with curl

Multipart `filename` strips directory paths (e.g. `assets/style.css` becomes `style.css`). Use the `filepaths` JSON field to preserve directory structure:

```bash
# Flat files (no subdirectories) — filepaths not needed
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F access=public \
  -F files=@index.html -F files=@style.css

# With subdirectories — filepaths required
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F access=public \
  -F 'filepaths=["index.html","assets/style.css","assets/js/app.js"]' \
  -F files=@index.html \
  -F files=@assets/style.css \
  -F files=@assets/js/app.js
```

The `filepaths` field is a JSON array where each element corresponds to the `files` field in order. The server uses these paths instead of the multipart filename.

### Site instance

The returned object contains the deployment result plus convenience methods:

#### Properties

| property | description |
| --- | --- |
| `url` | The public URL (`https://{slug}.mygen.site`) |
| `slug` | The assigned subdomain |
| `admin_token` | Token for management API calls |
| `password` | Password (if access control uses password) |
| `expires_at` | ISO timestamp when the site expires |

#### Methods

| method | args | description |
| --- | --- | --- |
| `updateAccess(access)` | `object` | Update access settings. Returns a Promise. |
| `extendTTL(ttl)` | seconds (number) | Extend the site TTL. Returns a Promise. |
| `redeploy(directory)` | directory path (string) | Upload new files, replacing all existing files. Returns a Promise. |
| `delete(purge?)` | purge (boolean) | Delete the site. `false` = soft delete (files kept), `true` = purge S3 files. Returns a Promise. |

### mygensite.manage(options)

Create a management handle for an existing service when you already have the `slug` and `admin_token` (e.g. saved from a previous deploy). **Do not redeploy just to get a management object** — use this instead.

```js
const mygensite = require('mygensite');

const site = mygensite.manage({
  slug: 'demo',
  admin_token: 'tok_xxx',       // from the original deploy/tunnel response
  host: 'https://mygen.site',   // optional
});

// Same methods as deploy result
await site.updateAccess({ access: 'public' });
await site.extendTTL(86400);
await site.redeploy('./dist-v2');
await site.delete();
```

#### Options

| option | type | required | default | description |
| --- | --- | --- | --- | --- |
| `slug` | string | yes | — | The service slug |
| `admin_token` | string | yes | — | The admin token from the original deploy/tunnel response |
| `host` | string | | `https://mygen.site` | Server URL |

### Deploy management examples

```js
// Redeploy with updated files
await site.redeploy('./dist-v2');

// Add password protection after deployment
await site.updateAccess({ auth_method: 'password', password: 'secret' });

// Extend TTL by 24 hours
await site.extendTTL(86400);

// Soft delete (slug can be reused, S3 files kept)
await site.delete();

// Purge delete (S3 files removed, unrecoverable)
await site.delete(true);
```

### Deploy error codes

| status | error | description | fix |
| --- | --- | --- | --- |
| 400 | `no_files` | At least one file is required | Provide `directory` or `files` option |
| 400 | `invalid_slug` | Invalid slug format | Use 4-63 chars, lowercase alphanumeric and hyphens |
| 400 | `reserved_slug` | Slug is reserved | Choose a different slug |
| 409 | `slug_in_use` | Slug taken by another owner | Use a different slug |
| 409 | `type_conflict` | Slug is in use as a tunnel | Use a different slug for static deployment |
| 413 | `file_too_large` | Total upload exceeds 50MB | Reduce file sizes or split into multiple deployments |

## Documentation

- [API docs](https://mygen.site/docs) — full endpoint reference
- [LLM-readable docs](https://mygen.site/llms.txt)

## Compatibility

mygensite is fully compatible with any localtunnel server. Extension options are sent as query parameters and silently ignored by servers that don't support them.

## License

MIT
