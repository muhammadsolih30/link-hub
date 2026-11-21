import { hashPassword, hashResetToken, runApi } from '../../server/vercelApi.js';

export default (req, res) => runApi(req, res, async ({ db, body }) => {
  if (req.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const token = String(body.token || '');
  const password = String(body.password || '');
  if (!token) return { status: 400, body: { error: 'Parolni tiklash havolasi noto\'g\'ri.' } };
  if (password.length < 8 || password.length > 72) return { status: 400, body: { error: 'Yangi parol 8–72 ta belgidan iborat bo\'lsin.' } };
  const passwordHash = await hashPassword(password);
  const rows = await db.query(`WITH valid_reset AS (
      UPDATE password_reset_tokens SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id
    )
    UPDATE app_users SET password_hash = $2, session_version = session_version + 1
    FROM valid_reset WHERE app_users.id = valid_reset.user_id
    RETURNING app_users.id`, [hashResetToken(token), passwordHash]);
  if (!rows.length) return { status: 400, body: { error: 'Parolni tiklash havolasi eskirgan yoki ishlatilgan.' } };
  await db.query("INSERT INTO admin_audit (admin_actor, user_id, action) VALUES ('user-reset', $1, 'password_reset')", [rows[0].id]);
  return { body: { ok: true } };
});
