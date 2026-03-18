---
name: share
description: Share what the user built with others. Triggers on "share this", "deploy this", "make this accessible", "show my team", "create a URL", "change password", "make it public", "extend TTL", "공유해줘", "배포해줘", "외부에서 접속하게 해줘", "URL 만들어줘", "비밀번호 바꿔줘", "공개로 바꿔줘", "TTL 연장해줘", "팀한테 보여주고 싶어".
argument-hint: "[public or password]"
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Agent
---

# Share (mygen.site)

Share what the user built via a `{name}.mygen.site` URL.
Tunnel/deploy creation uses the **mygensite** Node.js library. Settings changes and deletion can use curl.

## Owner Identity

`--owner-email` links the service to a dashboard account for web-based management.
The user can also skip this — management via `admin_token` (PATCH, DELETE, redeploy) always works.

The value can be either:
- **Email address** (for Google login users): `alice@company.com`
- **Telegram username** (for Telegram login users): `thetelegramuser`

Ownership matching is case-insensitive.

### First use
1. Check if `.claude/mygen.json` exists
2. If not, **you MUST ask the user**: "Email or Telegram username for dashboard management? (Enter to skip)"
3. **Do NOT validate the format as email-only.** The value can be a plain username without `@` — that's a valid Telegram username. Accept any non-empty string the user provides.
4. If the user provides a value, save it to `.claude/mygen.json`:
```json
{ "owner_email": "user@company.com" }
```
or for Telegram users (no `@`, not an email — this is valid):
```json
{ "owner_email": "mytelegramuser" }
```
5. If the user skips (empty), save without owner_email:
```json
{}
```

### Subsequent uses
- Read owner from `.claude/mygen.json` automatically
- If the user says "change my email" or "change my owner", update the file

## API Token (optional)

If the `MYGENSITE_TOKEN` env variable is set, or `token` option is passed, the mygensite client automatically uses it for authentication. This allows service creation from any IP address.

The token can be generated from the dashboard: https://mygen.site/dashboard/api

Usage:
```bash
# Environment variable (recommended — auto-detected)
export MYGENSITE_TOKEN=mgs_xxx

# Or pass directly in code
const tunnel = await mygensite({ port: 3000, token: 'mgs_xxx' });
const site = await mygensite.deploy({ directory: './dist', token: 'mgs_xxx' });

# Or CLI flag
mygensite --port 3000 --token mgs_xxx
```

When a token is used, `owner_email` is automatically set to the token owner's email. The `.claude/mygen.json` `owner_email` is still used for display purposes but won't override the token-based owner.

## Slug (Domain) Management

### Reuse by default
- When `.claude/mygen.json` already has a service entry for the **same context** (same port for tunnels, same build directory for static), reuse that slug and `admin_token`.
- This means running `/share` repeatedly for the same service always keeps the same URL.

### New service — always ask for subdomain
When there is **no matching service** in `.claude/mygen.json` for the current context, you MUST ask for a subdomain. This happens when:
- First time running `/share` in a project (no `.claude/mygen.json` or empty services)
- Sharing a **different port** than any existing tunnel entry
- Sharing a **different build directory** than any existing static entry
- User explicitly asks for a "new URL", "different domain", "새 도메인" etc.

Ask:
> **Subdomain?** (Enter for random: `auto-generated.mygen.site`)
> e.g. `my-api` → `my-api.mygen.site`

- Default (Enter/blank) → server auto-generates a random slug
- If the user specifies a slug and it's **already taken** (409 error), inform them and ask again:
  > `my-api.mygen.site` is already taken. Choose another subdomain? (Enter for random)

### Domain cannot be changed after creation
The subdomain (slug) is permanent once created. To use a different domain, create a new service and delete the old one. Inform the user on first use: **"The subdomain can't be changed later — choose carefully, or press Enter for a random one."**

## Decision: Tunnel vs Static Deploy

Decide **automatically** based on the criteria below. Do not ask the user.

### Choose static deploy when
- Project has only HTML/CSS/JS files (build output)
- Build output directories exist: `dist/`, `build/`, `out/`, `public/`, `.next/`
- No server process needed
- SPA build output (React, Vue, Svelte, etc.)
- Simple HTML files to share

### Choose tunnel when
- A local server is running or can be started
- Uses a server framework (Express, FastAPI, Django, Rails, etc.)
- Needs dynamic features: API server, WebSocket, SSR
- Runs via `npm run dev`, `python manage.py runserver`, etc.
- Requires database connections

