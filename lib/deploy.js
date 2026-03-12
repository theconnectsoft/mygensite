const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const debug = require('debug')('mygensite:deploy');
const { validateSlug, validateFilePath, validateTTL, validateAccessMode, validateAuthMethod, validateAccessParams } = require('./validate');

const DEFAULT_HOST = 'https://mygen.site';

function readDirectoryRecursive(dir, base) {
  base = base || dir;
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readDirectoryRecursive(fullPath, base));
    } else if (entry.isFile()) {
      const relativePath = path.relative(base, fullPath);
      results.push({
        name: relativePath,
        content: fs.readFileSync(fullPath),
        contentType: guessMimeType(entry.name),
      });
    }
  }

  return results;
}

function guessMimeType(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  const mimeMap = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    mjs: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    txt: 'text/plain',
    xml: 'application/xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    map: 'application/json',
    webmanifest: 'application/manifest+json',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

async function patchService(host, slug, adminToken, body) {
  const res = await axios.patch(
    `${host}/api/services/${slug}`,
    body,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return res.data;
}

async function deleteService(host, slug, adminToken, purge) {
  const url = `${host}/api/services/${slug}${purge ? '?purge=true' : ''}`;
  const res = await axios.delete(url, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.data;
}

async function deploy(options) {
  const {
    host = DEFAULT_HOST,
    subdomain,
    directory,
    files,
    owner_email,
    access = 'public',
    auth_method,
    password,
    allowed_ips,
    google,
    telegram,
    ttl,
    admin_token,
  } = options;

  // Client-side validation — fail fast before API call
  if (subdomain) {
    const slugCheck = validateSlug(subdomain);
    if (!slugCheck.valid) {
      throw new Error(slugCheck.error);
    }
  }
  if (ttl != null) {
    const ttlCheck = validateTTL(Number(ttl));
    if (!ttlCheck.valid) {
      throw new Error(ttlCheck.error);
    }
  }
  if (access) {
    const accessCheck = validateAccessMode(access);
    if (!accessCheck.valid) {
      throw new Error(accessCheck.error);
    }
  }
  if (auth_method) {
    const authCheck = validateAuthMethod(auth_method);
    if (!authCheck.valid) {
      throw new Error(authCheck.error);
    }
  }
  // Validate param consistency
  const paramsCheck = validateAccessParams({ access, auth_method, password, google, telegram, allowed_ips });
  if (!paramsCheck.valid) {
    throw new Error(paramsCheck.error);
  }

  // Build file list
  let fileList;
  if (directory) {
    const resolvedDir = path.resolve(directory);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      throw new Error(`Directory not found: ${resolvedDir}`);
    }
    fileList = readDirectoryRecursive(resolvedDir);
  } else if (files) {
    fileList = files.map(f => ({
      name: f.name,
      content: Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content),
      contentType: f.contentType || guessMimeType(f.name),
    }));
  } else {
    throw new Error('Either directory or files option is required');
  }

  if (fileList.length === 0) {
    throw new Error('No files found to deploy');
  }

  // Validate all file paths before uploading
  for (const file of fileList) {
    const pathCheck = validateFilePath(file.name);
    if (!pathCheck.valid) {
      throw new Error(`Invalid file path "${file.name}": ${pathCheck.error}`);
    }
    file.name = pathCheck.cleaned;
  }

  debug('deploying %d files to %s', fileList.length, host);

  // Build multipart form
  const form = new FormData();
  if (subdomain) form.append('slug', subdomain);
  if (owner_email) form.append('owner_email', owner_email);
  if (ttl) form.append('ttl', String(ttl));
  if (access) form.append('access', access);
  if (auth_method) form.append('auth_method', auth_method);
  if (password) form.append('password', password);
  if (allowed_ips) {
    const ips = Array.isArray(allowed_ips) ? allowed_ips.join(',') : allowed_ips;
    form.append('allowed_ips', ips);
  }
  if (google) {
    const emails = Array.isArray(google) ? google.join(',') : google;
    form.append('google', emails);
  }
  if (telegram) {
    const ids = Array.isArray(telegram) ? telegram.join(',') : telegram;
    form.append('telegram', ids);
  }

  // Send file paths as separate JSON field (busboy strips directories from filename)
  form.append('filepaths', JSON.stringify(fileList.map(f => f.name)));

  for (const file of fileList) {
    form.append('files', file.content, {
      filepath: file.name,
      contentType: file.contentType,
    });
  }

  // Build headers
  const headers = { ...form.getHeaders() };
  if (admin_token) {
    headers.Authorization = `Bearer ${admin_token}`;
  }

  const res = await axios.post(`${host}/api/deploy`, form, { headers });
  const data = res.data;

  debug('deploy response: %j', data);

  // Store host and token for convenience methods
  const siteHost = host;
  const siteSlug = data.slug;
  const siteToken = data.admin_token || admin_token;

  // Add convenience methods (body is passed directly to PATCH /api/services/:slug)
  data.updateAccess = (body) => patchService(siteHost, siteSlug, siteToken, body);
  data.extendTTL = (newTtl) => patchService(siteHost, siteSlug, siteToken, { ttl: newTtl });
  data.redeploy = (dir) => deploy({ ...options, directory: dir, admin_token: siteToken });
  data.delete = (purge) => deleteService(siteHost, siteSlug, siteToken, purge);

  return data;
}

/**
 * Create a management handle for an existing service.
 * Use this when you already have the slug and admin_token (e.g. from a previous deploy).
 *
 * @param {object} options
 * @param {string} options.slug - The service slug
 * @param {string} options.admin_token - The admin token from the original deploy
 * @param {string} [options.host] - API host (default: https://mygen.site)
 * @returns {object} Management object with updateAccess, extendTTL, redeploy, delete methods
 */
function manage(options) {
  const {
    slug,
    admin_token,
    host = DEFAULT_HOST,
  } = options;

  if (!slug) throw new Error('slug is required');
  if (!admin_token) throw new Error('admin_token is required');

  return {
    slug,
    admin_token,
    url: `https://${slug}.${host.replace(/^https?:\/\//, '')}`,
    updateAccess: (body) => patchService(host, slug, admin_token, body),
    extendTTL: (ttl) => patchService(host, slug, admin_token, { ttl }),
    redeploy: (dir) => deploy({ host, subdomain: slug, directory: dir, admin_token }),
    delete: (purge) => deleteService(host, slug, admin_token, purge),
  };
}

module.exports = deploy;
module.exports.manage = manage;
