/* eslint-disable no-console */

const assert = require('assert');
const {
  validateSlug,
  validateFilePath,
  validateTTL,
  validateAccessMode,
  validateAuthMethod,
  validateAccessParams,
  VALID_ACCESS_MODES,
  VALID_AUTH_METHODS,
} = require('./lib/validate');
const Tunnel = require('./lib/Tunnel');

describe('validateSlug', () => {
  it('accepts valid slugs', () => {
    assert.ok(validateSlug('my-app').valid);
    assert.ok(validateSlug('test-123').valid);
    assert.ok(validateSlug('abcd').valid);
  });

  it('rejects too short', () => {
    assert.strictEqual(validateSlug('ab').valid, false);
    assert.strictEqual(validateSlug('abc').valid, false);
  });

  it('rejects uppercase', () => {
    assert.strictEqual(validateSlug('MyApp').valid, false);
  });

  it('rejects reserved slugs', () => {
    assert.strictEqual(validateSlug('dashboard').valid, false);
    assert.strictEqual(validateSlug('admin').valid, false);
  });
});

describe('validateAccessMode', () => {
  it('accepts public and ip', () => {
    assert.ok(validateAccessMode('public').valid);
    assert.ok(validateAccessMode('ip').valid);
  });

  it('rejects old 4-mode values', () => {
    assert.strictEqual(validateAccessMode('password').valid, false);
    assert.strictEqual(validateAccessMode('ip_only').valid, false);
    assert.strictEqual(validateAccessMode('both').valid, false);
  });

  it('VALID_ACCESS_MODES has exactly public and ip', () => {
    assert.deepStrictEqual(VALID_ACCESS_MODES, ['public', 'ip']);
  });
});

describe('validateAuthMethod', () => {
  it('accepts empty (no auth)', () => {
    const r = validateAuthMethod('');
    assert.ok(r.valid);
    assert.deepStrictEqual(r.methods, []);
  });

  it('accepts null/undefined (no auth)', () => {
    assert.ok(validateAuthMethod(null).valid);
    assert.ok(validateAuthMethod(undefined).valid);
  });

  it('accepts single methods', () => {
    assert.ok(validateAuthMethod('password').valid);
    assert.ok(validateAuthMethod('google').valid);
    assert.ok(validateAuthMethod('telegram').valid);
  });

  it('accepts CSV combinations', () => {
    const r = validateAuthMethod('password,google');
    assert.ok(r.valid);
    assert.deepStrictEqual(r.methods, ['password', 'google']);
  });

  it('rejects invalid method', () => {
    assert.strictEqual(validateAuthMethod('oauth').valid, false);
    assert.strictEqual(validateAuthMethod('password,invalid').valid, false);
  });

  it('VALID_AUTH_METHODS has password, google, telegram', () => {
    assert.deepStrictEqual(VALID_AUTH_METHODS, ['password', 'google', 'telegram']);
  });
});

describe('validateAccessParams', () => {
  it('allows public + no auth', () => {
    assert.ok(validateAccessParams({ access: 'public' }).valid);
  });

  it('allows ip + password', () => {
    assert.ok(validateAccessParams({
      access: 'ip',
      allowed_ips: '127.0.0.1',
      auth_method: 'password',
      password: 'secret',
    }).valid);
  });

  it('allows public + google auth', () => {
    assert.ok(validateAccessParams({
      access: 'public',
      auth_method: 'google',
      google: 'me@gmail.com',
    }).valid);
  });

  it('rejects allowed_ips when access is public', () => {
    const r = validateAccessParams({ access: 'public', allowed_ips: '1.2.3.0/24' });
    assert.strictEqual(r.valid, false);
    assert.ok(r.error.includes('allowed_ips'));
  });

  it('rejects password without auth_method', () => {
    const r = validateAccessParams({ access: 'public', password: 'secret' });
    assert.strictEqual(r.valid, false);
    assert.ok(r.error.includes('auth_method'));
  });

  it('rejects google without auth_method', () => {
    const r = validateAccessParams({ access: 'public', google: 'me@co.com' });
    assert.strictEqual(r.valid, false);
  });

  it('rejects telegram without auth_method', () => {
    const r = validateAccessParams({ access: 'public', telegram: '123' });
    assert.strictEqual(r.valid, false);
  });

  it('rejects google when auth_method=password', () => {
    const r = validateAccessParams({
      auth_method: 'password',
      password: 'pw',
      google: 'me@co.com',
    });
    assert.strictEqual(r.valid, false);
    assert.ok(r.error.includes('google'));
  });

  it('rejects telegram when auth_method=password', () => {
    const r = validateAccessParams({
      auth_method: 'password',
      password: 'pw',
      telegram: '123',
    });
    assert.strictEqual(r.valid, false);
    assert.ok(r.error.includes('telegram'));
  });

  it('rejects password when auth_method=google', () => {
    const r = validateAccessParams({
      auth_method: 'google',
      google: 'me@co.com',
      password: 'secret',
    });
    assert.strictEqual(r.valid, false);
    assert.ok(r.error.includes('password'));
  });

  it('allows password,google with both params', () => {
    assert.ok(validateAccessParams({
      auth_method: 'password,google',
      password: 'secret',
      google: 'me@co.com',
    }).valid);
  });
});

describe('Tunnel constructor validation', () => {
  it('rejects invalid access mode', () => {
    assert.throws(() => {
      new Tunnel({ port: 8080, access: 'both' });
    }, /Access must be/);
  });

  it('rejects invalid auth_method', () => {
    assert.throws(() => {
      new Tunnel({ port: 8080, auth_method: 'oauth' });
    }, /Invalid auth method/);
  });

  it('rejects mismatched params (google without auth_method)', () => {
    assert.throws(() => {
      new Tunnel({ port: 8080, google: 'me@co.com' });
    }, /auth_method/);
  });

  it('rejects mismatched params (password with auth_method=google)', () => {
    assert.throws(() => {
      new Tunnel({ port: 8080, auth_method: 'google', google: 'me@co.com', password: 'pw' });
    }, /password/);
  });

  it('rejects allowed_ips with access=public', () => {
    assert.throws(() => {
      new Tunnel({ port: 8080, access: 'public', allowed_ips: '1.2.3.0/24' });
    }, /allowed_ips/);
  });

  it('accepts valid 2-layer config', () => {
    // Should not throw
    const t = new Tunnel({
      port: 8080,
      access: 'ip',
      allowed_ips: '127.0.0.0/8',
      auth_method: 'password,google',
      password: 'secret',
      google: 'me@co.com',
    });
    assert.ok(t);
  });
});

describe('validateFilePath', () => {
  it('accepts normal files', () => {
    assert.ok(validateFilePath('index.html').valid);
    assert.ok(validateFilePath('assets/style.css').valid);
  });

  it('rejects path traversal', () => {
    assert.strictEqual(validateFilePath('../etc/passwd').valid, false);
  });

  it('rejects hidden files', () => {
    assert.strictEqual(validateFilePath('.env').valid, false);
  });
});

describe('validateTTL', () => {
  it('accepts valid range', () => {
    assert.ok(validateTTL(60).valid);
    assert.ok(validateTTL(86400).valid);
    assert.ok(validateTTL(3600).valid);
  });

  it('rejects out of range', () => {
    assert.strictEqual(validateTTL(10).valid, false);
    assert.strictEqual(validateTTL(999999).valid, false);
  });
});