## Execution Steps

### 0. Prerequisites

Check if mygensite is installed:
```bash
npx mygensite --help 2>/dev/null || npm install -g mygensite
```

Load config from `.claude/mygen.json`. If missing, ask the user for owner identity.

### 1. Analyze the project

Quickly assess the project structure:
- Check package.json, requirements.txt, etc.
- Check for build output directories
- Check for server start scripts
- Check for running local servers (lsof -i -P | grep LISTEN)
- Check `.claude/mygen.json` for existing services matching current context

### 1.5. Access Control Setup (first deploy only)

**Skip this step** if reusing an existing service from `.claude/mygen.json` (same port/directory context). Settings are already saved.

On the **first deploy** of a new service, ask the user these questions:

#### Q1. Network access
> **Who should be able to access this?**
> 1. **Public** — anyone with the link
> 2. **IP-restricted** — only your current IP (recommended)

If IP-restricted, detect the user's public IP:
```bash
curl -s https://ifconfig.me
```

#### Q2. Authentication
> **Password protection is enabled by default.** Choose an authentication method:
> 1. **Password** — visitors enter a password to access (default)
> 2. **Google OAuth** — only specific Google accounts can access
> 3. **Telegram** — only specific Telegram users can access
> 4. **None** — no authentication (not recommended)

If the user picks auth, ask for the details:
- **Password**: "What password should visitors use?" (or auto-generate one)
- **Google**: "Which email addresses should have access? (comma-separated, use @domain.com to allow an entire domain)"
- **Telegram**: "Which Telegram user IDs should have access? (comma-separated)"

Multiple auth methods can be combined (e.g. password + Google — visitors can use either).

#### Applying the choices

Use the answers to set these parameters in the deploy/tunnel script:
```js
access: 'ip',                // 'ip' (recommended) or 'public'
allowed_ips: ['1.2.3.4'],    // user's detected IP (auto-detect via curl ifconfig.me)
auth_method: 'password',     // or 'google', 'telegram', 'password,google', or omit
password: 'chosen-password',  // when auth_method includes 'password'
google: 'alice@co.com,@co.com', // when auth_method includes 'google' (supports @domain.com)
telegram: '123456789',       // when auth_method includes 'telegram'
```

Save the chosen access settings in `.claude/mygen.json` alongside the service entry so they can be reused on redeploy.

> **Tip**: If `$ARGUMENTS` explicitly says "public" or "password", skip the questions and use that directly.

### 2-A. Static deploy

Build first if needed:
```bash
npm run build  # or framework-appropriate command
```

Write a temporary deploy script `.claude/mygen-deploy.mjs` and run it:

```js
import localtunnel from 'mygensite';

const site = await localtunnel.deploy({
  directory: './dist',              // auto-detect: dist, build, out, .next, or '.'
  subdomain: '{slug_or_undefined}', // from mygen.json or omit for auto
  owner_email: '{owner_email}',
  access: '{access}',              // from access control setup
  auth_method: '{auth_method}',    // from access control setup, omit if none
  password: '{password}',          // when auth_method includes 'password'
  google: '{emails}',              // when auth_method includes 'google'
  telegram: '{ids}',               // when auth_method includes 'telegram'
  ttl: 86400,
  admin_token: '{token_or_undefined}', // if redeploying existing service
});

console.log(JSON.stringify({
  url: site.url, slug: site.slug,
  admin_token: site.admin_token,
  password: site.password || null,
  expires_at: site.expires_at || null,
}));
```

```bash
node .claude/mygen-deploy.mjs
```

Parse the JSON output, update `.claude/mygen.json`.

### 2-B. Tunnel

Check if a local server is running; if not, start it:
```bash
lsof -i -P | grep LISTEN | grep -E ':(3000|5173|8000|8080|4200|5000)'
```

If no server is running, start it in background first.

Write a tunnel keeper script `.claude/mygen-tunnel-{slug}.mjs` (slug-based filename for multi-tunnel support):

