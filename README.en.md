# mygensite

Expose your localhost to the world via [mygen.site](https://mygen.site) with access control.

A fork of [localtunnel](https://github.com/localtunnel/localtunnel) with extended features: password protection, IP whitelisting, TTL, owner management, and admin tokens.

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
- `--access` access control mode: `public`, `password`, `ip_only`, `both` (default: `both`)
- `--password` password for access control (auto-generated if omitted)
- `--owner-email` owner email for dashboard management
- `--ttl` tunnel TTL in seconds, 60-86400 (default: 3600)

```
mygensite --port 3000 --subdomain my-app --access password --password secret --ttl 7200
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
    access: 'password',
    password: 'secret',
    owner_email: 'alice@company.com',
    ttl: 3600,
  });

  console.log(tunnel.url);           // https://my-app.mygen.site
  console.log(tunnel.password);      // "secret"
  console.log(tunnel.admin_token);   // "tok_xxx"
  console.log(tunnel.access);        // { mode: "password", ... }
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

- `access` (string) Access control mode: `public`, `password`, `ip_only`, `both`. Default: `both`.
- `password` (string) Password for access control. Auto-generated if omitted.
- `allowed_ips` (string[]) IP whitelist for `ip_only` or `both` mode. Supports CIDR notation.
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

#### Methods

| method | args | description |
| --- | --- | --- |
| `close()` | | Close the tunnel |
| `updateAccess(access)` | `{ mode, password, allowed_ips }` | Update access control at runtime. Returns a Promise. |
| `extendTTL(ttl)` | seconds (number) | Extend the tunnel TTL. Returns a Promise. |

### Runtime management

```js
// Switch to public access
await tunnel.updateAccess({ mode: 'public' });

// Add password protection
await tunnel.updateAccess({ mode: 'password', password: 'newpass' });

// Restrict by IP
await tunnel.updateAccess({ mode: 'ip_only', allowed_ips: ['1.2.3.0/24'] });

// Extend TTL by 1 hour
await tunnel.extendTTL(3600);
```

## Error Codes

### Tunnel creation errors

| status | error | description | fix |
| --- | --- | --- | --- |
| 400 | `invalid_slug` | Slug must be 3-63 chars, lowercase alphanumeric and hyphens | Use a valid slug format, e.g. `my-app-1` |
| 400 | `reserved_slug` | This slug is reserved and cannot be used | Choose a different slug. Reserved: www, api, dashboard, admin, etc. |
| 400 | `invalid_ttl` | TTL must be between 60 and 86400 seconds | Use a value between 60 (1 min) and 86400 (24 hours) |
| 400 | `invalid_access` | Access mode must be: public, password, ip_only, both | Use one of the four valid modes |
| 409 | `slug_in_use` | This slug is already in use | Use a different slug, or omit `subdomain` for a random one |
| 503 | — | Server is temporarily unavailable | Retry after a few seconds |

### Runtime management errors (updateAccess, extendTTL)

| status | error | description | fix |
| --- | --- | --- | --- |
| 401 | `unauthorized` | Invalid or missing admin_token | Use the `admin_token` returned from tunnel creation |
| 404 | `not_found` | Service not found | Check that the slug is correct and the tunnel is still active |
| 400 | `invalid_access` | Invalid access mode | Use one of: public, password, ip_only, both |
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

## Compatibility

mygensite is fully compatible with any localtunnel server. Extension options are sent as query parameters and silently ignored by servers that don't support them.

## License

MIT
