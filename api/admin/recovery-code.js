import { encryptRecoveryCode, isAdminRequest, makeRecoveryCode, hashResetToken, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body }) => {
  if (!isAdminRequest(request)) return { status: 401, body: { error: 'Admin kaliti noto\'g\'ri yoki sozlanmagan.' } };
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const requestId = String(body.request_id || '');
  const [recovery] = await db.query(`SELECT r.id, r.email, r.phone, u.id AS user_id, u.phone AS registered_phone
    FROM password_recovery_requests r LEFT JOIN app_users u ON u.email = r.email
    WHERE r.id = $1 AND r.status IN ('pending', 'code_issued')`, [requestId]);
  if (!recovery) return { status: 404, body: { error: 'Yordam so\'rovi topilmadi yoki yakunlangan.' } };
  if (!recovery.user_id) return { status: 404, body: { error: 'Bu emailga tegishli akkaunt topilmadi.' } };
  const digits = (value) => String(value || '').replace(/\D/g, '');
  if (digits(recovery.phone) !== digits(recovery.registered_phone)) return { status: 403, body: { error: 'Kiritilgan telefon raqami akkauntdagi raqamga mos kelmadi.' } };
  const code = makeRecoveryCode();
  await db.query('UPDATE password_recovery_codes SET used_at = now(), code_ciphertext = NULL WHERE user_id = $1 AND used_at IS NULL', [recovery.user_id]);
  await db.query("INSERT INTO password_recovery_codes (user_id, request_id, code_hash, code_ciphertext, expires_at) VALUES ($1, $2, $3, $4, now() + interval '30 minutes')", [recovery.user_id, requestId, hashResetToken(code), encryptRecoveryCode(code)]);
  await db.query("UPDATE password_recovery_requests SET status = 'code_issued', reviewed_at = now() WHERE id = $1", [requestId]);
  await db.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('site-admin', $1, 'issue_recovery_code')", [recovery.user_id]);
  return { body: { code, expires_in_minutes: 30 } };
});