```js
import localtunnel from 'mygensite';

const tunnel = await localtunnel({
  port: {detected_port},
  subdomain: '{slug_or_undefined}',
  owner_email: '{owner_email}',
  access: '{access}',
  auth_method: '{auth_method}',    // from access control setup, omit if none
  password: '{password}',          // when auth_method includes 'password'
  google: '{emails}',              // when auth_method includes 'google'
  telegram: '{ids}',               // when auth_method includes 'telegram'
  ttl: 3600,
  admin_token: '{token_or_undefined}',
});

// Output connection info as JSON (first line)
console.log(JSON.stringify({
  url: tunnel.url, slug: tunnel.clientId,
  admin_token: tunnel.admin_token,
  password: tunnel.password || null,
  expires_at: tunnel.expires_at || null,
}));

// Keep alive — graceful shutdown on signals
process.on('SIGINT', () => { tunnel.close(); process.exit(0); });
process.on('SIGTERM', () => { tunnel.close(); process.exit(0); });
tunnel.on('close', () => { console.error('Tunnel closed'); process.exit(1); });
tunnel.on('error', (err) => { console.error('Tunnel error:', err.message); });

// Heartbeat every 5 min
setInterval(() => {
  console.error(`[tunnel] alive — ${tunnel.url}`);
}, 5 * 60 * 1000);
```

Run in background and capture output (use the slug in all filenames):
```bash
node .claude/mygen-tunnel-{slug}.mjs > .claude/mygen-tunnel-{slug}-out.log 2>.claude/mygen-tunnel-{slug}-err.log &
TUNNEL_PID=$!
echo $TUNNEL_PID > .claude/mygen-tunnel-{slug}.pid

# Wait for tunnel to initialize
for i in $(seq 1 10); do
  if [ -s .claude/mygen-tunnel-{slug}-out.log ]; then break; fi
  sleep 1
done
cat .claude/mygen-tunnel-{slug}-out.log
```

- **CRITICAL**: The tunnel keeper script stays running in background. Do NOT delete it while active.
- PID is saved to `.claude/mygen-tunnel-{slug}.pid` for later management (slug-based, supports multiple tunnels).
- The script handles SIGINT/SIGTERM gracefully and logs heartbeats to stderr.

### 3. Save results and inform the user

**Always** save the result (slug, admin_token, access settings) to `.claude/mygen.json`:
```json
{
  "owner_email": "user@company.com",
  "services": {
    "{slug}": {
      "admin_token": "tok_xxx",
      "type": "tunnel",
      "port": 3000,
      "url": "https://{slug}.mygen.site",
      "access": "ip",
      "allowed_ips": ["1.2.3.4"],
      "auth_method": "password",
      "created_at": "2025-06-01T12:00:00Z"
    }
  }
}
```

After deploy/tunnel completes, inform the user **concisely** based on settings:

**Public, no auth:**
```
URL: https://{slug}.mygen.site

Share this link — anyone can access it.
Auto-expires in 24 hours.
You can change access settings anytime — just ask.
```

**With password auth:**
```
URL: https://{slug}.mygen.site
Password: {password}

Share the link and password together.
```

**With Google auth:**
```
URL: https://{slug}.mygen.site
Allowed: {emails}

Only the listed Google accounts can access (via OAuth login).
```

**With IP restriction:**
```
URL: https://{slug}.mygen.site
Restricted to: {ip}

Only accessible from the allowed IP address.
```

If tunnel:
```
Tunnel running in background (PID: {pid}).
It stays open as long as the process is alive.
```

## Settings Changes (PATCH)

When the user wants to change settings on an already-shared service:
- "change password", "make it public", "restrict by IP", "extend time", etc.

**Never redeploy.** Change settings via PATCH on the existing service.

### Method 1: Node.js (recommended)

Read slug and admin_token from `.claude/mygen.json`, create a management handle with `manage()`:

```js
const mygensite = require('mygensite');
const site = mygensite.manage({
  slug: '{slug}',
  admin_token: '{admin_token}',  // read from .claude/mygen.json
});

await site.updateAccess({ access: 'public', auth_method: '' });
await site.updateAccess({ auth_method: 'password', password: 'new-password' });
await site.updateAccess({ auth_method: 'password,google', password: 'pw', google: 'a@co.com' });
await site.extendTTL(86400);
await site.redeploy('./dist');  // only when files changed
await site.delete();
```

> **Important:** Do not redeploy just to change settings. Use `manage()`.

### Method 2: curl

Read the admin_token for the service from `.claude/mygen.json`:

```bash
# Make fully public (no auth)
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"access": "public", "auth_method": ""}'

# Add password auth
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"auth_method": "password", "password": "new-password"}'

# Add Google OAuth + password
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"auth_method": "password,google", "password": "pw", "google": "alice@co.com"}'

# Restrict by IP
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"access": "ip", "allowed_ips": "1.2.3.0/24"}'

# Extend TTL (timer resets from now)
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 86400}'
```

