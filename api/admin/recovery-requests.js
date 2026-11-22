import { isAdminRequest, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db }) => {
  if (!isAdminRequest(request)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  if (request.method !== 'GET') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const rows = await db.query(`SELECT r.id, r.email, r.full_name, r.phone, r.status, r.created_at, r.admin_seen_at,
    u.email AS registered_email, u.full_name AS registered_full_name, u.phone AS registered_phone,
    (u.id IS NOT NULL AND regexp_replace(r.phone, '[^0-9]', '', 'g') = regexp_replace(u.phone, '[^0-9]', '', 'g')) AS identity_matches
    FROM password_recovery_requests r LEFT JOIN app_users u ON u.email = r.email
    ORDER BY r.created_at DESC LIMIT 100`);
  return { body: rows };
});

