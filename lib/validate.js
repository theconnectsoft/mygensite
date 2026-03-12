'use strict';

/**
 * Validation helpers for mygensite.
 *
 * These mirror the server-side rules so you can catch errors locally
 * before making an API call.
 */

// Must match: server/src/api/routes/tunnels.ts SLUG_REGEX
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const RESERVED_SLUGS = new Set([
  'www', 'api', 'dashboard', 'admin', 'mail',
  'ftp', 'static', 'docs', 'status', 'health',
  'internal', 'tunnel', 'app', 'web',
]);

// Must match: server/src/api/routes/deploy.ts SAFE_PATH_SEGMENT
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_\-. ]+$/;

const VALID_ACCESS_MODES = ['public', 'ip'];
const VALID_AUTH_METHODS = ['password', 'google', 'telegram'];

/**
 * Validate a slug (subdomain) name.
 * @param {string} slug
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Slug is required' };
  }
  if (slug.length < 3 || slug.length > 63) {
    return { valid: false, error: 'Slug must be 3-63 characters' };
  }
  if (!SLUG_REGEX.test(slug)) {
    return { valid: false, error: 'Slug must be lowercase alphanumeric and hyphens, starting and ending with alphanumeric' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: `"${slug}" is a reserved slug` };
  }
  return { valid: true };
}

/**
 * Validate a file path for static deployment.
 * @param {string} name - File path (e.g. "index.html", "assets/style.css")
 * @returns {{ valid: boolean, cleaned?: string, error?: string }}
 */
function validateFilePath(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'File path is required' };
  }
  if (name.length > 1024) {
    return { valid: false, error: 'File path must not exceed 1024 characters' };
  }

  const cleaned = name.replace(/^\/+/, '');
  if (!cleaned) {
    return { valid: false, error: 'File path is empty after cleaning' };
  }

  const segments = cleaned.split('/');
  for (const seg of segments) {
    if (!seg) {
      return { valid: false, error: 'File path contains empty segments (double slash)' };
    }
    if (seg === '.' || seg === '..') {
      return { valid: false, error: 'Path traversal ("." or "..") is not allowed' };
    }
    if (seg.length > 255) {
      return { valid: false, error: `Segment "${seg.slice(0, 20)}..." exceeds 255 characters` };
    }
    if (seg.startsWith('.')) {
      return { valid: false, error: `Hidden files (starting with ".") are not allowed: "${seg}"` };
    }
    if (seg.startsWith(' ')) {
      return { valid: false, error: 'File names must not start with a space' };
    }
    if (!SAFE_PATH_SEGMENT.test(seg)) {
      return { valid: false, error: `Invalid characters in "${seg}". Allowed: letters, numbers, hyphens, underscores, dots, spaces` };
    }
  }

  return { valid: true, cleaned: segments.join('/') };
}

/**
 * Validate TTL value.
 * @param {number} ttl - TTL in seconds
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTTL(ttl) {
  if (typeof ttl !== 'number' || !Number.isFinite(ttl)) {
    return { valid: false, error: 'TTL must be a number' };
  }
  if (ttl < 60 || ttl > 86400) {
    return { valid: false, error: 'TTL must be between 60 and 86400 seconds (1 min to 24 hours)' };
  }
  return { valid: true };
}

/**
 * Validate access mode.
 * @param {string} mode
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAccessMode(mode) {
  if (!VALID_ACCESS_MODES.includes(mode)) {
    return { valid: false, error: `Access must be one of: ${VALID_ACCESS_MODES.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate auth_method CSV value.
 * @param {string} method - CSV of auth methods (e.g. "password,google")
 * @returns {{ valid: boolean, methods?: string[], error?: string }}
 */
function validateAuthMethod(method) {
  if (!method) {
    return { valid: true, methods: [] };
  }
  const methods = method.split(',').map(s => s.trim()).filter(Boolean);
  for (const m of methods) {
    if (!VALID_AUTH_METHODS.includes(m)) {
      return { valid: false, error: `Invalid auth method: "${m}". Must be: ${VALID_AUTH_METHODS.join(', ')}` };
    }
  }
  return { valid: true, methods };
}

/**
 * Validate that access params are consistent (no mismatched params).
 * Mirrors server-side validation in parseAccessParams.
 * @param {object} opts
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAccessParams(opts) {
  const access = opts.access || 'public';
  const authMethod = opts.auth_method || null;
  const methods = authMethod ? authMethod.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Reject allowed_ips when access is public
  if (access === 'public' && opts.allowed_ips) {
    return { valid: false, error: "allowed_ips not allowed when access is 'public'" };
  }

  // Reject auth params without auth_method
  if (!authMethod && (opts.password || opts.google || opts.telegram)) {
    return { valid: false, error: 'auth parameters (password/google/telegram) require auth_method to be specified' };
  }

  // Reject mismatched params
  if (authMethod) {
    if (!methods.includes('password') && opts.password) {
      return { valid: false, error: "password not allowed when auth_method doesn't include 'password'" };
    }
    if (!methods.includes('google') && opts.google) {
      return { valid: false, error: "google not allowed when auth_method doesn't include 'google'" };
    }
    if (!methods.includes('telegram') && opts.telegram) {
      return { valid: false, error: "telegram not allowed when auth_method doesn't include 'telegram'" };
    }
  }

  return { valid: true };
}

module.exports = {
  validateSlug,
  validateFilePath,
  validateTTL,
  validateAccessMode,
  validateAuthMethod,
  validateAccessParams,
  SLUG_REGEX,
  RESERVED_SLUGS,
  VALID_ACCESS_MODES,
  VALID_AUTH_METHODS,
};
