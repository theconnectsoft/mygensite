# Examples

## tunnel-basic.mjs

Expose a local server to the internet. Stays alive in background with signal handling and heartbeat.

```bash
node examples/tunnel-basic.mjs 3000 my-app
```

## static-deploy.mjs

Deploy a directory as a static site. Supports unlimited TTL (`ttl: 0`).

```bash
node examples/static-deploy.mjs ./dist my-site
```

## manage-service.mjs

Manage an existing service — change settings, extend TTL, redeploy, delete.

```bash
node examples/manage-service.mjs my-site tok_xxx public
node examples/manage-service.mjs my-site tok_xxx password
node examples/manage-service.mjs my-site tok_xxx extend
node examples/manage-service.mjs my-site tok_xxx redeploy
node examples/manage-service.mjs my-site tok_xxx delete
```

Actions: `public`, `password`, `google`, `telegram`, `ip`, `extend`, `redeploy`, `delete`, `purge`
