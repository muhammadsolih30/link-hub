import { hashPassword, hashResetToken, validEmail, runApi } from '../../vercelApi.js';

export default (req, res) => runApi(req, res, async ({ req: request, db, body }) => {
  if (request.method !== 'POST') return { status: 405, body: { error: 'Bu HTTP usuli qo\'llanmaydi.' } };
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim().toUpperCase();
  const password = String(body.new_password || '');
  if (!validEmail(email) || !/^[A-F0-9]{12}$/.test(code)) return { status: 400, body: { error: 'Email yoki maxsus kod noto\'g\'ri.' } };
  if (password.length < 8 || password.length > 72) return { status: 400, body: { error: 'Yangi parol 8–72 ta belgidan iborat bo\'lsin.' } };
  const passwordHash = await hashPassword(password);
  const codeHash = hashResetToken(code);
  const rows = await db.query(`WITH valid_code AS (
      UPDATE password_recovery_codes SET used_at = now(), code_ciphertext = NULL
      WHERE code_hash = $1 AND used_at IS NULL AND verified_at IS NOT NULL AND expires_at > now()
        AND user_id = (SELECT id FROM app_users WHERE email = $2)
      RETURNING user_id, request_id
    ), updated_user AS (
      UPDATE app_users SET password_hash = $3, session_version = session_version + 1
      FROM valid_code WHERE app_users.id = valid_code.user_id RETURNING app_users.id
    )
    UPDATE password_recovery_requests SET status = 'completed', reviewed_at = now()
    WHERE id IN (SELECT request_id FROM valid_code) RETURNING id`, [codeHash, email, passwordHash]);
  if (!rows.length) return { status: 400, body: { error: 'Maxsus kod noto\'g\'ri, eskirgan yoki ishlatilgan.' } };
  return { body: { ok: true } };
});

