---
name: deployment-awareness
description: Recognize active mygen.site deployments and suggest redeploy after file changes
---

- When a conversation starts with `.claude/mygen.json` present, acknowledge active services
- If a static deploy exists and build output files are changed, suggest "Do you want to redeploy?"
- If tunnel PID files (`.claude/mygen-tunnel-*.pid`) exist, be aware of running tunnel processes
- Never auto-deploy or auto-redeploy. Only suggest
- When the user says "update it", "reflect changes", "deploy changes", "업데이트 반영해줘", "변경사항 배포해줘", invoke the /share skill
