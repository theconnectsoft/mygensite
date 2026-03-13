#!/bin/bash
# PostToolUse hook: clean stale tunnel PID files
for pidfile in .claude/mygen-tunnel-*.pid; do
  [ -f "$pidfile" ] || continue
  PID=$(cat "$pidfile")
  if ! kill -0 "$PID" 2>/dev/null; then
    SLUG=$(basename "$pidfile" | sed 's/mygen-tunnel-//;s/\.pid//')
    rm -f "$pidfile"
    rm -f ".claude/mygen-tunnel-${SLUG}-out.log" ".claude/mygen-tunnel-${SLUG}-err.log"
    rm -f ".claude/mygen-tunnel-${SLUG}.mjs"
  fi
done
