#!/bin/bash
# PreToolUse hook: block git staging of mygen secret files
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL" != "Bash" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

CMD=$(echo "$INPUT" | jq -r '.tool_input.command')

# Check for direct staging of mygen files
if echo "$CMD" | grep -qE 'git add.*\.claude/mygen'; then
  echo '{"decision":"block","reason":"Blocked: .claude/mygen.json contains admin tokens that should never be committed."}'
  exit 0
fi

echo '{"decision":"allow"}'
