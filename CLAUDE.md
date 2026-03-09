# CLAUDE.md — mygensite (localtunnel fork)

## 개요
localtunnel 클라이언트를 fork하여 mygen.site 서비스 전용으로 확장.
기본 host: https://mygen.site
확장: 접근제어(access, password, allowed_ips), owner_email, ttl, admin_token

## 원본
https://github.com/localtunnel/localtunnel (MIT 라이선스)

## 수정 최소화 원칙
localtunnel 원본 코드를 최소한으로 수정. 변경 파일:
- lib/Tunnel.js — 확장 query params + 응답 파싱 + 편의 메서드
- lib/deploy.js — 정적 배포 (신규, Phase 3)
- index.js — deploy export 추가
- bin/lt.js — 기본 host 변경
- package.json — name, default host

## 변경하지 않는 파일
- lib/TunnelCluster.js
- lib/HeaderHostTransformer.js
