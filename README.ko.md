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

## 제약사항

### Slug (서브도메인)

- 3–63자, 소문자 영문(`a-z`), 숫자(`0-9`), 하이픈(`-`)만 허용
- 영문자 또는 숫자로 시작/끝나야 함 (하이픈으로 시작/끝 불가)
- 예약어 사용 불가: `www`, `api`, `dashboard`, `admin`, `mail`, `ftp`, `static`, `docs`, `status`, `health`, `internal`, `tunnel`, `app`, `web`
- 터널로 사용 중인 slug에 정적 배포 불가 (반대도 동일). 기존 서비스를 먼저 삭제해야 함.

```
OK:  my-app, demo-v2, test-123
BAD: My-App, -dash, ab, a_b, my--app..com
```

### 파일 경로 (정적 배포)

- 세그먼트별 허용 문자: 영문, 숫자, 하이픈(`-`), 밑줄(`_`), 점(`.`), 공백
- 슬래시(`/`)로 디렉토리 구조 표현
- 최대 경로 길이: 1024자, 세그먼트 최대: 255자
- 경로 탈출(`..`, `.`) 거부
- 숨김 파일(`.`으로 시작하는 이름) 거부 (예: `.env`, `.git`)
- 선행 공백, 백슬래시, 제어 문자 불가
- 전체 업로드 크기 제한: **50 MB**

```
OK:  index.html, assets/style.css, img/logo 2.png, deep/nested/file.js
BAD: ../secret.txt, .env, file\name.html
```

### 정적 파일 서빙 동작

- `/` → `index.html` 제공
- `/about/` → `about/index.html` 제공
- `/about` (슬래시 없이) → 해당 파일 먼저 시도, 없으면 `about/index.html`로 폴백
- Content-Type은 확장자로 결정 (`.css` → `text/css`, `.js` → `application/javascript`)
- 응답에 `Cache-Control: public, max-age=60` 포함

### TTL

- 최소: 60초 (1분)
- 최대: 86,400초 (24시간)
- 기본: 3,600초 (1시간)
- TTL 연장 시 타이머 리셋 (created_at이 현재 시각으로 변경)

### 클라이언트 사전 검증

라이브러리가 API 호출 전에 입력값을 검증하여 잘못된 값은 즉시 에러를 발생시킵니다:

```js
// 생성 시점에 즉시 에러 — API 호출 없음
const tunnel = await mygensite({ port: 3000, subdomain: 'INVALID' });
// Error: Slug must be lowercase alphanumeric and hyphens...

// 검증 함수 직접 사용
const { validate } = require('mygensite');

validate.validateSlug('my-app');         // { valid: true }
validate.validateSlug('AB');             // { valid: false, error: 'Slug must be 3-63 characters' }
validate.validateFilePath('assets/x.js');// { valid: true, cleaned: 'assets/x.js' }
validate.validateFilePath('../etc');     // { valid: false, error: '경로 탈출 불가...' }
validate.validateTTL(30);               // { valid: false, error: 'TTL 범위 초과...' }
validate.validateAccessMode('public');   // { valid: true }
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

## 정적 사이트 배포

HTML/CSS/JS 파일을 `{slug}.mygen.site`로 배포합니다 — 터널 불필요.

### mygensite.deploy(options)

파일을 서버에 업로드하고 관리 메서드가 포함된 site 객체를 반환합니다. Promise를 반환합니다.

```js
const mygensite = require('mygensite');

const site = await mygensite.deploy({
  directory: './dist',
  subdomain: 'demo',
  owner_email: 'alice@company.com',
  access: 'public',
  ttl: 86400,
});

console.log(site.url);           // https://demo.mygen.site
console.log(site.admin_token);   // "tok_yyy"
console.log(site.slug);          // "demo"
console.log(site.expires_at);    // "2025-06-02T12:00:00Z"
```

#### 옵션

| 옵션 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `directory` | string | * | — | 업로드할 로컬 디렉토리. 하위 파일 전체 재귀 업로드. |
| `files` | Array | * | — | `directory` 대신 사용. `{ name, content, contentType? }` 객체 배열. |
| `subdomain` | string | | 랜덤 | 원하는 서브도메인 지정. |
| `host` | string | | `https://mygen.site` | 서버 URL. |
| `access` | string | | `both` | 접근 제어 모드: `public`, `password`, `ip_only`, `both`. |
| `password` | string | | 자동 | 접근 제어 비밀번호. |
| `allowed_ips` | string[] | | — | `ip_only` 또는 `both` 모드에서 허용할 IP. CIDR 지원. |
| `owner_email` | string | | — | 대시보드 관리용 소유자 이메일. |
| `ttl` | number | | 3600 | 사이트 유효 시간(초), 60-86400. |
| `admin_token` | string | | — | 기존 slug에 재배포할 때 사용. |

\* `directory` 또는 `files` 중 하나는 필수.

