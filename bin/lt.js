#!/usr/bin/env node
/* eslint-disable no-console */

const openurl = require('openurl');
const yargs = require('yargs');

const localtunnel = require('../localtunnel');
const deploy = require('../lib/deploy');
const { version } = require('../package');

yargs
  .usage('Usage: mygensite <command> [options]')
  .env(true)
  .command('deploy', 'Deploy a static site', (y) => {
    return y
      .option('directory', {
        alias: 'd',
        describe: 'Directory to deploy',
        type: 'string',
        demandOption: true,
      })
      .option('host', {
        alias: 'h',
        describe: 'Server host',
        default: 'https://mygen.site',
      })
      .option('subdomain', {
        alias: 's',
        describe: 'Subdomain (slug)',
      })
      .option('access', {
        describe: 'Access mode: public, ip',
      })
      .option('auth-method', {
        describe: 'Auth methods (CSV): password, google, telegram',
      })
      .option('password', {
        describe: 'Password for password auth',
      })
      .option('google', {
        describe: 'Allowed Google emails or @domain.com patterns (CSV)',
      })
      .option('telegram', {
        describe: 'Allowed Telegram user IDs (CSV)',
      })
      .option('owner-email', {
        describe: 'Owner email for dashboard',
      })
      .option('ttl', {
        describe: 'TTL in seconds (60-86400)',
        type: 'number',
      })
      .option('admin-token', {
        describe: 'Admin token for redeployment',
      })
      .option('token', {
        describe: 'API token (mgs_xxx) for authentication. Also reads MYGENSITE_TOKEN env.',
      })
      .option('mime', {
        describe: 'MIME override(s): ext=type or path=type (e.g. --mime .glb=model/gltf-binary --mime data/blob=application/json)',
        type: 'array',
      });
  }, async (argv) => {
    try {
      let mimeTypes;
      if (argv.mime && argv.mime.length > 0) {
        mimeTypes = {};
        for (const pair of argv.mime) {
          const idx = String(pair).indexOf('=');
          if (idx <= 0) {
            console.error('invalid --mime value: %s (expected key=type, e.g. .glb=model/gltf-binary)', pair);
            process.exit(1);
          }
          mimeTypes[String(pair).slice(0, idx)] = String(pair).slice(idx + 1);
        }
      }
      const result = await deploy({
        host: argv.host,
        subdomain: argv.subdomain,
        directory: argv.directory,
        access: argv.access,
        auth_method: argv.authMethod,
        password: argv.password,
        google: argv.google,
        telegram: argv.telegram,
        owner_email: argv.ownerEmail,
        ttl: argv.ttl,
        admin_token: argv.adminToken,
        token: argv.token,
        mime_types: mimeTypes,
      });

      console.log('your url is: %s', result.url);
      console.log('your slug is: %s', result.slug);
      if (result.admin_token) {
        console.log('your admin_token is: %s', result.admin_token);
      }
      if (result.password) {
        console.log('your password is: %s', result.password);
      }
      if (result.auth_methods) {
        console.log('auth methods: %s', result.auth_methods);
      }
      if (result.expires_at) {
        console.log('expires at: %s', result.expires_at);
      }
    } catch (err) {
      console.error('deploy failed: %s', err.message);
      process.exit(1);
    }
  })
  .command('$0', 'Create a tunnel (default)', (y) => {
    return y
      .option('p', {
        alias: 'port',
        describe: 'Internal HTTP server port',
      })
      .option('h', {
        alias: 'host',
        describe: 'Upstream server providing forwarding',
        default: 'https://mygen.site',
      })
      .option('s', {
        alias: 'subdomain',
        describe: 'Request this subdomain',
      })
      .option('l', {
        alias: 'local-host',
        describe: 'Tunnel traffic to this host instead of localhost, override Host header to this host',
      })
      .option('local-https', {
        describe: 'Tunnel traffic to a local HTTPS server',
      })
      .option('local-cert', {
        describe: 'Path to certificate PEM file for local HTTPS server',
      })
      .option('local-key', {
        describe: 'Path to certificate key file for local HTTPS server',
      })
      .option('local-ca', {
        describe: 'Path to certificate authority file for self-signed certificates',
      })
      .option('allow-invalid-cert', {
        describe: 'Disable certificate checks for your local HTTPS server (ignore cert/key/ca options)',
      })
      .options('o', {
        alias: 'open',
        describe: 'Opens the tunnel URL in your browser',
      })
      .option('print-requests', {
        describe: 'Print basic request info',
      })
      .option('access', {
        describe: 'Access mode: public, ip',
      })
      .option('auth-method', {
        describe: 'Auth methods (CSV): password, google, telegram',
      })
      .option('password', {
        describe: 'Password for password auth',
      })
      .option('google', {
        describe: 'Allowed Google emails or @domain.com patterns (CSV)',
      })
      .option('telegram', {
        describe: 'Allowed Telegram user IDs (CSV)',
      })
      .option('owner-email', {
        describe: 'Owner email for dashboard management',
      })
      .option('ttl', {
        describe: 'Tunnel TTL in seconds (60-86400)',
        type: 'number',
      })
      .option('admin-token', {
        describe: 'Admin token for reconnecting to an existing tunnel',
      })
      .option('token', {
        describe: 'API token (mgs_xxx) for authentication. Also reads MYGENSITE_TOKEN env.',
      })
      .boolean('local-https')
      .boolean('allow-invalid-cert')
      .boolean('print-requests');
  }, async (argv) => {
    if (typeof argv.port !== 'number') {
      yargs.showHelp();
      console.error('\nInvalid argument: `port` must be a number');
      process.exit(1);
    }

    let tunnel;
    try {
      tunnel = await localtunnel({
        port: argv.port,
        host: argv.host,
        subdomain: argv.subdomain,
        local_host: argv.localHost,
        local_https: argv.localHttps,
        local_cert: argv.localCert,
        local_key: argv.localKey,
        local_ca: argv.localCa,
        allow_invalid_cert: argv.allowInvalidCert,
        access: argv.access,
        auth_method: argv.authMethod,
        password: argv.password,
        google: argv.google,
        telegram: argv.telegram,
        owner_email: argv.ownerEmail,
        ttl: argv.ttl,
        admin_token: argv.adminToken,
        token: argv.token,
      });
    } catch (err) {
      console.error('tunnel failed: %s', err.message);
      process.exit(1);
    }

    tunnel.on('error', err => {
      console.error('tunnel error: %s', err.message);
    });

    tunnel.on('reconnecting', () => {
      console.log('tunnel disconnected, reconnecting...');
    });

    tunnel.on('reconnect', url => {
      console.log('tunnel re-established: %s', url);
    });

    console.log('your url is: %s', tunnel.url);

    if (tunnel.password) {
      console.log('your password is: %s', tunnel.password);
    }

    if (tunnel.admin_token) {
      console.log('your admin_token is: %s', tunnel.admin_token);
    }

    if (tunnel.auth_methods) {
      console.log('auth methods: %s', tunnel.auth_methods);
    }

    if (tunnel.cachedUrl) {
      console.log('your cachedUrl is: %s', tunnel.cachedUrl);
    }

    if (argv.open) {
      openurl.open(tunnel.url);
    }

    if (argv['print-requests']) {
      tunnel.on('request', info => {
        console.log(new Date().toString(), info.method, info.path);
      });
    }
  })
  .help('help', 'Show this help and exit')
  .version(version)
  .parse();
