#!/bin/bash
# Stop hook: remind about running tunnels
RUNNING=""
for pidfile in .claude/mygen-tunnel-*.pid; do
  [ -f "$pidfile" ] || continue
  PID=$(cat "$pidfile")
  if kill -0 "$PID" 2>/dev/null; then
    SLUG=$(basename "$pidfile" | sed 's/mygen-tunnel-//;s/\.pid//')
    RUNNING="${RUNNING}  - ${SLUG}.mygen.site (PID $PID)\n"
  fi
done

if [ -n "$RUNNING" ]; then
  echo -e "Running tunnels:\n${RUNNING}To stop: kill <PID>" >&2
fi