#### 인라인 파일로 배포

```js
const site = await mygensite.deploy({
  subdomain: 'hello',
  access: 'public',
  files: [
    { name: 'index.html', content: '<h1>Hello World</h1>' },
    { name: 'assets/style.css', content: 'body { font-family: sans-serif; }' },
  ],
});
```

#### curl로 배포

Multipart의 `filename`은 디렉토리 경로를 제거합니다 (예: `assets/style.css` &rarr; `style.css`). 서브디렉토리가 있으면 `filepaths` JSON 필드를 사용하세요:

```bash
# 플랫 파일 (서브디렉토리 없음) - filepaths 불필요
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F access='{"mode":"public"}' \
  -F files=@index.html -F files=@style.css

# 서브디렉토리 있음 - filepaths 필수
curl -X POST https://mygen.site/api/deploy \
  -F slug=demo -F access='{"mode":"public"}' \
  -F 'filepaths=["index.html","assets/style.css","assets/js/app.js"]' \
  -F files=@index.html \
  -F files=@assets/style.css \
  -F files=@assets/js/app.js
```

`filepaths`는 JSON 배열로, 각 원소가 `files` 필드와 순서대로 대응됩니다. 서버는 multipart filename 대신 이 경로를 사용합니다.

### Site 인스턴스

반환 객체에 배포 결과와 편의 메서드가 포함됩니다:

#### 속성

| 속성 | 설명 |
| --- | --- |
| `url` | 공개 URL (`https://{slug}.mygen.site`) |
| `slug` | 할당된 서브도메인 |
| `admin_token` | 관리 API 호출용 토큰 |
| `password` | 비밀번호 (접근 제어 사용 시) |
| `expires_at` | 만료 시각 (ISO 형식) |

#### 메서드

| 메서드 | 인자 | 설명 |
| --- | --- | --- |
| `updateAccess(access)` | `{ mode, password, allowed_ips }` | 접근 제어 변경. Promise 반환. |
| `extendTTL(ttl)` | 초 (number) | TTL 연장. Promise 반환. |
| `redeploy(directory)` | 디렉토리 경로 (string) | 새 파일로 교체 업로드. Promise 반환. |
| `delete(purge?)` | purge (boolean) | 사이트 삭제. `false` = 소프트 삭제 (파일 유지), `true` = S3 파일까지 삭제. Promise 반환. |

### mygensite.manage(options)

기존 서비스의 `slug`과 `admin_token`이 있을 때 관리 핸들을 생성합니다 (예: 이전 배포에서 저장해둔 값).
**관리 객체를 얻기 위해 재배포하지 마세요** — 이 함수를 사용하세요.

```js
const mygensite = require('mygensite');

const site = mygensite.manage({
  slug: 'demo',
  admin_token: 'tok_xxx',       // 원래 배포/터널 생성 시 반환된 값
  host: 'https://mygen.site',   // 선택
});

// deploy 결과와 동일한 메서드 사용 가능
await site.updateAccess({ mode: 'public' });
await site.extendTTL(86400);
await site.redeploy('./dist-v2');
await site.delete();
```

#### 옵션

| 옵션 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `slug` | string | 예 | — | 서비스 slug |
| `admin_token` | string | 예 | — | 원래 배포/터널 생성 시 반환된 admin token |
| `host` | string | | `https://mygen.site` | 서버 URL |

### 배포 관리 예제

```js
// 새 파일로 재배포
await site.redeploy('./dist-v2');

// 배포 후 비밀번호 보호 추가
await site.updateAccess({ mode: 'password', password: 'secret' });

// TTL 24시간 연장
await site.extendTTL(86400);

// 소프트 삭제 (slug 재사용 가능, S3 파일 유지)
await site.delete();

// 완전 삭제 (S3 파일 제거, 복구 불가)
await site.delete(true);
```

### 배포 에러 코드

| 상태 | 에러 | 설명 | 해결 |
| --- | --- | --- | --- |
| 400 | `no_files` | 최소 1개 파일 필요 | `directory` 또는 `files` 옵션 제공 |
| 400 | `invalid_slug` | 잘못된 slug 형식 | 3-63자, 소문자 영숫자와 하이픈 사용 |
| 400 | `reserved_slug` | 예약된 slug | 다른 slug 사용 |
| 409 | `slug_in_use` | 다른 소유자가 사용 중인 slug | 다른 slug 사용 |
| 409 | `type_conflict` | 터널로 사용 중인 slug | 정적 배포용으로 다른 slug 사용 |
| 413 | `file_too_large` | 총 업로드 크기 50MB 초과 | 파일 크기 줄이기 |

## 호환성

mygensite는 모든 localtunnel 서버와 완전 호환됩니다. 확장 옵션은 쿼리 파라미터로 전송되며, 지원하지 않는 서버에서는 무시됩니다.

## 라이선스

MIT
