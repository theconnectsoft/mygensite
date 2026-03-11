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

const VALID_ACCESS_MODES = ['public', 'password', 'ip_only', 'both'];

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
    return { valid: false, error: `Access mode must be one of: ${VALID_ACCESS_MODES.join(', ')}` };
  }
  return { valid: true };
}

module.exports = {
  validateSlug,
  validateFilePath,
  validateTTL,
  validateAccessMode,
  SLUG_REGEX,
  RESERVED_SLUGS,
  VALID_ACCESS_MODES,
};
