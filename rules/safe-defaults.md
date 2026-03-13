---
name: safe-defaults
description: Default to password protection unless user explicitly requests public access
---

- Unless the user explicitly says "public", "공개", "no password", "비밀번호 없이", default to IP-restricted + password authentication
- When presenting network options, recommend IP-restricted as the default
- When presenting auth options, recommend password as the default
- If the project contains .env, credentials, secrets, or API key files, add a warning about exposure risk
- Ambiguous requests like "just share it quickly" or "그냥 빨리 공유해줘" still get IP-restricted + password protection by default
