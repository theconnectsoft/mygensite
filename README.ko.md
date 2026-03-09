# mygensite

[mygen.site](https://mygen.site)를 통해 로컬 서버를 접근 제어와 함께 외부에 노출합니다.

[localtunnel](https://github.com/localtunnel/localtunnel) fork에 비밀번호 보호, IP 화이트리스트, TTL, 소유자 관리, admin token 기능을 추가했습니다.

## 빠른 시작

```
npx mygensite --port 8000
```

## 설치

### 전역 설치

```
npm install -g mygensite
```

### 프로젝트 의존성으로 설치

```
npm install mygensite
```

## CLI 사용법

```
mygensite --port 8000
```

mygen.site에 연결하여 터널을 생성하고, 사용할 URL을 알려줍니다. 하위 호환을 위해 `lt` 명령어도 사용 가능합니다.

### 인자

주요 인자 목록입니다. 전체 옵션은 `mygensite --help`를 참고하세요.

- `--port` (필수) 노출할 로컬 포트
- `--subdomain` 원하는 서브도메인 지정 (기본: 랜덤)
- `--host` 업스트림 서버 URL (기본: `https://mygen.site`)
- `--local-host` localhost 대신 프록시할 호스트명
- `--access` 접근 제어 모드: `public`, `password`, `ip_only`, `both` (기본: `both`)
- `--password` 접근 제어 비밀번호 (미지정 시 자동 생성)
- `--owner-email` 대시보드 관리용 소유자 이메일
- `--ttl` 터널 유효 시간(초), 60-86400 (기본: 3600)

```
mygensite --port 3000 --subdomain my-app --access password --password secret --ttl 7200
```

출력에 URL, 비밀번호, admin_token이 포함됩니다.

환경변수로도 인자를 지정할 수 있습니다:

```
PORT=3000 mygensite
```

## API

### mygensite(options)

지정한 로컬 `port`로 터널을 생성합니다. 공개 URL이 할당되면 resolve되는 Promise를 반환합니다.

```js
const mygensite = require('mygensite');

(async () => {
  const tunnel = await mygensite({
    port: 3000,
    subdomain: 'my-app',
    access: 'password',
    password: 'secret',
    owner_email: 'alice@company.com',
    ttl: 3600,
  });

  console.log(tunnel.url);           // https://my-app.mygen.site
  console.log(tunnel.password);      // "secret"
  console.log(tunnel.admin_token);   // "tok_xxx"
  console.log(tunnel.access);        // { mode: "password", ... }
  console.log(tunnel.expires_at);    // "2025-06-01T13:00:00Z"

  tunnel.on('close', () => {
    // 터널 종료됨
  });
})();
```

#### 옵션

##### localtunnel 호환

- `port` (number) [필수] 노출할 로컬 포트 번호.
- `subdomain` (string) 프록시 서버에 요청할 서브도메인.
- `host` (string) 업스트림 프록시 서버 URL. 기본값: `https://mygen.site`.
- `local_host` (string) `localhost` 대신 프록시할 호스트명. 프록시 요청의 `Host` 헤더도 이 값으로 변경됩니다.
- `local_https` (boolean) 로컬 HTTPS 서버로 터널링.
- `local_cert` (string) 로컬 HTTPS 서버의 인증서 PEM 파일 경로.
- `local_key` (string) 로컬 HTTPS 서버의 인증서 키 파일 경로.
- `local_ca` (string) 자체 서명 인증서용 CA 파일 경로.
- `allow_invalid_cert` (boolean) 로컬 HTTPS 서버의 인증서 검증 비활성화.

##### mygensite 확장

- `access` (string) 접근 제어 모드: `public`, `password`, `ip_only`, `both`. 기본값: `both`.
- `password` (string) 접근 제어 비밀번호. 미지정 시 자동 생성.
- `allowed_ips` (string[]) `ip_only` 또는 `both` 모드에서 허용할 IP 목록. CIDR 표기 지원.
- `owner_email` (string) 대시보드 관리용 소유자 이메일.
- `ttl` (number) 터널 유효 시간(초), 60-86400. 기본값: 3600.

### Tunnel 인스턴스

#### 속성

| 속성 | 설명 |
| --- | --- |
| `url` | 터널의 공개 URL |
| `password` | 비밀번호 (접근 제어 설정 시) |
| `admin_token` | 런타임 관리용 API 토큰 |
| `access` | 접근 제어 설정 객체 |
| `expires_at` | 터널 만료 시각 (ISO 형식) |

#### 이벤트

| 이벤트 | 인자 | 설명 |
| --- | --- | --- |
| request | info | 요청 처리 시 발생, `method`와 `path` 포함 |
| error | err | 터널 에러 발생 시 |
| close | | 터널 종료 시 |

#### 메서드

| 메서드 | 인자 | 설명 |
| --- | --- | --- |
| `close()` | | 터널 종료 |
| `updateAccess(access)` | `{ mode, password, allowed_ips }` | 런타임에 접근 제어 변경. Promise 반환. |
| `extendTTL(ttl)` | 초 (number) | 터널 TTL 연장. Promise 반환. |

### 런타임 관리

```js
// 공개로 전환
await tunnel.updateAccess({ mode: 'public' });

// 비밀번호 보호 추가
await tunnel.updateAccess({ mode: 'password', password: 'newpass' });

// IP 제한
await tunnel.updateAccess({ mode: 'ip_only', allowed_ips: ['1.2.3.0/24'] });

// TTL 1시간 연장
await tunnel.extendTTL(3600);
```

## 에러 코드

### 터널 생성 에러

| 상태 | 에러 | 설명 | 해결 |
| --- | --- | --- | --- |
| 400 | `invalid_slug` | slug는 3-63자, 소문자 영숫자와 하이픈만 가능 | 올바른 형식 사용, 예: `my-app-1` |
| 400 | `reserved_slug` | 예약된 slug로 사용 불가 | 다른 slug 사용. 예약어: www, api, dashboard, admin 등 |
| 400 | `invalid_ttl` | TTL은 60-86400초 범위여야 함 | 60(1분) ~ 86400(24시간) 사이 값 사용 |
| 400 | `invalid_access` | 접근 모드는 public, password, ip_only, both 중 하나 | 4가지 모드 중 하나를 지정 |
| 409 | `slug_in_use` | 이미 사용 중인 slug | 다른 slug 사용, 또는 `subdomain` 생략하여 랜덤 할당 |
| 503 | — | 서버 일시 장애 | 몇 초 후 재시도 |

### 런타임 관리 에러 (updateAccess, extendTTL)

| 상태 | 에러 | 설명 | 해결 |
| --- | --- | --- | --- |
| 401 | `unauthorized` | admin_token 없음 또는 불일치 | 터널 생성 시 반환된 `admin_token` 사용 |
| 404 | `not_found` | 서비스 없음 | slug가 맞는지, 터널이 아직 활성 상태인지 확인 |
| 400 | `invalid_access` | 잘못된 접근 모드 | public, password, ip_only, both 중 하나 사용 |
| 400 | `invalid_ttl` | TTL 범위 초과 | 60 ~ 86400 사이 값 사용 |

### Gateway 에러 (터널 URL 접속 시)

| 상태 | 설명 | 해결 |
| --- | --- | --- |
| 404 | 서비스 없음 | slug가 존재하고 삭제되지 않았는지 확인 |
| 410 | 서비스 만료 | `extendTTL()`로 연장하거나 새 터널 생성 |
| 403 | IP 접근 거부 | `allowed_ips`에 IP 추가, 또는 `public` 모드로 변경 |
| 401 | 비밀번호 틀림 | 올바른 비밀번호로 재시도 |
| 502 | 서비스 오프라인 (터널 연결 끊김) | 터널 클라이언트 재시작 |
| 504 | 서비스 응답 시간 초과 | 로컬 서버가 실행 중이고 응답 가능한지 확인 |

## 호환성

mygensite는 모든 localtunnel 서버와 완전 호환됩니다. 확장 옵션은 쿼리 파라미터로 전송되며, 지원하지 않는 서버에서는 무시됩니다.

## 라이선스

MIT
