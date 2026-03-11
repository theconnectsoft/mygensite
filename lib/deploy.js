const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const debug = require('debug')('mygensite:deploy');
const { validateSlug, validateFilePath, validateTTL, validateAccessMode } = require('./validate');

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
    access = 'both',
    password,
    allowed_ips,
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
    const mode = typeof access === 'string' ? access : access.mode;
    if (mode) {
      const accessCheck = validateAccessMode(mode);
      if (!accessCheck.valid) {
        throw new Error(accessCheck.error);
      }
    }
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
  if (password) form.append('password', password);
  if (allowed_ips) {
    const ips = Array.isArray(allowed_ips) ? allowed_ips.join(',') : allowed_ips;
    form.append('allowed_ips', ips);
  }

  // Build access field
  const accessObj = { mode: typeof access === 'string' ? access : access.mode || 'both' };
  if (typeof access === 'object') {
    if (access.password) accessObj.password = access.password;
    if (access.allowed_ips) accessObj.allowed_ips = access.allowed_ips;
  }
  form.append('access', JSON.stringify(accessObj));

  for (const file of fileList) {
    form.append('files', file.content, {
      filename: file.name,
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

  // Add convenience methods
  data.updateAccess = (newAccess) => patchService(siteHost, siteSlug, siteToken, { access: newAccess });
  data.extendTTL = (newTtl) => patchService(siteHost, siteSlug, siteToken, { ttl: newTtl });
  data.redeploy = (dir) => deploy({ ...options, directory: dir, admin_token: siteToken });
  data.delete = (purge) => deleteService(siteHost, siteSlug, siteToken, purge);

  return data;
}

module.exports = deploy;
