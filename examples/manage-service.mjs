/**
 * Service management examples — settings changes, TTL, redeploy, delete.
 *
 * Usage:
 *   node manage-service.mjs <slug> <admin_token> <action>
 *
 * Actions: public, password, google, telegram, ip, extend, redeploy, delete, purge
 */
import mygensite from '../localtunnel.js';

const slug = process.argv[2];
const admin_token = process.argv[3];
const action = process.argv[4] || 'public';

if (!slug || !admin_token) {
  console.error('Usage: node manage-service.mjs <slug> <admin_token> <action>');
  process.exit(1);
}

const site = mygensite.manage({ slug, admin_token });

switch (action) {
  // --- Make public (remove all auth) ---
  case 'public':
    await site.updateAccess({ access: 'public', auth_method: '' });
    console.log('Made public');
    break;

  // --- Add password protection ---
  case 'password':
    await site.updateAccess({ auth_method: 'password', password: 'new-secret' });
    console.log('Password set');
    break;

  // --- Add Google OAuth ---
  case 'google':
    await site.updateAccess({
      auth_method: 'password,google',
      password: 'backup-pass',
      google: 'alice@company.com,bob@company.com',
    });
    console.log('Google + password auth set');
    break;

  // --- Add Telegram auth ---
  case 'telegram':
    await site.updateAccess({
      auth_method: 'telegram',
      telegram: '123456789',
    });
    console.log('Telegram auth set');
    break;

  // --- Restrict by IP ---
  case 'ip':
    await site.updateAccess({ access: 'ip', allowed_ips: '10.0.0.0/8,192.168.1.0/24' });
    console.log('IP restriction set');
    break;

  // --- Extend TTL (0 = unlimited for static) ---
  case 'extend':
    await site.extendTTL(0); // unlimited
    console.log('TTL set to unlimited');
    break;

  // --- Redeploy with new files ---
  case 'redeploy':
    await site.redeploy('./dist');
    console.log('Redeployed');
    break;

  // --- Soft delete (recoverable) ---
  case 'delete':
    await site.delete();
    console.log('Soft deleted');
    break;

  // --- Purge delete (S3 files removed, unrecoverable) ---
  case 'purge':
    await site.delete(true);
    console.log('Purged');
    break;

  default:
    console.error(`Unknown action: ${action}`);
    console.error('Actions: public, password, google, telegram, ip, extend, redeploy, delete, purge');
    process.exit(1);
}
