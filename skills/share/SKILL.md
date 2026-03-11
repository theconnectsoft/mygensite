---
name: share
description: Share what the user built with others. Triggers on "share this", "deploy this", "make this accessible", "show my team", "create a URL", "change password", "make it public", "extend TTL", "공유해줘", "배포해줘", "외부에서 접속하게 해줘", "URL 만들어줘", "비밀번호 바꿔줘", "공개로 바꿔줘", "TTL 연장해줘", "팀한테 보여주고 싶어".
argument-hint: "[public or password]"
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Agent
---

# Share (mygen.site)

Share what the user built via a `{name}.mygen.site` URL.

## Owner Email

Deploys and tunnels require `--owner-email`. The email is used for dashboard management.

### First use
1. Check if `.claude/mygen.json` exists
2. If not, ask the user **once**: "What email should I use for service management? (used for dashboard login)"
3. Save it to `.claude/mygen.json`:
```json
{ "owner_email": "user@company.com" }
```

### Subsequent uses
- Read email from `.claude/mygen.json` automatically
- If the user says "change my email", update the file

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

Load owner email:
```bash
cat .claude/mygen.json 2>/dev/null
```
If missing, ask the user and save it.

### 1. Analyze the project

Quickly assess the project structure:
- Check package.json, requirements.txt, etc.
- Check for build output directories
- Check for server start scripts
- Check for running local servers (lsof -i -P | grep LISTEN)

### 2-A. Static deploy

Build first if needed:
```bash
# Framework-specific (example)
npm run build
```

Deploy:
```bash
npx mygensite deploy \
  --directory ./dist \
  --owner-email {email} \
  --access ${ARGUMENTS:-public} \
  --ttl 86400
```

- `--directory`: build output directory (auto-detect dist, build, out, etc.)
- If no build directory exists and there are only HTML files, use current directory (`.`)
- Default access is public
- TTL is 24 hours

### 2-B. Tunnel

Check if a local server is running; if not, start it:
```bash
# Check running ports
lsof -i -P | grep LISTEN | grep -E ':(3000|5173|8000|8080|4200|5000)'
```

If no server is running:
```bash
# Find dev/start script in package.json and run it
npm run dev &
# Or framework-appropriate command
```

Find the server port and create a tunnel:
```bash
npx mygensite \
  --port {detected port} \
  --owner-email {email} \
  --access ${ARGUMENTS:-public} \
  --ttl 3600
```

- Default access is public
- TTL is 1 hour (shorter for tunnels)
- **CRITICAL: The tunnel process must keep running.** The tunnel only works while the `npx mygensite` process is alive. If it exits, the tunnel closes immediately and users get 502. Run it in a way that stays alive (e.g. background with `&`, separate terminal, or keep the script running).

### 3. Save results and inform the user

**Always** save the result (slug, admin_token) to `.claude/mygen.json`:
```json
{
  "owner_email": "user@company.com",
  "services": {
    "{slug}": {
      "admin_token": "tok_xxx",
      "type": "static",
      "url": "https://{slug}.mygen.site",
      "created_at": "2025-06-01T12:00:00Z"
    }
  }
}
```

After deploy/tunnel completes, inform the user **concisely**:

```
URL: https://{slug}.mygen.site

Share this link — anyone can access it.
Auto-expires in 24 hours.
```

If password-protected:
```
URL: https://{slug}.mygen.site
Password: {password}

Share the link and password together.
```

If tunnel, add:
```
The tunnel stays open as long as this process is running.
Do NOT close this terminal or kill the process — the tunnel will stop working.
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

await site.updateAccess({ mode: 'public' });
await site.updateAccess({ mode: 'password', password: 'new-password' });
await site.extendTTL(86400);
await site.redeploy('./dist');  // only when files changed
await site.delete();
```

> **Important:** Do not redeploy just to change settings. Use `manage()`.

### Method 2: curl

Read the admin_token for the service from `.claude/mygen.json`:

```bash
# Change access mode (e.g. password -> public)
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"access": {"mode": "public"}}'

# Change password
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"access": {"password": "new-password"}}'

# Add IP restriction
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"access": {"mode": "ip_only", "allowed_ips": ["1.2.3.0/24"]}}'

# Extend TTL (timer resets from now)
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 86400}'

# Change owner email
curl -X PATCH https://mygen.site/api/services/{slug} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"owner_email": "new@company.com"}'
```

### PATCH vs Redeploy

| Request | Method |
|---------|--------|
| Change password | PATCH `access.password` |
| Make it public | PATCH `access.mode` |
| Restrict by IP | PATCH `access.allowed_ips` |
| Extend time | PATCH `ttl` |
| Change email | PATCH `owner_email` |
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

## Important Notes

- Do not ask the user for technical choices. Decide automatically.
- Let the slug (subdomain) be auto-generated unless the user specifies one.
- Handle errors yourself (port conflicts, build failures, etc.).
- If `$ARGUMENTS` is "password", deploy with password protection.
- If `$ARGUMENTS` is empty, deploy as public.
- admin_token is issued **only once**. If lost, it cannot be recovered. Always save to `.claude/mygen.json`.
- Add `.claude/mygen.json` to `.gitignore` (contains tokens).
