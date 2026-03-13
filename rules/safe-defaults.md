---
name: safe-defaults
description: Default to password protection unless user explicitly requests public access
---

- Unless the user explicitly says "public", "공개", "no password", "비밀번호 없이", default to password authentication
- When presenting access control options, list password as the first (recommended) choice
- If the project contains .env, credentials, secrets, or API key files, add a warning about exposure risk
- Ambiguous requests like "just share it quickly" or "그냥 빨리 공유해줘" still get password protection by default
