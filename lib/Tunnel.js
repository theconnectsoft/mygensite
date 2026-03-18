/* eslint-disable consistent-return, no-underscore-dangle */

const { parse } = require('url');
const { EventEmitter } = require('events');
const axios = require('axios');
const debug = require('debug')('localtunnel:client');

const TunnelCluster = require('./TunnelCluster');
const { validateSlug, validateTTL, validateAccessMode, validateAuthMethod, validateAccessParams, validateOwner } = require('./validate');

module.exports = class Tunnel extends EventEmitter {
  constructor(opts = {}) {
    super(opts);
    this.opts = opts;
    this.closed = false;
    if (!this.opts.host) {
      this.opts.host = 'https://mygen.site';
    }

    // Client-side validation — fail fast before API call
    if (opts.subdomain) {
      const slugCheck = validateSlug(opts.subdomain);
      if (!slugCheck.valid) {
        throw new Error(slugCheck.error);
      }
    }
    if (opts.ttl != null) {
      const ttlCheck = validateTTL(Number(opts.ttl), { allowUnlimited: false, max: 86400 });
      if (!ttlCheck.valid) {
        throw new Error(ttlCheck.error);
      }
    }
    if (opts.access) {
      const accessCheck = validateAccessMode(opts.access);
      if (!accessCheck.valid) {
        throw new Error(accessCheck.error);
      }
    }
    if (opts.auth_method) {
      const authCheck = validateAuthMethod(opts.auth_method);
      if (!authCheck.valid) {
        throw new Error(authCheck.error);
      }
    }
    if (opts.owner_email) {
      const ownerCheck = validateOwner(opts.owner_email);
      if (!ownerCheck.valid) {
        throw new Error(ownerCheck.error);
      }
    }
    // Validate param consistency (mismatched params)
    const paramsCheck = validateAccessParams(opts);
    if (!paramsCheck.valid) {
      throw new Error(paramsCheck.error);
    }
  }

  _getInfo(body) {
    /* eslint-disable camelcase */
    const { id, ip, port, url, cached_url, max_conn_count } = body;
    const { host, port: local_port, local_host } = this.opts;
    const { local_https, local_cert, local_key, local_ca, allow_invalid_cert } = this.opts;

    // Parse extended fields from mygensite server
    this.password = body.password || null;
    this.admin_token = body.admin_token || null;
    this.access = body.access || null;
    this.auth_methods = body.auth_methods || null;
    this.allowed_ips = body.allowed_ips || null;
    this.allowed_emails = body.allowed_emails || null;
    this.allowed_telegram_ids = body.allowed_telegram_ids || null;
    this.expires_at = body.expires_at || null;

    return {
      name: id,
      url,
      cached_url,
      max_conn: max_conn_count || 1,
      remote_host: parse(host).hostname,
      remote_ip: ip,
      remote_port: port,
      local_port,
      local_host,
      local_https,
      local_cert,
      local_key,
      local_ca,
      allow_invalid_cert,
    };
    /* eslint-enable camelcase */
  }

  // initialize connection
  // callback with connection info
  _init(cb) {
    const opt = this.opts;
    const getInfo = this._getInfo.bind(this);

    const params = {
      responseType: 'json',
    };

    // API token authentication (token option or MYGENSITE_TOKEN env)
    const token = opt.token || process.env.MYGENSITE_TOKEN;
    if (token) {
      params.headers = { Authorization: `Bearer ${token}` };
    }

    // Build extended query params for mygensite server
    const queryParams = {};
    if (opt.access) queryParams.access = opt.access;
    if (opt.auth_method) queryParams.auth_method = opt.auth_method;
    if (opt.password) queryParams.password = opt.password;
    if (opt.allowed_ips) {
      queryParams.allowed_ips = Array.isArray(opt.allowed_ips)
        ? opt.allowed_ips.join(',')
        : opt.allowed_ips;
    }
    if (opt.google) {
      queryParams.google = Array.isArray(opt.google)
        ? opt.google.join(',')
        : opt.google;
    }
    if (opt.telegram) {
      queryParams.telegram = Array.isArray(opt.telegram)
        ? opt.telegram.join(',')
        : opt.telegram;
    }
    if (opt.owner_email) queryParams.owner_email = opt.owner_email;
    if (opt.ttl) queryParams.ttl = String(opt.ttl);
    if (opt.admin_token) queryParams.admin_token = opt.admin_token;

    if (Object.keys(queryParams).length > 0) {
      params.params = queryParams;
    }

    const baseUri = `${opt.host}/`;
    // no subdomain at first, maybe use requested domain
    const assignedDomain = opt.subdomain;
    // where to quest
    const uri = baseUri + (assignedDomain || '?new');

    (function getUrl() {
      axios
        .get(uri, params)
        .then(res => {
          const body = res.data;
          debug('got tunnel information', res.data);
          if (res.status !== 200) {
            const err = new Error(
              (body && body.message) || 'localtunnel server returned an error, please try again'
            );
            return cb(err);
          }
          cb(null, getInfo(body));
        })
        .catch(err => {
          // If server returned a 4xx client error, don't retry — it won't resolve itself
          const status = err.response && err.response.status;
          if (status && status >= 400 && status < 500) {
            const body = err.response.data;
            const message = (body && body.message) || err.message;
            return cb(new Error(message));
          }
          debug(`tunnel server offline: ${err.message}, retry 1s`);
          return setTimeout(getUrl, 1000);
        });
    })();
  }

  _establish(info) {
    // increase max event listeners so that localtunnel consumers don't get
    // warning messages as soon as they setup even one listener. See #71
    this.setMaxListeners(info.max_conn + (EventEmitter.defaultMaxListeners || 10));

    this.tunnelCluster = new TunnelCluster(info);

    // only emit the url the first time
    this.tunnelCluster.once('open', () => {
      this.emit('url', info.url);
    });

    // re-emit socket error
    this.tunnelCluster.on('error', err => {
      debug('got socket error', err.message);
      this.emit('error', err);
    });

    let tunnelCount = 0;

    // track open count
    this.tunnelCluster.on('open', tunnel => {
      tunnelCount++;
      debug('tunnel open [total: %d]', tunnelCount);

      const closeHandler = () => {
        tunnel.destroy();
      };

      if (this.closed) {
        return closeHandler();
      }

      this.once('close', closeHandler);
      tunnel.once('close', () => {
        this.removeListener('close', closeHandler);
      });
    });

    // when a tunnel dies, open a new one
    this.tunnelCluster.on('dead', () => {
      tunnelCount--;
      debug('tunnel dead [total: %d]', tunnelCount);
      if (this.closed) {
        return;
      }
      this.tunnelCluster.open();
    });

    this.tunnelCluster.on('request', req => {
      this.emit('request', req);
    });

    // establish as many tunnels as allowed
    for (let count = 0; count < info.max_conn; ++count) {
      this.tunnelCluster.open();
    }
  }

  open(cb) {
    this._init((err, info) => {
      if (err) {
        return cb(err);
      }

      this.clientId = info.name;
      this.url = info.url;

      // `cached_url` is only returned by proxy servers that support resource caching.
      if (info.cached_url) {
        this.cachedUrl = info.cached_url;
      }

      this._establish(info);
      cb();
    });
  }

  close() {
    this.closed = true;
    this.emit('close');
  }

  async updateAccess(access) {
    const res = await axios.patch(
      `${this.opts.host}/api/services/${this.clientId}`,
      { access },
      {
        headers: {
          Authorization: `Bearer ${this.admin_token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data;
  }

  async extendTTL(ttl) {
    const res = await axios.patch(
      `${this.opts.host}/api/services/${this.clientId}`,
      { ttl },
      {
        headers: {
          Authorization: `Bearer ${this.admin_token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data;
  }
};
