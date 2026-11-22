import { isAdminRequest, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db }) => {
  if (!isAdminRequest(request)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const requestId = String(request.body?.request_id || '');
  if (requestId) await db.query('UPDATE password_recovery_requests SET admin_seen_at = now() WHERE id = $1 AND admin_seen_at IS NULL', [requestId]);
  else await db.query('UPDATE password_recovery_requests SET admin_seen_at = now() WHERE admin_seen_at IS NULL');
  return { body: { ok: true } };
});
