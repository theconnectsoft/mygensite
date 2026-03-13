---
name: tunnel-keepalive
description: Ensure tunnel scripts stay alive with proper keepalive patterns, not exit immediately
---

When writing tunnel scripts (`.claude/mygen-tunnel-*.mjs`), always follow these patterns:

1. **setInterval required**: Keep the process alive after tunnel creation
   ```js
   setInterval(() => {
     console.error(`[tunnel] alive — ${tunnel.url}`);
   }, 5 * 60 * 1000);
   ```

2. **Signal handlers required**: Clean shutdown on SIGINT/SIGTERM
   ```js
   process.on('SIGINT', () => { tunnel.close(); process.exit(0); });
   process.on('SIGTERM', () => { tunnel.close(); process.exit(0); });
   ```

3. **Event handlers required**: Log unexpected disconnects
   ```js
   tunnel.on('close', () => { console.error('Tunnel closed'); process.exit(1); });
   tunnel.on('error', (err) => { console.error('Tunnel error:', err.message); });
   ```

4. **Never do these**:
   - End the script after console.log without keepalive (process exits immediately)
   - Use setTimeout instead of setInterval (runs only once)
   - Call process.exit() outside of signal/event handlers

5. **Background execution required**: Always run with `&` and save the PID
   ```bash
   node .claude/mygen-tunnel-{slug}.mjs > .claude/mygen-tunnel-{slug}-out.log 2>.claude/mygen-tunnel-{slug}-err.log &
   echo $! > .claude/mygen-tunnel-{slug}.pid
   ```