### PATCH vs Redeploy

| Request | Method |
|---------|--------|
| Change password | PATCH `auth_method` + `password` |
| Make it public | PATCH `access` + `auth_method: ""` |
| Add Google auth | PATCH `auth_method` + `google` |
| Restrict by IP | PATCH `access: "ip"` + `allowed_ips` |
| Extend time | PATCH `ttl` |
| Change owner | PATCH `owner_email` (email or Telegram username) |
| Update content (files changed) | Redeploy (`deploy --admin-token`) |
| Upload new files | Redeploy (`deploy --admin-token`) |

**If files haven't changed, use PATCH. Redeploying for settings changes is wasteful.**

When redeployment is needed, always use the existing admin_token:
```bash
npx mygensite deploy \
  --directory ./dist \
  --subdomain {existing slug} \
  --admin-token {existing admin_token}
```

## Delete Service

```bash
# Soft delete (recoverable)
curl -X DELETE https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}"

# Full delete (files removed, unrecoverable)
curl -X DELETE "https://mygen.site/api/services/{slug}?purge=true" \
  -H "Authorization: Bearer {admin_token}"
```

After deleting, also remove the service entry from `.claude/mygen.json`.

## Tunnel Management

All tunnel files use slug-based names (`mygen-tunnel-{slug}.*`) to support multiple simultaneous tunnels.

### Check if tunnel is running
```bash
if [ -f .claude/mygen-tunnel-{slug}.pid ]; then
  PID=$(cat .claude/mygen-tunnel-{slug}.pid)
  kill -0 $PID 2>/dev/null && echo "Running (PID $PID)" || echo "Stopped"
fi
```

### Check all tunnels
```bash
for pidfile in .claude/mygen-tunnel-*.pid; do
  [ -f "$pidfile" ] || continue
  SLUG=$(basename "$pidfile" | sed 's/mygen-tunnel-//;s/\.pid//')
  PID=$(cat "$pidfile")
  if kill -0 "$PID" 2>/dev/null; then
    echo "$SLUG: Running (PID $PID)"
  else
    echo "$SLUG: Stopped"
  fi
done
```

### Stop tunnel
```bash
if [ -f .claude/mygen-tunnel-{slug}.pid ]; then
  kill $(cat .claude/mygen-tunnel-{slug}.pid) 2>/dev/null
  rm -f .claude/mygen-tunnel-{slug}.pid .claude/mygen-tunnel-{slug}-out.log .claude/mygen-tunnel-{slug}-err.log .claude/mygen-tunnel-{slug}.mjs
fi
```

### Stop all tunnels
```bash
for pidfile in .claude/mygen-tunnel-*.pid; do
  [ -f "$pidfile" ] || continue
  PID=$(cat "$pidfile")
  SLUG=$(basename "$pidfile" | sed 's/mygen-tunnel-//;s/\.pid//')
  kill "$PID" 2>/dev/null
  rm -f "$pidfile" ".claude/mygen-tunnel-${SLUG}-out.log" ".claude/mygen-tunnel-${SLUG}-err.log" ".claude/mygen-tunnel-${SLUG}.mjs"
done
```

### Restart tunnel
Stop the old one, then run Step 2-B again. The same slug and admin_token will be reused from `.claude/mygen.json`.

## Reference

- API docs: https://mygen.site/docs (NOT /api/docs)
- LLM-readable docs: https://mygen.site/llms.txt

## Important Notes

- Do not ask the user for technical choices (tunnel vs static). Decide automatically.
- **Reuse the same slug** for the same context. Ask for a subdomain on every new deploy (default: random).
- Handle errors yourself (port conflicts, build failures, etc.).
- If `$ARGUMENTS` explicitly specifies access (e.g. "password", "public"), skip the access control questions and use that directly.
- If `$ARGUMENTS` is empty, ask the access control questions on first deploy.
- admin_token is issued **only once**. If lost, it cannot be recovered. Always save to `.claude/mygen.json`.
- If service creation fails with `creator_ip_denied` (403), the user's IP is not in the server's allow-list. 
- **For tunnel/deploy creation, use the mygensite Node.js library** (not curl). For PATCH settings and DELETE, curl is fine.
- Clean up temp scripts after use. Keep `.claude/mygen-tunnel.mjs` alive while tunnel is running.
- Add `.claude/` to `.gitignore` (contains tokens).
