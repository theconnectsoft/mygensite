# 2.7.0 (2026-07-06) — mygensite

### Deploy: directory uploads
- **Hidden files no longer break the deploy**: `deploy({ directory })` now skips
  hidden files and directories (`.git`, `.DS_Store`, `.gitignore`, ...) instead of
  aborting the whole upload with a validation error.
- **Windows**: relative paths are normalized to forward slashes
  (`path.sep` aware), so nested directories deploy correctly on Windows.
- **Symlinks**: file symlinks are followed; directory symlinks and broken
  symlinks are skipped (cycle safety).

### Deploy: Content-Type
- New `mime_types` option (and CLI `--mime key=type`, repeatable) to override
  the Content-Type per extension (`'.glb'` / `'glb'`) or exact relative path
  (`'data/blob'`; path wins over extension). A function form
  `(name, defaultType) => string | undefined` is also accepted.
  Precedence: explicit `files[].contentType` > `mime_types` > extension guess.
- Extension MIME map extended: avif, bmp, mp4, webm, mov, mp3, wav, m4a, ogg,
  wasm, cjs, md, csv, yaml/yml, gz, eot.

### Notes
- The server serves each file with exactly the base type sent at upload — it
  does not re-guess from the extension, and parameters like `charset` are
  stripped. Declare encoding inside the HTML (`<meta charset="utf-8">`).

---

# 2.6.0 (2026-07-02) — mygensite

### Reliability
- **Auto-reconnect (ssh-tunnel-like)**: when the remote TCP listener disappears
  (server restart, grace timeout, expiry), the client re-registers through the
  API using its stored `admin_token` and re-opens the socket pool on the fresh
  port. Exponential backoff 1s → 15s, reset once a socket connects.
- Reconnect responses no longer clobber `tunnel.admin_token` / `tunnel.password`
  with `null`.
- A second refused socket can no longer crash the process via an unhandled
  `'error'` event.

### Events
- `tunnel.on('reconnecting')` — connection lost, re-registration scheduled
- `tunnel.on('reconnect', url)` — tunnel re-established
- CLI logs both events.

---

# 2.5.0 (2026-04-17) — mygensite

### Breaking
- Minimum slug length increased from 3 to 4 characters (matches server update)
- `mcp` added to reserved slugs (reserved for mcp.mygen.site endpoint)

### Validation
- `validateSlug()` rejects slugs shorter than 4 chars with message "Slug must be 4-63 characters"
- `SLUG_REGEX` updated: `^[a-z0-9][a-z0-9-]{2,61}[a-z0-9]$`

### Documentation
- README.md, README.en.md, README.ko.md updated to reflect 4-63 char rule

---

# 2.3.0 (2026-03-13) — mygensite

### Rules (new)
- **deployment-awareness**: Recognizes active mygen.site deployments and suggests redeploy after file changes
- **safe-defaults**: Defaults to password protection unless user explicitly requests public access
- **tunnel-keepalive**: Enforces proper keepalive patterns in tunnel scripts (setInterval, signal handlers, event listeners)

### Hooks (new)
- **git-guard** (PreToolUse): Blocks staging of `.claude/mygen*` files containing admin tokens
- **tunnel-cleanup** (PostToolUse): Automatically removes stale tunnel PID/log/script files for dead processes
- **tunnel-reminder** (Stop): Notifies about running tunnels when the session ends

### Multi-tunnel support
- PID, log, and script files are now slug-based: `mygen-tunnel-{slug}.pid`, `mygen-tunnel-{slug}.mjs`, etc.
- Multiple tunnels can run simultaneously without file conflicts
- Added "Check all tunnels" and "Stop all tunnels" commands in SKILL.md

---

# 2.1.0 (2026-03-12) — mygensite

### Features
- `owner_email` now accepts Telegram usernames in addition to email addresses
- Dashboard login supports both Google OAuth and Telegram
- Ownership matching is case-insensitive (works for both email and Telegram username)

### Documentation
- Updated all docs (llms.txt, share-skill, docs page, README) to reflect Telegram owner support
- Skill files updated: "Owner Email" → "Owner Identity" with Telegram username examples

---

# 2.0.0 (2026-03-12) — mygensite

**BREAKING**: Replace old 4-mode access model with 2-layer access control.

### Layer 1 — Network (`access`)
- `public` — anyone can reach (default)
- `ip` — only `allowed_ips` can reach

### Layer 2 — Auth (`auth_method`)
- `password` — password form + cookie session
- `google` — Google OAuth (allowed emails)
- `telegram` — Telegram login (allowed user IDs)
- CSV combinations: `password,google`

### Changes
- `access` option: `public` | `ip` (was: `public` | `password` | `ip_only` | `both`)
- New `auth_method` option: CSV of `password`, `google`, `telegram`
- New `google` option: allowed email(s) for Google OAuth
- New `telegram` option: allowed Telegram user ID(s)
- CLI: `--auth-method`, `--google`, `--telegram` flags
- Client-side strict validation: mismatched params rejected before API call
- `updateAccess()` now accepts full body object (not just `{ mode }`)
- `deploy()` sends individual fields instead of JSON `access` object

### Migration from 1.x
```js
// Before (1.x)
mygensite({ port: 3000, access: 'password', password: 'secret' })
mygensite({ port: 3000, access: 'ip_only', allowed_ips: ['1.2.3.0/24'] })
mygensite({ port: 3000, access: 'both', password: 'secret', allowed_ips: ['1.2.3.0/24'] })

// After (2.x)
mygensite({ port: 3000, auth_method: 'password', password: 'secret' })
mygensite({ port: 3000, access: 'ip', allowed_ips: ['1.2.3.0/24'] })
mygensite({ port: 3000, access: 'ip', allowed_ips: ['1.2.3.0/24'], auth_method: 'password', password: 'secret' })
```

---

# Upstream localtunnel changelog (pre-fork)

# 2.0.2 (2021-09-18)

- Upgrade dependencies

# 2.0.1 (2021-01-09)

- Upgrade dependencies

# 2.0.0 (2019-09-16)

- Add support for tunneling a local HTTPS server
- Add support for localtunnel server with IP-based tunnel URLs
- Node.js client API is now Promise-based, with backwards compatibility to callback
- Major refactor of entire codebase using modern ES syntax (requires Node.js v8.3.0 or above)

# 1.9.2 (2019-06-01)

- Update debug to 4.1.1
- Update axios to 0.19.0

# 1.9.1 (2018-09-08)

- Update debug to 2.6.9

# 1.9.0 (2018-04-03)

- Add _request_ event to Tunnel emitter
- Update yargs to support config via environment variables
- Add basic request logging when --print-requests argument is used

# 1.8.3 (2017-06-11)

- update request dependency
- update debug dependency
- update openurl dependency

# 1.8.2 (2016-11-17)

- fix host header transform
- update request dependency

# 1.8.1 (2016-01-20)

- fix bug w/ HostHeaderTransformer and binary data

# 1.8.0 (2015-11-04)

- pass socket errors up to top level

# 1.7.0 (2015-07-22)

- add short arg options

# 1.6.0 (2015-05-15)

- keep sockets alive after connecting
- add --open param to CLI

# 1.5.0 (2014-10-25)

- capture all errors on remote socket and restart the tunnel

# 1.4.0 (2014-08-31)

- don't emit errors for ETIMEDOUT

# 1.2.0 / 2014-04-28

- return `client` from `localtunnel` API instantiation

# 1.1.0 / 2014-02-24

- add a host header transform to change the 'Host' header in requests

# 1.0.0 / 2014-02-14

- default to localltunnel.me for host
- remove exported `connect` method (just export one function that does the same thing)
- change localtunnel signature to (port, opt, fn)

# 0.2.2 / 2014-01-09
